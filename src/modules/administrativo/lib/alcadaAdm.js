/**
 * Quem aprova um chamado do Administrativo.
 *
 * Duas dinâmicas, as mesmas da Gestão de Pessoas:
 *
 * 1. ALÇADA POR VALOR — serviço que carrega gasto tem a cadeia definida pelo
 *    montante, usando o motor de `config/alcadas.js` (o mesmo do Financeiro e
 *    do DP). O GERENTE decide primeiro, e só depois sobe para a faixa — mesma
 *    ordem do Financeiro. A repetição que isso poderia causar (na faixa até
 *    R$ 2.000 o papel da alçada JÁ é o gerente) é resolvida por dedução de
 *    pessoa, não deixando o fluxo de fora.
 * 2. FLUXO CONFIGURADO — nos demais, a cadeia vem de `chamados_adm_fluxos`,
 *    cadastrada por (solicitante, classe), com um fluxo geral como padrão.
 *
 * Serviço que não exige aprovação não passa por nenhuma das duas: vai direto
 * para a fila do Adm.
 *
 * Este arquivo é lógica pura — sem Supabase, sem React — para poder ser testado
 * e para a regra não se espalhar pelas telas.
 */

/**
 * Serviços com gasto e onde mora o valor no `campos` do chamado.
 * `tabela` é a tabela de alçada de config/alcadas.js.
 */
export const SERVICOS_COM_ALCADA = {
  'compra/solicitacao-compra': { campo: 'valor_base', tabela: 'administrativo', rotulo: 'Valor base' },
  'frota/recarga-ticket-log': { campo: 'valor', tabela: 'administrativo', rotulo: 'Valor' },
  'viagem-hospedagem/locacao-imovel': { campo: 'custo_previsto', tabela: 'administrativo', rotulo: 'Custo previsto' },
};

export const alcadaDoServico = (classe, servico) => SERVICOS_COM_ALCADA[`${classe}/${servico}`] || null;

/**
 * Valor do chamado para fins de alçada. Campo vazio vira 0 — e 0 cai na
 * primeira faixa, que é a mais branda; por isso `decidirAprovacao` trata valor
 * ausente como impedimento, em vez de deixar passar barato.
 */
export function valorParaAlcada(campos, def) {
  if (!def) return null;
  const bruto = campos?.[def.campo];
  if (bruto === undefined || bruto === null || bruto === '') return null;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : null;
}

/**
 * Decide COMO o chamado será aprovado, sem resolver pessoas.
 *
 * @returns {{modo: 'alcada'|'fluxo'|'nenhum', valor?: number, tabela?: string, erro?: string}}
 */
export function decidirAprovacao({ classe, servico, campos = {}, exigeAprovacao = false }) {
  const def = alcadaDoServico(classe, servico);

  if (def) {
    const valor = valorParaAlcada(campos, def);
    // Serviço de gasto sem valor preenchido não tem como ser enquadrado. Deixar
    // seguir escolheria a faixa mais baixa por omissão — exatamente o erro que
    // uma alçada existe para evitar.
    if (valor === null) {
      return { modo: 'alcada', erro: `Informe o ${def.rotulo.toLowerCase()} para determinar quem aprova.` };
    }
    return { modo: 'alcada', valor, tabela: def.tabela };
  }

  return exigeAprovacao ? { modo: 'fluxo' } : { modo: 'nenhum' };
}

/**
 * Escolhe a cadeia configurada: a da classe, se existir; senão a geral.
 * `fluxos` são as linhas de chamados_adm_fluxos do solicitante.
 */
export function cadeiaDoFluxo(fluxos = [], classe) {
  const daClasse = fluxos.find((f) => f.classe === classe);
  if (daClasse) return daClasse.aprovadores || [];
  const geral = fluxos.find((f) => !f.classe);
  return geral?.aprovadores || [];
}

/** Chave do fluxo geral no banco: classe vazia. Constante para não virar '' solto. */
export const FLUXO_GERAL = '';

/**
 * Junta as cadeias na ordem dada, sem repetir pessoa.
 *
 * Quem já apareceu antes não aprova de novo: na faixa até R$ 2.000 o papel da
 * alçada é o próprio gerente, e sem isto ele receberia duas etapas seguidas do
 * mesmo pedido. Preserva a ordem — quem vem primeiro decide primeiro.
 */
export function juntarCadeias(...listas) {
  const vistos = new Set();
  const saida = [];
  for (const id of listas.flat()) {
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    saida.push(id);
  }
  return saida;
}

/**
 * Papéis que só fazem sentido vindos da CADEIA do solicitante — quem responde
 * por ele, não quem ocupa o cargo em algum outro lugar da empresa.
 *
 * A RPC compartilhada, quando não acha ninguém com essa função acima da pessoa,
 * recorre a uma lista fixa de ocupantes do cargo. Para o Financeiro e o DP isso
 * serve; aqui não: um Gerente Executivo de outra área acabava aprovando compra
 * de equipe que ele não conhece.
 */
export const PAPEIS_DA_CADEIA = new Set(['GERENTE', 'GERENTE_EXECUTIVO', 'DIRETOR_AREA']);

/**
 * Papéis que a faixa exigiu da cadeia mas vieram de outro lugar.
 *
 * `origem` é da RPC: 'CADEIA' quando a pessoa foi achada subindo o organograma,
 * qualquer outra coisa quando saiu da lista de ocupantes do cargo.
 */
export function papeisForaDaCadeia(etapas = []) {
  return etapas
    .filter((e) => PAPEIS_DA_CADEIA.has(e.papel))
    .filter((e) => (e.candidatos || []).every((c) => c.origem !== 'CADEIA'))
    .map((e) => e.papel);
}
