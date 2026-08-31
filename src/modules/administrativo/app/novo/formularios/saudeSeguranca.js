// Regras dos serviços de Saúde e segurança (EPI, uniforme, outras demandas).
// Sem imports, para rodar sob `node --test` e não quebrar o fast refresh —
// as listas de opções ficam em opcoes.js.

// "novo ou substituição": a planilha traz o motivo como quebra/desgaste, e o
// pedido de item novo é o terceiro caso.
export const MOTIVOS = ['Item novo', 'Substituição por quebra', 'Substituição por desgaste'];

export const inicialSaudeSeguranca = () => ({
  cc: '',
  // Itens escolhidos do catálogo do Estoque, com quantidade
  // ({ variante_id, descricao, tamanho, ca, genero, setor, quantidade }).
  // Vão denormalizados de propósito: o detalhe do chamado precisa continuar
  // legível mesmo que a variante seja renomeada ou desativada depois.
  itens: [],
  // Texto livre para o que NÃO está no catálogo. Não é resquício do formato
  // antigo: é a garantia de que ninguém fica sem pedir por causa de um cadastro
  // incompleto do almoxarifado.
  tipo_livre: '',
  // Legado: chamados abertos antes do catálogo, e os filhos gerados pela
  // mobilização (lib/desdobramento.js), que ainda gravam neste formato.
  tipo: [],
  motivo: '',
  localizacao: '',
  observacao: '',
});

/**
 * `servico` decide o que é exigido — os três compartilham o formulário, mas
 * pedem coisas diferentes. A descrição e os anexos não entram aqui: são os do
 * próprio chamado, e duplicá-los faria a pessoa escrever a mesma coisa duas vezes.
 *
 * REGRA CENTRAL: o estado do estoque NUNCA bloqueia um pedido. Catálogo vazio,
 * item não cadastrado ou saldo zerado são problemas de quem fornece, não de quem
 * precisa do EPI — e é justamente o pedido que sinaliza a compra. Basta ter dito
 * o que se quer: escolhendo no catálogo, escrevendo, ou os dois.
 */
export function validarSaudeSeguranca(v, servico) {
  if (!v.cc?.trim()) return 'Informe o centro de custo.';

  if (servico === 'epi' || servico === 'uniforme') {
    const itens = v.itens || [];

    // Quantidade inteira e positiva no que veio do catálogo: é ela que o estoque
    // desconta na baixa. Vale só para o que foi escolhido lá.
    const invalido = itens.find((i) => {
      const n = Number(i.quantidade);
      return !i.variante_id || !Number.isInteger(n) || n <= 0;
    });
    if (invalido) return 'Informe uma quantidade inteira maior que zero para cada item.';

    // Catálogo OU texto livre: qualquer um dos dois basta. O legado `tipo`
    // também conta, para o desdobramento da mobilização continuar valendo.
    const pediuAlgo = itens.length > 0 || !!v.tipo_livre?.trim() || (v.tipo?.length || 0) > 0;
    if (!pediuAlgo) {
      return servico === 'epi'
        ? 'Escolha os EPIs no catálogo ou descreva o que precisa.'
        : 'Escolha as peças no catálogo ou descreva o que precisa.';
    }

    if (!v.motivo) return 'Informe o motivo do pedido.';
    return '';
  }

  return '';
}
