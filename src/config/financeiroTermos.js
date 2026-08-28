/**
 * Termos de Uso e Responsabilidade por tipo de solicitação do Financeiro.
 * Exibidos em popup; o usuário marca "Li e estou de acordo" (aceite obrigatório).
 * Chave = tipoDb da solicitação.
 *
 * Cada item é [título, texto] — com um terceiro elemento `true` quando a
 * cláusula é DESTACADA no popup (hoje: prestação de contas e auditoria, as duas
 * que mais geram problema depois).
 */
export const TERMOS_FIN = {
  cartao_virtual: {
    titulo: 'Termos de Uso e Responsabilidade — Cartão',
    intro: 'Ao prosseguir com a solicitação, você declara estar ciente e de acordo com:',
    itens: [
      ['Finalidade exclusiva', 'o cartão destina-se exclusivamente à despesa/objeto descrito neste chamado. Uso para finalidade diversa da solicitada constitui uso indevido e sujeita o cartão a bloqueio imediato.'],
      ['Limite e vigência', 'o uso está restrito ao valor e ao prazo definidos na aprovação. Qualquer necessidade de limite adicional exige nova solicitação (aumento de limite) pelo Portal PHD.'],
      ['Prestação de contas diária', 'a nota fiscal/comprovante de cada gasto deve ser anexada no sistema no mesmo dia em que a despesa ocorrer. O descumprimento pode levar ao cancelamento automático do cartão pelo sistema, com bloqueio do crédito remanescente.', true],
      ['Intransferibilidade', 'os dados do cartão (número, senha, código de segurança) são pessoais e intransferíveis. Compartilhar com terceiros, inclusive colegas de equipe, é proibido. O solicitante responde por uso indevido decorrente do descumprimento desta cláusula.'],
      ['Canal único', 'solicitações de criação e de aumento de limite só têm validade quando feitas pelo Portal PHD. Pedidos por outros canais (e-mail, WhatsApp etc.) não serão atendidos.'],
      ['SLA do financeiro', 'análise e resposta da solicitação em até 48h úteis.'],
      ['Cancelamento', 'o cartão é bloqueado automaticamente ao fim da vigência, do projeto/contrato relacionado, ou em caso de desligamento/mudança de função do solicitante.'],
      ['Veracidade', 'as informações preenchidas são de responsabilidade do solicitante. Declaração falsa ou uso fraudulento sujeitam-se a medidas administrativas.'],
      ['Auditoria', 'a PHD pode auditar, a qualquer momento, o uso do cartão e a documentação anexada.', true],
    ],
  },
  aumento_limite: {
    titulo: 'Termos de Uso e Responsabilidade — Aumento de Limite de Cartão',
    intro: 'Ao prosseguir com a solicitação, você declara estar ciente e de acordo com:',
    itens: [
      ['Vinculação à finalidade original', 'o aumento de limite mantém-se vinculado ao objeto/finalidade já aprovados na criação do cartão. Se a finalidade mudou, abra uma nova solicitação de criação, não um aumento.'],
      ['Novo valor e vigência', 'o crédito adicional está restrito ao valor e prazo definidos nesta aprovação.'],
      ['Prestação de contas diária', 'permanece válida a regra de comprovação no mesmo dia da despesa, incluindo os gastos cobertos pelo limite adicional. O descumprimento pode levar ao cancelamento automático do cartão pelo sistema.', true],
      ['Auditoria', 'a PHD pode auditar, a qualquer momento, o uso do cartão e a documentação anexada.', true],
      ['Canal único', 'esta solicitação só tem validade por ter sido feita pelo Portal PHD.'],
      ['SLA do financeiro', 'análise e resposta em até 48h úteis.'],
      ['Intransferibilidade e demais responsabilidades', 'permanecem em vigor todas as condições aceitas na solicitação original de criação do cartão (intransferibilidade, veracidade das informações, sujeição a auditoria).'],
    ],
  },
};

export const getTermos = (tipoDb) => TERMOS_FIN[tipoDb] || null;

/** Todos os termos do módulo, para a consulta na barra superior. */
export const listarTermosFin = () =>
  Object.entries(TERMOS_FIN).map(([tipo, t]) => ({ tipo, ...t }));
