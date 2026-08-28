// Ponte entre o chamado do Adm e o estoque: o que foi PEDIDO, o que JÁ FOI
// entregue e o que ainda falta. Sem React e sem Supabase (roda sob `node --test`).
//
// Dependência de mão única: o Administrativo importa do Estoque, nunca o
// contrário. As duas libs usadas aqui são puras.

import { montarMovimentos, validarCarrinho } from '../../estoque/lib/carrinho.js';
import { ESTOQUE_VITRINE } from '../../../config/estoqueModo.js';

/**
 * Só EPI e uniforme mexem no estoque. Os outros ~24 serviços do catálogo (frota,
 * viagem, TI…) não têm item nenhum, e para eles a tela de fechamento continua
 * exatamente como sempre foi — sem nem uma query a mais.
 *
 * Em modo vitrine devolve false para TODOS: é o interruptor que desliga a
 * integração inteira no Administrativo de uma vez (card de baixa, consulta de
 * saldo e a coluna "Em estoque" saem juntos, porque todos dependem daqui).
 *
 * `vitrine` é injetável para o teste conseguir exercitar os dois modos sem
 * depender do valor atual do flag.
 */
export const chamadoUsaEstoque = (chamado, { vitrine = ESTOQUE_VITRINE } = {}) =>
  !vitrine
  && chamado?.classe === 'saude-seguranca'
  && ['epi', 'uniforme'].includes(chamado?.servico);

/** Categoria do catálogo correspondente ao serviço. */
export const categoriaDoChamado = (chamado) =>
  (chamado?.servico === 'uniforme' ? 'uniforme' : 'epi');

/**
 * Quanto já saiu deste chamado, por variante. Sem isso, fechar um chamado que
 * foi reaberto baixaria o material uma segunda vez — e o EPI já está com a
 * pessoa. Reabertura não devolve estoque, de propósito.
 */
export function jaEntreguePorVariante(movimentos) {
  const soma = new Map();
  for (const m of movimentos || []) {
    if (m.tipo !== 'saida') continue;
    const q = Math.abs(Number(m.quantidade) || 0);
    soma.set(m.variante_id, (soma.get(m.variante_id) || 0) + q);
  }
  return soma;
}

/**
 * Linhas já preenchidas do card de baixa.
 *
 * `campos.itens` é o pedido estruturado. Ele NÃO existe em chamado aberto antes
 * desta mudança nem nos filhos de uma mobilização — esse é o caso normal, não a
 * exceção, e devolver lista vazia aqui é o comportamento certo: o card abre
 * vazio e a pessoa escolhe na mão o que está entregando.
 *
 * A variante vem de `posicao` (é de lá que sai o saldo). Quando ela não está
 * mais no catálogo — desativada ou removida —, a linha sobrevive com o texto
 * denormalizado do pedido e `variante: null`, para a tela poder explicar.
 */
export function montarLinhasDeBaixa({ campos, movimentos, posicao, solicitanteId } = {}) {
  const itens = Array.isArray(campos?.itens) ? campos.itens : [];
  const entregues = jaEntreguePorVariante(movimentos);

  return itens.map((it) => {
    const variante = (posicao || []).find((p) => p.id === it.variante_id) || null;
    const pedido = Number(it.quantidade) > 0 ? Math.round(Number(it.quantidade)) : 1;
    const jaEntregue = entregues.get(it.variante_id) || 0;
    return {
      variante_id: it.variante_id,
      variante,
      // Rótulo de reserva para o item que saiu do catálogo.
      descricaoPedida: it.descricao || '',
      detalhePedido: [it.tamanho, it.ca ? `CA ${it.ca}` : ''].filter(Boolean).join(' · '),
      pedido,
      jaEntregue,
      // Já entregue por inteiro fica com 0: a linha aparece (mostrando que está
      // resolvida) mas não vira movimento.
      quantidade: Math.max(0, pedido - jaEntregue),
      colaborador_id: solicitanteId || '',
      motivo: 'Entrega por chamado',
      observacao: '',
    };
  });
}

/** Só as linhas que de fato vão virar movimento. */
export const linhasComQuantidade = (linhas) =>
  (linhas || []).filter((l) => l?.variante_id && Number(l.quantidade) > 0);

/**
 * Valida o que vai ser baixado. Devolve string de erro ou ''.
 * Carrinho vazio NÃO é erro aqui: fechar sem movimentar estoque é um caso
 * legítimo (item comprado direto, pedido negado, catálogo incompleto).
 */
export function validarLinhasDeBaixa(linhas) {
  const uteis = linhasComQuantidade(linhas);
  if (!uteis.length) return '';

  const semCatalogo = uteis.find((l) => !l.variante);
  if (semCatalogo) {
    return `"${semCatalogo.descricaoPedida || 'Um dos itens'}" não está mais no catálogo do estoque. `
      + 'Remova a linha ou escolha o item equivalente.';
  }

  return validarCarrinho(uteis, { tipo: 'saida' });
}

/** Movimentos para a RPC estoque_baixa_chamado. */
export const movimentosDaBaixa = (linhas) =>
  montarMovimentos(linhasComQuantidade(linhas), { tipo: 'saida', motivo: 'Entrega por chamado' });
