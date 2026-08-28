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
 * 2. ESCADA DO ORGANOGRAMA — nos demais, o pedido sobe a hierarquia da pessoa:
 *    COORDENADOR e depois o GERENTE acima dele (`escadaDoOrganograma`, no fim
 *    deste arquivo). `chamados_adm_fluxos` continua existindo, mas como
 *    EXCEÇÃO cadastrada à mão, não como o caminho de todo mundo.
 *
 * A escada vale nas duas: mesmo no serviço de gasto, quem responde pela pessoa
 * avaliza antes de o pedido subir para a faixa de valor.
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

// ---------------------------------------------------------------------------
// Escada do organograma: Coordenador → Gerente
// ---------------------------------------------------------------------------

const semAcento = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().trim();

/**
 * Cargo de gerência. "GERENTE EXECUTIVO", "GERENTE FINANCEIRO" e "GERENTE DE
 * PMO" contam — todos gerenciam; o que a regra procura é o degrau, não o
 * sufixo do cargo.
 */
export const ehGerente = (funcao) => semAcento(funcao).includes('GERENTE');

/** Acima de gerente: diretoria e CEO. Fim da linha da escada. */
export const ehAcimaDeGerente = (funcao) => {
  const f = semAcento(funcao);
  return f.startsWith('DIRETOR') || f === 'CEO';
};

/** Já é gerência (ou mais alto)? Quem é, não precisa de mais ninguém acima. */
export const ehGerencia = (funcao) => ehGerente(funcao) || ehAcimaDeGerente(funcao);

export const PAPEL_GESTOR_DIRETO = 'Gestor direto';
export const PAPEL_GERENTE = 'Gerente';

/**
 * A escada de aprovação tirada do organograma: o superior direto e, acima dele,
 * o gerente.
 *
 * Dois degraus, na ordem em que decidem:
 *
 *   1. SUPERIOR DIRETO — o "coordenador da pessoa". Quem responde por ela no
 *      dia a dia avaliza o pedido antes de qualquer outra coisa.
 *   2. GERENTE ACIMA DELE — o primeiro cargo de gerência subindo a cadeia a
 *      partir do coordenador. Sem gerente na cadeia (acontece em Comercial,
 *      onde o coordenador responde direto à diretoria), cai no primeiro diretor
 *      ou no CEO: o degrau existe, só está mais acima.
 *
 * A escada PARA no primeiro degrau quando o superior direto já é gerência —
 * senão o pedido de quem responde a um gerente subiria para a diretoria, e o de
 * quem responde a um diretor iria ao CEO, por menor que fosse.
 *
 * `superiores` é a saída de `chamados_adm_cadeia`: [{ nivel, id, nome, funcao }],
 * nível 1 = superior direto. Pessoas inativas já vêm de fora pela RPC, então o
 * primeiro da lista pode ser um avô — e é ele quem responde pela pessoa hoje.
 *
 * @returns {Array<{id: string, nome: string, funcao: string, papel: string}>}
 */
export function escadaDoOrganograma(superiores = []) {
  const cadeia = [...superiores]
    .filter((p) => p?.id)
    .sort((a, b) => (a.nivel || 0) - (b.nivel || 0));

  const direto = cadeia[0];
  if (!direto) return [];

  const passos = [{ ...direto, papel: PAPEL_GESTOR_DIRETO }];
  if (ehGerencia(direto.funcao)) return passos;

  const acima = cadeia.slice(1).filter((p) => p.id !== direto.id);
  const gerente = acima.find((p) => ehGerente(p.funcao))
    || acima.find((p) => ehAcimaDeGerente(p.funcao));
  if (gerente) passos.push({ ...gerente, papel: PAPEL_GERENTE });

  return passos;
}
