// Regras dos serviços de Saúde e segurança (EPI, uniforme, outras demandas).
// Sem imports, para rodar sob `node --test` e não quebrar o fast refresh —
// as listas de opções ficam em opcoes.js.

// "novo ou substituição": a planilha traz o motivo como quebra/desgaste, e o
// pedido de item novo é o terceiro caso.
export const MOTIVOS = ['Item novo', 'Substituição por quebra', 'Substituição por desgaste'];

export const inicialSaudeSeguranca = () => ({
  cc: '',
  // Pedido estruturado: itens do catálogo do Estoque, com quantidade. É o que
  // permite ao Adm consultar o saldo antes de prometer e dar baixa ao concluir.
  // Cada item guarda os dados denormalizados
  // ({ variante_id, descricao, tamanho, ca, genero, setor, quantidade })
  // porque o detalhe do chamado precisa continuar legível mesmo que a variante
  // seja renomeada ou desativada depois.
  itens: [],
  // Campos legados. Nunca mais escritos por este formulário, mas continuam aqui
  // porque os chamados abertos até hoje — e os filhos gerados pela mobilização
  // (lib/desdobramento.js) — usam este formato, e as telas de leitura precisam
  // aguentar os dois.
  tipo: [],          // EPI: lista de rótulos, sem quantidade
  tipo_livre: '',    // Uniforme: texto livre ("2 camisas polo M")
  motivo: '',
  localizacao: '',
  observacao: '',
});

/**
 * `servico` decide o que é exigido — os três compartilham o formulário, mas
 * pedem coisas diferentes. A descrição e os anexos não entram aqui: são os do
 * próprio chamado, e duplicá-los faria a pessoa escrever a mesma coisa duas vezes.
 */
export function validarSaudeSeguranca(v, servico) {
  if (!v.cc?.trim()) return 'Informe o centro de custo.';

  if (servico === 'epi' || servico === 'uniforme') {
    const itens = v.itens || [];
    if (!itens.length) {
      return servico === 'epi'
        ? 'Escolha ao menos um EPI.'
        : 'Escolha ao menos uma peça de uniforme.';
    }
    // Quantidade inteira e positiva: é ela que o estoque vai descontar na baixa.
    const invalido = itens.find((i) => {
      const n = Number(i.quantidade);
      return !i.variante_id || !Number.isInteger(n) || n <= 0;
    });
    if (invalido) return 'Informe uma quantidade inteira maior que zero para cada item.';
    if (!v.motivo) return 'Informe o motivo do pedido.';
    return '';
  }

  return '';
}
