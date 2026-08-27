// ===== Quem aprova uma solicitação do Financeiro =====
//
// Mesma dinâmica do módulo Administrativo (decisão de ago/2026), para as duas
// portas de entrada da empresa não terem regras diferentes para o mesmo gasto:
//
//   1. ESCADA DO ORGANOGRAMA — o pedido sobe pela hierarquia da pessoa:
//      superior direto e, acima dele, o gerente. Deduzida do organograma, então
//      acompanha troca de gestor sozinha.
//   2. ALÇADA POR VALOR — depois da escada, a faixa (TABELA_ADMINISTRATIVO)
//      diz que papéis ainda precisam aprovar: até R$ 5.000 nenhum; de R$ 5.000
//      a R$ 20.000 a dupla COO + Gerente Financeiro; acima disso soma o CEO.
//   3. EXECUÇÃO — o time do Financeiro, sempre no fim (montarEtapasAlcada).
//
// A tela de Fluxos continua existindo, mas como EXCEÇÃO cadastrada à mão: quem
// tem cadeia cadastrada usa a dela, e ninguém mais fica travado por não ter.
//
// A escada é a MESMA função do Adm (importada, não copiada): duas cópias da
// regra divergiriam no primeiro ajuste.
import { supabase } from '../../../../services/supabase';
import { buscarFluxoFin } from '../../../../config/aprovacaoFinanceiro';
import { avaliarAlcada, PAPEL_LABEL, TABELAS } from '../../../../config/alcadas';
import { resolverPapeis } from '../../../../services/alcadas';
import { escadaDoOrganograma, papeisForaDaCadeia } from '../../../administrativo/lib/alcadaAdm';

/** Tabela de alçada das solicitações do Financeiro (a mesma do Adm). */
export const TABELA_FIN = 'administrativo';

/** Ninguém acima da pessoa e ela não é o topo: alguém precisa arrumar cadastro. */
export class SemAprovadorFinError extends Error {
  constructor() {
    super('Não há aprovador definido para você. Peça ao Financeiro para cadastrar '
      + 'seu fluxo ou seu gestor no organograma.');
    this.name = 'SemAprovadorFinError';
  }
}

/**
 * A faixa exige um papel que existe na empresa, mas não acima do solicitante.
 * Bloqueia: seguir mandaria o pedido para um gestor de outra área.
 */
export class PapelForaDaCadeiaFinError extends Error {
  constructor(papeis = []) {
    const nomes = papeis.map((p) => PAPEL_LABEL[p] || p).join(', ');
    super(`Este pedido precisa da aprovação de ${nomes}, mas não há ninguém com essa `
      + 'função acima de você no organograma. Peça ao Financeiro para ajustar o '
      + 'organograma antes de reenviar.');
    this.name = 'PapelForaDaCadeiaFinError';
  }
}

/** Escada do organograma: superior direto → gerente acima dele. */
async function escadaDoSolicitante(solicitanteId) {
  const { data, error } = await supabase.rpc('chamados_adm_cadeia', { p_solicitante: solicitanteId });
  if (error) throw new Error(`Não foi possível ler o organograma: ${error.message}`);
  return escadaDoOrganograma(data || []);
}

/**
 * Quem aprova ANTES da faixa de valor, já com nome e papel para a tela.
 * Exceção cadastrada em Fluxos manda em tudo; na falta dela, o organograma.
 *
 * @returns {Promise<{origem: 'cadastro'|'organograma', pessoas: Array<{id, nome, papel}>}>}
 */
export async function cabecaDaCadeiaFin(solicitanteId, tipo) {
  const { fluxo, erro } = await buscarFluxoFin(solicitanteId, tipo);
  if (erro) throw new Error('Não foi possível consultar o fluxo de aprovação. Tente novamente.');

  const ids = (Array.isArray(fluxo?.aprovadores) ? fluxo.aprovadores : [])
    .map((x) => (x || '').toString().trim())
    .filter(Boolean);

  if (ids.length) {
    const { data } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
    const nomes = new Map((data || []).map((p) => [p.id, p.nome]));
    return {
      origem: 'cadastro',
      pessoas: ids.map((id) => ({ id, nome: nomes.get(id) || '—', papel: 'Aprovador cadastrado' })),
    };
  }

  return { origem: 'organograma', pessoas: await escadaDoSolicitante(solicitanteId) };
}

/**
 * Topo da hierarquia não tem superior — e isso não é lacuna de cadastro.
 * Checado pelo papel (CEO), não por nome: acompanha troca de ocupante.
 */
export async function ehTopoDaHierarquiaFin(solicitanteId) {
  const { etapas } = await resolverPapeis(solicitanteId, ['CEO']);
  return etapas.some((e) => e.aprovadorId === solicitanteId
    || e.candidatos?.some((c) => c.id === solicitanteId));
}

/**
 * O que a FAIXA DE VALOR exige, já com as pessoas resolvidas.
 * Separado da cabeça da cadeia porque a tela mostra os dois em momentos
 * diferentes: o gestor aparece assim que a pessoa abre o formulário, e os
 * aprovadores de faixa entram quando ela informa o valor.
 */
export async function alcadaDoValorFin(solicitanteId, valor) {
  const decisao = avaliarAlcada({ tabela: TABELA_FIN, valor: Number(valor) || 0 });
  const { etapas, lacunas } = await resolverPapeis(solicitanteId, decisao.papeis);
  return { decisao, etapasAlcada: etapas, lacunas, foraDaCadeia: papeisForaDaCadeia(etapas) };
}

/**
 * As faixas da tabela, para a tela dizer o que ENTRA se o valor subir — sem
 * repetir os números à mão (eles moram em config/alcadas.js).
 *
 * @returns {Array<{nivel, ate: number, rotulo: string, exigePapeis: boolean}>}
 */
export function faixasFin() {
  return TABELAS[TABELA_FIN].map((f) => ({
    nivel: f.nivel,
    ate: f.ate,
    rotulo: f.rotulo,
    exigePapeis: f.papeis.length > 0,
  }));
}

/**
 * A cadeia inteira que valeria HOJE para este solicitante e este valor.
 *
 * Usada pela PRÉVIA na tela e pela CRIAÇÃO da solicitação — as duas pelo mesmo
 * caminho, senão a prévia viraria documentação errada de si mesma. Quem decide
 * o que é bloqueio é o chamador: aqui só devolvemos o diagnóstico.
 *
 * @returns {Promise<{cabeca, decisao, etapasAlcada, lacunas, foraDaCadeia}>}
 */
export async function montarCadeiaFin({ solicitanteId, tipo, valor }) {
  const [cabeca, alcada] = await Promise.all([
    cabecaDaCadeiaFin(solicitanteId, tipo),
    alcadaDoValorFin(solicitanteId, valor),
  ]);
  return { cabeca, ...alcada };
}
