// Regras dos serviços de Saúde e segurança (EPI, uniforme, outras demandas).
// Só importa o flag do Estoque, que é um arquivo sem dependências — assim o
// módulo continua rodando sob `node --test` e sem quebrar o fast refresh.
// As listas de opções ficam em opcoes.js.
// Extensão explícita: este arquivo roda sob `node --test`, que não resolve
// import sem `.js` (o Vite resolve, e por isso o build não acusaria).
import { ESTOQUE_VITRINE } from '../../../../../config/estoqueModo.js';

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
export function validarSaudeSeguranca(v, servico, { vitrine = ESTOQUE_VITRINE } = {}) {
  if (!v.cc?.trim()) return 'Informe o centro de custo.';

  // Modo vitrine: o catálogo do Estoque ainda não vale, então o pedido volta ao
  // formato antigo — lista de EPIs e texto livre de uniforme. Sem isto, com o
  // catálogo vazio, ninguém conseguiria abrir esses chamados.
  if (vitrine) {
    if (servico === 'epi') {
      if (!v.tipo?.length) return 'Escolha ao menos um EPI.';
      if (!v.motivo) return 'Informe o motivo do pedido.';
    }
    if (servico === 'uniforme') {
      if (!v.tipo_livre?.trim()) return 'Descreva as peças de uniforme e os tamanhos.';
      if (!v.motivo) return 'Informe o motivo do pedido.';
    }
    return '';
  }

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
