// Regras dos serviços de Saúde e segurança (EPI, uniforme, outras demandas).
// Sem imports, para rodar sob `node --test` e não quebrar o fast refresh —
// as listas de opções ficam em opcoes.js.

// "novo ou substituição": a planilha traz o motivo como quebra/desgaste, e o
// pedido de item novo é o terceiro caso.
export const MOTIVOS = ['Item novo', 'Substituição por quebra', 'Substituição por desgaste'];

export const inicialSaudeSeguranca = () => ({
  cc: '',
  tipo: [],          // EPI: escolhido da lista do portal
  tipo_livre: '',    // Uniforme: a lista não existe, então é texto
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

  if (servico === 'epi') {
    if (!v.tipo?.length) return 'Escolha ao menos um EPI.';
    if (!v.motivo) return 'Informe o motivo do pedido.';
    return '';
  }

  if (servico === 'uniforme') {
    if (!v.tipo_livre?.trim()) return 'Descreva as peças de uniforme e os tamanhos.';
    if (!v.motivo) return 'Informe o motivo do pedido.';
    return '';
  }

  return '';
}
