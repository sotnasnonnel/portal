// Carrinho de movimentação: o que as telas de entrada, saída, ajuste e a baixa
// pelo chamado têm em comum. Sem React e sem Supabase (roda sob `node --test`).
//
// Uma LINHA do carrinho é o que a pessoa preenche:
//   { variante_id, quantidade, colaborador_id, motivo, observacao, variante }
// `quantidade` é sempre POSITIVA na tela — quem inverte o sinal para a saída é
// montarMovimentos, porque o banco guarda o delta assinado.
// `variante` é a linha de estoque_posicao, só para exibir e conferir saldo.

import { rotuloVariante } from './catalogo.js';

export const linhaVazia = () => ({
  variante_id: '', quantidade: 1, colaborador_id: '', motivo: '', observacao: '', variante: null,
});

const inteiroPositivo = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
};

/**
 * Quanto cada variante está saindo no lote INTEIRO.
 *
 * Somar é o ponto: duas linhas de 1 capacete para pessoas diferentes são
 * legítimas, mas se o saldo é 1 o lote não passa. Validar linha a linha deixaria
 * as duas passarem no front e o banco recusaria o lote no meio.
 */
export function conferirSaldos(linhas) {
  const porVariante = new Map();
  for (const l of linhas || []) {
    if (!l?.variante_id || !inteiroPositivo(l.quantidade)) continue;
    const atual = porVariante.get(l.variante_id) || {
      variante: l.variante, pedido: 0, saldo: Number(l.variante?.saldo) || 0,
    };
    atual.pedido += Number(l.quantidade);
    if (l.variante) atual.variante = l.variante;
    porVariante.set(l.variante_id, atual);
  }
  return [...porVariante.entries()].map(([variante_id, v]) => ({
    variante_id, ...v, falta: Math.max(0, v.pedido - v.saldo),
  }));
}

/** Ids das variantes cujo total do lote não cabe no saldo — para pintar a linha. */
export const variantesSemSaldo = (linhas) =>
  new Set(conferirSaldos(linhas).filter((c) => c.falta > 0).map((c) => c.variante_id));

/**
 * Valida o lote antes de chamar a RPC. Devolve string de erro ou ''.
 *
 * Repete regras que o banco também garante (saída nominal, saldo não negativo)
 * de propósito: a mensagem daqui nomeia o item e a linha, a do banco é genérica
 * e chega depois de uma ida ao servidor. O banco continua sendo a verdade — o
 * saldo aqui pode estar velho.
 */
export function validarCarrinho(linhas, { tipo } = {}) {
  const uteis = (linhas || []).filter((l) => l?.variante_id);
  if (!uteis.length) return 'Escolha ao menos um item.';

  for (const l of uteis) {
    if (!inteiroPositivo(l.quantidade)) {
      return `Informe uma quantidade inteira maior que zero para ${rotuloVariante(l.variante) || 'o item escolhido'}.`;
    }
    if (tipo === 'saida' && !l.colaborador_id) {
      return `Informe quem recebeu ${rotuloVariante(l.variante) || 'o item'}.`;
    }
  }

  if (tipo === 'saida') {
    const semSaldo = conferirSaldos(uteis).find((c) => c.falta > 0);
    if (semSaldo) {
      return `Saldo insuficiente de ${rotuloVariante(semSaldo.variante)}: `
        + `disponível ${semSaldo.saldo}, pedido ${semSaldo.pedido}.`;
    }
  }

  return '';
}

/**
 * Converte as linhas da tela no jsonb que a RPC espera. É AQUI que a saída ganha
 * sinal negativo — o resto do sistema pensa em quantidade positiva.
 */
export function montarMovimentos(linhas, { tipo, motivo = '', documento = '' } = {}) {
  return (linhas || [])
    .filter((l) => l?.variante_id && inteiroPositivo(l.quantidade))
    .map((l) => ({
      variante_id: l.variante_id,
      tipo,
      quantidade: tipo === 'saida' ? -Math.abs(Number(l.quantidade)) : Number(l.quantidade),
      motivo: (l.motivo || motivo || '').trim(),
      colaborador_id: l.colaborador_id || '',
      documento: documento.trim(),
      observacao: (l.observacao || '').trim(),
    }));
}

/**
 * Inventário: a pessoa digita o que CONTOU, não a diferença. O ajuste é o delta,
 * e linha sem divergência não vira movimento — inventário que confere não é
 * evento, e gerar movimento zero poluiria o histórico (além de o banco recusar,
 * por `check (quantidade <> 0)`).
 *
 * `linhas`: [{ variante_id, contagem, variante }] — contagem pode ser '' (não contado).
 */
export function movimentosDeInventario(linhas, { motivo = 'Inventário' } = {}) {
  return (linhas || [])
    .filter((l) => l?.variante_id && l.contagem !== '' && l.contagem !== null
      && l.contagem !== undefined && Number.isInteger(Number(l.contagem)) && Number(l.contagem) >= 0)
    .map((l) => ({
      variante_id: l.variante_id,
      tipo: 'ajuste',
      quantidade: Number(l.contagem) - (Number(l.variante?.saldo) || 0),
      motivo,
      colaborador_id: '',
      observacao: `Contagem ${l.contagem}, sistema ${Number(l.variante?.saldo) || 0}`,
    }))
    .filter((m) => m.quantidade !== 0);
}

/** Resumo para o rodapé da tela: quantas linhas e quantas peças. */
export function totalizar(linhas) {
  const uteis = (linhas || []).filter((l) => l?.variante_id && inteiroPositivo(l.quantidade));
  return {
    linhas: uteis.length,
    pecas: uteis.reduce((s, l) => s + Number(l.quantidade), 0),
    valor: uteis.reduce((s, l) => s + Number(l.quantidade) * (Number(l.variante?.custo_unitario) || 0), 0),
  };
}
