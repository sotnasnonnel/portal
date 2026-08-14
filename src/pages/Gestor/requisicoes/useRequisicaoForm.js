import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import { getEquipeIds } from '../../../services/equipe';
import { notificarAprovadorSolic } from '../../../services/notificarAprovadorSolic';
import { buscarFluxoGeral, buscarFluxoPorTipo, montarEtapasDeConfig } from '../../../config/aprovacao';
import { aprovadoresGenteCultura, registrarAuditoria, PapelNaoAtribuidoError } from '../../../services/alcadas';

/**
 * Lógica compartilhada entre os formulários de requisição:
 * carrega a equipe do gestor, pré-checa se o admin configurou o fluxo de cada
 * caso, e cria a solicitação + etapas de forma atômica (delete compensatório).
 */
export function useRequisicaoForm() {
  const { user } = useAuth();
  const [equipe, setEquipe] = useState([]);
  const [loadingEquipe, setLoadingEquipe] = useState(true);
  const [fluxoOk, setFluxoOk] = useState(null); // null = ainda não checado; true/false após checagem
  const [submitting, setSubmitting] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (!user?.id) return undefined;
    let vivo = true;
    (async () => {
      setLoadingEquipe(true);
      const ids = await getEquipeIds().catch(() => []);
      const { data } = ids.length
        ? await supabase
            .from('colaboradores')
            .select('id, nome, funcao, salario')
            .in('id', ids)
            .eq('ativo', true)
            .order('nome')
        : { data: [] };
      if (vivo) { setEquipe(data || []); setLoadingEquipe(false); }
    })();
    return () => { vivo = false; };
  }, [user]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let vivo = true;
    (async () => {
      const { fluxo, erro } = await buscarFluxoGeral(supabase, user.id);
      // Em erro de rede, não bloqueia (assume desconhecido = true).
      if (vivo) setFluxoOk(erro ? true : !!fluxo);
    })();
    return () => { vivo = false; };
  }, [user, bump]);

  const refetchFluxo = useCallback(() => setBump((b) => b + 1), []);

  // Resolve a cadeia do tipo: ids ordenados + nomes (snapshot do papel).
  const resolverCadeia = useCallback(async (tipo) => {
    const { fluxo, erro } = await buscarFluxoPorTipo(supabase, user.id, tipo);
    if (erro) throw new Error('Erro ao consultar o fluxo de aprovação. Tente novamente.');
    if (!fluxo) throw new Error('SEM_FLUXO');
    const ids = (Array.isArray(fluxo.aprovadores) ? fluxo.aprovadores : [])
      .map((x) => (x || '').trim()).filter(Boolean);
    let nomePorId = {};
    if (ids.length) {
      const { data: cols, error: e } = await supabase
        .rpc('nomes_colaboradores', { p_ids: ids });
      if (e) throw e;
      nomePorId = Object.fromEntries((cols || []).map((c) => [c.id, c.nome]));
    }
    return { ids, nomePorId };
  }, [user]);

  /**
   * §5 — acrescenta à cadeia configurada os aprovadores exigidos pela alçada de
   * Gente & Cultura (liderança Backoffice→CEO / Operação→COO, vaga fora do
   * quadro, e a Trava Headcount do §5.3, que põe o Nery ao final).
   *
   * Sem regra para o caso (ajuda de custo, mapeamento, alvo que não é
   * liderança), devolve a cadeia intacta — o comportamento de antes.
   * `alcada` volta junto para virar trilha de auditoria depois de criar.
   */
  const aplicarAlcadaGC = useCallback(async (cadeia, { tipo, funcaoAlvo, alvoId, foraDoQuadro }) => {
    const { aprovadores, lacunas, decisao } = await aprovadoresGenteCultura({
      tipoDp: tipo, funcaoAlvo, alvoId, solicitanteId: user.id, foraDoQuadro,
    });
    if (lacunas.length) throw new PapelNaoAtribuidoError(lacunas);
    if (!aprovadores.length) return { ...cadeia, alcada: decisao };

    // Dedup: quem já está na cadeia configurada não aprova duas vezes.
    const ids = [...cadeia.ids];
    const nomePorId = { ...cadeia.nomePorId };
    const vistos = new Set(ids.map((i) => (i || '').toLowerCase()));
    for (const a of aprovadores) {
      const k = a.id.toLowerCase();
      if (vistos.has(k)) continue;
      vistos.add(k);
      ids.push(a.id);
      nomePorId[a.id] = a.nome;
    }
    return { ids, nomePorId, alcada: decisao };
  }, [user]);

  // Cargo do alvo: quando a requisição é sobre alguém da equipe, o cargo vem do
  // cadastro — é ele que decide se a alçada de liderança (§5) entra ou não.
  const funcaoDaEquipe = useCallback(
    (colaboradorId) => equipe.find((c) => c.id === colaboradorId)?.funcao || null,
    [equipe],
  );

  // Trilha de auditoria da decisão de alçada (§6, pilar 4). Best-effort.
  const auditarAlcada = useCallback((solicitacaoId, tipo, decisao) => {
    if (!decisao) return;
    registrarAuditoria({
      modulo: 'dp',
      solicitacao_id: solicitacaoId,
      tipo,
      evento: decisao.alertaDiretoria ? 'excecao' : 'classificacao',
      ator_id: user.id,
      ator_nome: user.nome || null,
      alcada_tabela: 'gente_cultura',
      excecoes: decisao.excecoes || [],
      observacao: `${decisao.rotuloNivel}${decisao.area ? ` · área ${decisao.area}` : ''}`,
    });
  }, [user]);

  const criarComFluxo = useCallback(async (tipo, iniciativa, dadosSolicitacao, alcadaCtx = {}) => {
    // O fluxo é o geral do gestor; tipo/iniciativa seguem só no registro da solicitação.
    const base = await resolverCadeia(tipo);
    const { ids, nomePorId, alcada } = await aplicarAlcadaGC(base, {
      tipo,
      alvoId: dadosSolicitacao.colaborador_id || null,
      funcaoAlvo: alcadaCtx.funcaoAlvo ?? funcaoDaEquipe(dadosSolicitacao.colaborador_id),
      foraDoQuadro: alcadaCtx.foraDoQuadro,
    });

    const { data: sol, error: eSol } = await supabase
      .from('solicitacoes_rh').insert([dadosSolicitacao]).select('id').single();
    if (eSol) throw eSol;

    try {
      const linhas = montarEtapasDeConfig(sol.id, ids, user.id, nomePorId);
      const { error: eEt } = await supabase.from('solicitacoes_rh_etapas').insert(linhas);
      if (eEt) throw eEt;
    } catch (err) {
      await supabase.from('solicitacoes_rh').delete().eq('id', sol.id);
      throw err;
    }
    auditarAlcada(sol.id, tipo, alcada);
    notificarAprovadorSolic(sol.id);
    window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    return sol.id;
  }, [resolverCadeia, aplicarAlcadaGC, funcaoDaEquipe, auditarAlcada, user]);

  // Cria requisição com tabela de detalhe: envelope + etapas + detalhe (atômico).
  // `cadeia` ({ ids, nomePorId }) substitui o fluxo configurado do gestor quando
  // a requisição tem aprovador fixo (ex.: Mapeamento → Lucas Ferraz).
  const criarComDetalhe = useCallback(async ({
    tipo, justificativa, tabela, detalhe, colaboradorId = null, cadeia = null,
    funcaoAlvo = null, foraDoQuadro = false, origemSolicitacaoId = null,
  }) => {
    const base = cadeia || await resolverCadeia(tipo);
    const { ids, nomePorId, alcada } = await aplicarAlcadaGC(base, {
      tipo,
      alvoId: colaboradorId,
      funcaoAlvo: funcaoAlvo ?? funcaoDaEquipe(colaboradorId),
      foraDoQuadro,
    });

    const { data: sol, error: eSol } = await supabase
      .from('solicitacoes_rh').insert([{
        tipo,
        gestor_id: user.id,
        colaborador_id: colaboradorId,
        justificativa,
        status: 'pendente',
        origem_solicitacao_id: origemSolicitacaoId,   // vínculo Mapeamento -> Nova Vaga
      }]).select('id').single();
    if (eSol) throw eSol;

    try {
      const linhas = montarEtapasDeConfig(sol.id, ids, user.id, nomePorId);
      const { error: eEt } = await supabase.from('solicitacoes_rh_etapas').insert(linhas);
      if (eEt) throw eEt;
    } catch (err) {
      await supabase.from('solicitacoes_rh').delete().eq('id', sol.id);
      throw err;
    }

    const { error: eDet } = await supabase
      .from(tabela).insert([{ ...detalhe, solicitacao_id: sol.id }]);
    if (eDet) {
      // Desfaz envelope + etapas para não deixar órfão.
      await supabase.from('solicitacoes_rh_etapas').delete().eq('solicitacao_id', sol.id);
      await supabase.from('solicitacoes_rh').delete().eq('id', sol.id);
      throw eDet;
    }

    auditarAlcada(sol.id, tipo, alcada);
    notificarAprovadorSolic(sol.id);
    window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    return sol.id;
  }, [resolverCadeia, aplicarAlcadaGC, funcaoDaEquipe, auditarAlcada, user]);

  /**
   * O solicitante RESPONDE a uma requisição REPROVADA: aplica os ajustes e a
   * requisição volta para a decisão de QUEM REPROVOU (não recomeça a cadeia).
   * Reabre a etapa reprovada como 'pendente'; as anteriores seguem aprovadas e
   * as seguintes, pendentes. O aprovador que reprovou reavalia (aprova ou
   * reprova de novo).
   */
  const responderRequisicao = useCallback(async ({
    solicitacaoId, etapaReprovadaId, reenviosAtual = 0,
    detalheTabela = null, detalhe = null, envelopePatch = null,
  }) => {
    if (!etapaReprovadaId) throw new Error('Não foi possível localizar a etapa reprovada. Atualize a página.');

    // 1) grava os ajustes do solicitante.
    // Pedimos a linha de volta (.select) e exigimos que venha: quando a RLS
    // barra um UPDATE, o Postgres NÃO devolve erro — devolve zero linhas. Sem
    // isso, os ajustes se perderiam em silêncio e a requisição voltaria ao
    // aprovador com o conteúdo antigo, como se tivesse sido corrigida.
    if (detalheTabela && detalhe) {
      const { data, error } = await supabase
        .from(detalheTabela).update(detalhe).eq('solicitacao_id', solicitacaoId)
        .select('solicitacao_id');
      if (error) throw error;
      if (!data?.length) throw new Error('Não foi possível salvar os ajustes: você não tem permissão para editar esta requisição.');
    }
    if (envelopePatch) {
      const { data, error } = await supabase
        .from('solicitacoes_rh').update(envelopePatch).eq('id', solicitacaoId)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Não foi possível salvar os ajustes: você não tem permissão para editar esta requisição.');
    }

    // 2) reabre a etapa de quem reprovou (guarda: só se ainda estiver 'reprovada').
    const agora = new Date().toISOString();
    const { data, error } = await supabase
      .from('solicitacoes_rh_etapas')
      .update({ status: 'pendente', justificativa: null, decidido_em: null })
      .eq('id', etapaReprovadaId)
      .eq('status', 'reprovada')
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Esta requisição já foi retomada. Atualize a página.');

    // 3) requisição volta a 'pendente'. Mesma guarda de linhas do passo 1: aqui
    // a etapa JÁ foi reaberta, então uma falha silenciosa deixaria a etapa
    // pendente com o envelope ainda 'reprovada'.
    const { data: env, error: e2 } = await supabase
      .from('solicitacoes_rh')
      .update({ status: 'pendente', reenvios: (reenviosAtual || 0) + 1, updated_at: agora })
      .eq('id', solicitacaoId)
      .select('id');
    if (e2) throw e2;
    if (!env?.length) throw new Error('Os ajustes foram salvos, mas a requisição não voltou para análise. Avise o DP.');

    notificarAprovadorSolic(solicitacaoId);   // avisa quem reprovou que voltou
    window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
  }, []);

  /**
   * O solicitante EDITA a própria requisição enquanto ela está EM ANDAMENTO.
   * Diferente de responderRequisicao (reprovada → volta só a quem reprovou),
   * aqui a cadeia RECOMEÇA do primeiro aprovador: o conteúdo mudou, então as
   * aprovações já dadas ficam obsoletas.
   *
   * A cadeia é reconstruída pela MESMA via da criação (resolverCadeia +
   * aplicarAlcadaGC), então se o ajuste muda o que define a alçada (ex.: a
   * função proposta numa Movimentação), os aprovadores certos entram e saem.
   *
   * A troca das etapas + volta para 'pendente' é atômica na RPC, que revalida
   * dono e status no banco. A pré-checagem de status aqui é só para falhar
   * cedo, ANTES de gravar os ajustes, se alguém decidiu enquanto o modal estava
   * aberto — quem decide de verdade é a RPC.
   */
  const editarRequisicao = useCallback(async ({
    solicitacaoId, tipo, motivo = null, colaboradorId = null, funcaoAlvo = null, foraDoQuadro = false,
    detalheTabela = null, detalhe = null, envelopePatch = null,
  }) => {
    const { data: atual, error: eSel } = await supabase
      .from('solicitacoes_rh').select('status').eq('id', solicitacaoId).maybeSingle();
    if (eSel) throw eSel;
    if (!atual) throw new Error('Requisição não encontrada. Atualize a página.');
    if (atual.status !== 'pendente') {
      throw new Error('Esta requisição não está mais em andamento — não é possível editá-la. Atualize a página.');
    }

    // 1) grava os ajustes ANTES de recalcular a cadeia (a alçada depende deles).
    // Pedimos a linha de volta (.select) e exigimos que venha: quando a RLS
    // barra um UPDATE, o Postgres NÃO devolve erro — devolve zero linhas.
    if (detalheTabela && detalhe) {
      const { data, error } = await supabase
        .from(detalheTabela).update(detalhe).eq('solicitacao_id', solicitacaoId)
        .select('solicitacao_id');
      if (error) throw error;
      if (!data?.length) throw new Error('Não foi possível salvar os ajustes: você não tem permissão para editar esta requisição.');
    }
    if (envelopePatch) {
      const { data, error } = await supabase
        .from('solicitacoes_rh').update(envelopePatch).eq('id', solicitacaoId)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Não foi possível salvar os ajustes: você não tem permissão para editar esta requisição.');
    }

    // 2) reconstrói a cadeia (fluxo configurado + alçada §5) para o conteúdo novo.
    const base = await resolverCadeia(tipo);
    const { ids, nomePorId, alcada } = await aplicarAlcadaGC(base, {
      tipo, alvoId: colaboradorId, funcaoAlvo: funcaoAlvo ?? funcaoDaEquipe(colaboradorId), foraDoQuadro,
    });
    const linhas = montarEtapasDeConfig(solicitacaoId, ids, user.id, nomePorId);

    // 3) troca atômica das etapas + volta para 'pendente' + rastro da edição.
    const { error: eRpc } = await supabase.rpc('reenviar_requisicao_rh', {
      p_sol: solicitacaoId, p_etapas: linhas, p_motivo: motivo,
    });
    if (eRpc) throw eRpc;

    auditarAlcada(solicitacaoId, tipo, alcada);
    notificarAprovadorSolic(solicitacaoId);   // avisa o 1º aprovador da cadeia nova
    window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
  }, [resolverCadeia, aplicarAlcadaGC, funcaoDaEquipe, auditarAlcada, user]);

  // Cria a requisição do Formulário de Contratação (envelope + detalhe).
  // O cargo proposto (cargo_nivel) é o que define a alçada: contratar uma
  // liderança exige CEO/COO, e alta liderança aciona a Trava Headcount (§5.3).
  const criarFormularioContratacao = useCallback(async (respostas) => {
    const resumo = `Formalização de admissão: ${respostas.nome_profissional || '—'}`
      + (respostas.cargo_nivel ? ` — ${respostas.cargo_nivel}` : '');
    return criarComDetalhe({
      tipo: 'formulario_contratacao',
      justificativa: resumo,
      tabela: 'formularios_contratacao',
      detalhe: respostas,
      funcaoAlvo: respostas.cargo_nivel || null,
    });
  }, [criarComDetalhe]);

  return { user, equipe, loadingEquipe, fluxoOk, submitting, setSubmitting, criarComFluxo, criarComDetalhe, criarFormularioContratacao, responderRequisicao, editarRequisicao, refetchFluxo };
}
