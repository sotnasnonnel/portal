// ===== Ponte entre o motor de alçadas (regras) e o banco (pessoas) =====
//
// src/config/alcadas.js decide QUE PAPÉIS precisam aprovar. Este arquivo
// traduz papel -> pessoa (RPC alcadas_resolver_papeis) e grava a trilha de
// auditoria (§6, pilar 4). Nada de regra de negócio mora aqui.
import { supabase } from './supabase';
import { PAPEL_LABEL, casoGenteCultura, avaliarGenteCultura } from '../config/alcadas';

/** Erro de bloqueio: papéis exigidos pela alçada que não têm ninguém atrás. */
export class PapelNaoAtribuidoError extends Error {
  constructor(papeis) {
    const nomes = papeis.map((p) => PAPEL_LABEL[p] || p).join(', ');
    super(
      `Esta solicitação exige aprovação de ${nomes}, mas não há ninguém atribuído a ` +
      `${papeis.length > 1 ? 'esses papéis' : 'esse papel'}. Peça ao Financeiro para ` +
      'configurar em Alçadas → Papéis antes de enviar.'
    );
    this.name = 'PapelNaoAtribuidoError';
    this.papeis = papeis;
  }
}

/**
 * Traduz os papéis exigidos em pessoas, na ordem em que foram pedidos.
 *
 * Papéis de GRUPO (FINANCEIRO, RH, JURIDICO, CONSELHO, e GERENTE_EXECUTIVO
 * quando resolvido pela tabela de papéis) podem devolver várias pessoas para o
 * mesmo `seq`. Nesse caso viram UMA etapa de aprovador aberto — qualquer um do
 * grupo age — em vez de N etapas em série.
 *
 * @returns {Promise<{etapas: Array, lacunas: string[]}>}
 *   etapas: [{ papel, aprovadorId|null, nome, candidatos: [{id,nome,email}] }]
 *   lacunas: papéis sem ninguém atribuído (bloqueiam a criação, §6 pilar 3)
 */
export async function resolverPapeis(solicitanteId, papeis) {
  if (!papeis?.length) return { etapas: [], lacunas: [] };

  const { data, error } = await supabase.rpc('alcadas_resolver_papeis', {
    p_solicitante: solicitanteId,
    p_papeis: papeis,
  });
  if (error) throw error;

  // Agrupa por seq: cada seq é um papel pedido, com 1..N candidatos.
  const porSeq = new Map();
  for (const linha of data || []) {
    if (!porSeq.has(linha.seq)) porSeq.set(linha.seq, { papel: linha.papel, candidatos: [] });
    if (linha.colaborador_id) {
      porSeq.get(linha.seq).candidatos.push({
        id: linha.colaborador_id, nome: linha.nome, email: linha.email, origem: linha.origem,
      });
    }
  }

  const lacunas = [];
  const etapas = [];
  for (const seq of [...porSeq.keys()].sort((a, b) => a - b)) {
    const { papel, candidatos } = porSeq.get(seq);
    if (candidatos.length === 0) { lacunas.push(papel); continue; }
    etapas.push(
      candidatos.length === 1
        ? { papel, aprovadorId: candidatos[0].id, nome: candidatos[0].nome, candidatos }
        // Grupo: etapa aberta (aprovador_id null) — quem agir primeiro resolve.
        : { papel, aprovadorId: null, nome: PAPEL_LABEL[papel] || papel, candidatos }
    );
  }
  return { etapas, lacunas };
}

/**
 * Converte a decisão do motor + os papéis resolvidos em linhas de
 * `solicitacoes_financeiro_etapas`, já na ordem correta:
 *   cadeia configurada -> papéis da alçada -> parecer jurídico -> execução.
 *
 * O parecer entra ANTES da execução porque §3.3 exige o parecer "antes da
 * assinatura" — ou seja, antes de o Financeiro efetivar.
 *
 * @param {object} p
 * @param {string} p.solicitacaoId
 * @param {Array}  p.etapasCadeia   etapas da cadeia configurada em Fluxos ([{aprovadorId, nome}])
 * @param {Array}  p.etapasAlcada   saída de resolverPapeis para decisao.papeis
 * @param {Array}  p.etapasParecer  saída de resolverPapeis para decisao.pareceres
 * @param {string} p.criadorId      aplica auto-aprovação na etapa do próprio criador
 */
