import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import { getEquipeIds } from '../../../services/equipe';
import { notificarAprovadorSolic } from '../../../services/notificarAprovadorSolic';
import { buscarFluxoGeral, buscarFluxoPorTipo, montarEtapasDeConfig } from '../../../config/aprovacao';

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

  const criarComFluxo = useCallback(async (tipo, iniciativa, dadosSolicitacao) => {
    // O fluxo é o geral do gestor; tipo/iniciativa seguem só no registro da solicitação.
    const { ids, nomePorId } = await resolverCadeia(tipo);

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
    notificarAprovadorSolic(sol.id);
    window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    return sol.id;
  }, [resolverCadeia, user]);

  // Cria requisição com tabela de detalhe: envelope + etapas + detalhe (atômico).
  // `cadeia` ({ ids, nomePorId }) substitui o fluxo configurado do gestor quando
  // a requisição tem aprovador fixo (ex.: Mapeamento → Lucas Ferraz).
  const criarComDetalhe = useCallback(async ({ tipo, justificativa, tabela, detalhe, colaboradorId = null, cadeia = null }) => {
    const { ids, nomePorId } = cadeia || await resolverCadeia(tipo);

    const { data: sol, error: eSol } = await supabase
      .from('solicitacoes_rh').insert([{
        tipo,
        gestor_id: user.id,
        colaborador_id: colaboradorId,
        justificativa,
        status: 'pendente',
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

    notificarAprovadorSolic(sol.id);
    window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    return sol.id;
  }, [resolverCadeia, user]);

  // Cria a requisição do Formulário de Contratação (envelope + detalhe).
  const criarFormularioContratacao = useCallback(async (respostas) => {
    const resumo = `Formalização de admissão: ${respostas.nome_profissional || '—'}`
      + (respostas.cargo_nivel ? ` — ${respostas.cargo_nivel}` : '');
    return criarComDetalhe({
      tipo: 'formulario_contratacao',
      justificativa: resumo,
      tabela: 'formularios_contratacao',
      detalhe: respostas,
    });
  }, [criarComDetalhe]);

  return { user, equipe, loadingEquipe, fluxoOk, submitting, setSubmitting, criarComFluxo, criarComDetalhe, criarFormularioContratacao, refetchFluxo };
}