export function montarEtapasAlcada({ solicitacaoId, etapasCadeia = [], etapasAlcada = [], etapasParecer = [], criadorId }) {
  const agora = new Date().toISOString();
  const criador = (criadorId || '').toLowerCase();
  const linhas = [];
  const jaNaCadeia = new Set();

  const push = (e, tipoEtapa) => {
    // Dedup por pessoa: quem já aparece antes não aprova duas vezes seguidas.
    // Etapas de grupo (aprovadorId null) nunca deduplicam entre si.
    const chave = e.aprovadorId ? e.aprovadorId.toLowerCase() : `grupo:${e.papel}`;
    if (jaNaCadeia.has(chave)) return;
    jaNaCadeia.add(chave);

    const autoAprova = tipoEtapa === 'aprovacao' && !!e.aprovadorId && e.aprovadorId.toLowerCase() === criador;
    linhas.push({
      solicitacao_id: solicitacaoId,
      ordem: linhas.length + 1,
      aprovador_id: e.aprovadorId || null,
      papel: e.nome,
      papel_codigo: e.papel || null,
      tipo_etapa: tipoEtapa,
      status: autoAprova ? 'auto_aprovada' : 'pendente',
      decidido_em: autoAprova ? agora : null,
    });
  };

  etapasCadeia.forEach((e) => push(e, 'aprovacao'));
  etapasAlcada.forEach((e) => push(e, 'aprovacao'));
  // Parecer não deduplica contra aprovação: o Jurídico opina mesmo que já
  // tenha aprovado antes em outro papel.
  etapasParecer.forEach((e) => {
    linhas.push({
      solicitacao_id: solicitacaoId,
      ordem: linhas.length + 1,
      aprovador_id: e.aprovadorId || null,
      papel: `Parecer — ${e.nome}`,
      papel_codigo: e.papel || null,
      tipo_etapa: 'parecer',
      status: 'pendente',
      decidido_em: null,
    });
  });

  linhas.push({
    solicitacao_id: solicitacaoId,
    ordem: linhas.length + 1,
    aprovador_id: null,
    papel: 'Financeiro (execução)',
    papel_codigo: 'FINANCEIRO',
    tipo_etapa: 'execucao',
    status: 'pendente',
    decidido_em: null,
  });

  return linhas;
}

/**
 * §5 — Aprovadores exigidos por uma requisição do DP (Gente & Cultura).
 *
 * Devolve os aprovadores a ACRESCENTAR à cadeia configurada do gestor. Se o
 * tipo não tem regra no documento (ajuda de custo, mapeamento) ou o alvo não é
 * liderança, devolve lista vazia e o fluxo segue como sempre foi.
 *
 * ⚠️ `colapsarGrupos`: as etapas do DP (`solicitacoes_rh_etapas`) não têm
 * `papel_codigo`, e `acaoDisponivel` só casa por `aprovador_id` — uma etapa de
 * grupo com aprovador nulo travaria o fluxo, sem ninguém habilitado a agir.
 * Por isso, no DP, um papel de grupo (RH, Financeiro) colapsa na PRIMEIRA
 * pessoa do grupo, nomeada. O papel fica registrado no texto da etapa.
 *
 * @param {object} p
 * @param {string} p.tipoDp        tipo em solicitacoes_rh
 * @param {string} p.funcaoAlvo    cargo do alvo (colaborador existente ou vaga)
 * @param {string} [p.alvoId]      colaborador alvo, quando já existe
 * @param {string} p.solicitanteId gestor que abriu a requisição
 * @param {boolean} [p.foraDoQuadro] Nova Vaga fora do headcount
 */
export async function aprovadoresGenteCultura({
  tipoDp, funcaoAlvo, alvoId, solicitanteId, foraDoQuadro = false,
}) {
  const caso = casoGenteCultura(tipoDp, funcaoAlvo, foraDoQuadro);
  if (!caso) return { aprovadores: [], lacunas: [], decisao: null };

  // Área do ALVO quando ele já existe; senão a de quem pede (numa vaga nova, a
  // área da vaga é a de quem a está abrindo).
  let area = null;
  const { data, error } = await supabase.rpc('alcadas_area_colaborador', {
    p_id: alvoId || solicitanteId,
  });
  if (!error) area = data;

  const decisao = avaliarGenteCultura({ ...caso, area });
  const { etapas, lacunas } = await resolverPapeis(solicitanteId, decisao.papeis);

  const aprovadores = etapas.map((e) => ({
    id: e.aprovadorId || e.candidatos[0]?.id || null,
    nome: e.aprovadorId
      ? e.nome
      : `${e.candidatos[0]?.nome || e.nome} — ${PAPEL_LABEL[e.papel] || e.papel}`,
    papel: e.papel,
  })).filter((a) => a.id);

  return { aprovadores, lacunas, decisao };
}

/**
 * Papéis que o usuário logado detém — usado por `acaoDisponivelFin` para
 * decidir se ele pode agir numa etapa de GRUPO (aprovador_id null).
 *
 * FINANCEIRO e RH não moram em alcadas_papeis: vêm das colunas que já
 * existiam (`financeiro_role`, `rh_dp`). Somamos os três para o front ter uma
 * lista só.
 */
export async function meusPapeisAlcada(colaboradorId, { financeiroRole, rhDp } = {}) {
  const papeis = [];
  if (financeiroRole === 'admin') papeis.push('FINANCEIRO');
  if (rhDp) papeis.push('RH');
  if (!colaboradorId) return papeis;

  const { data, error } = await supabase
    .from('alcadas_papeis').select('papel').eq('colaborador_id', colaboradorId);
  if (error) {
    console.warn('[alcadas] não foi possível ler os papéis do usuário:', error.message);
    return papeis;
  }
  for (const r of data || []) if (!papeis.includes(r.papel)) papeis.push(r.papel);
  return papeis;
}

/**
 * Grava um evento na trilha de auditoria (§6, pilar 4).
 * Best-effort: a trilha nunca pode derrubar a operação que ela audita — mas a
 * falha é logada para não passar despercebida.
 */
export async function registrarAuditoria(evento) {
  const { error } = await supabase.from('alcadas_auditoria').insert([evento]);
  if (error) console.warn('[alcadas-auditoria] falhou:', error.message, evento.evento);
  return !error;
}