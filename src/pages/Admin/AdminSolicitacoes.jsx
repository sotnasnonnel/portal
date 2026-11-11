import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { formatarMoeda } from '../../utils/formatters';
import {
  FileText, Check, X, CheckCheck,
  Loader2, Trash2, Wrench, FastForward, History, ChevronDown, Ban, Search, Send,
  FolderKanban, Briefcase, LayoutList,
} from 'lucide-react';
import FluxoTimeline from '../../components/Solicitacoes/FluxoTimeline';
import {
  APROVADORES, etapaAtual, acaoDisponivel, resumoAndamento, badgeDeStatus,
  INICIATIVA_LABEL, TIPO_LABEL, TIPO_LABEL_CURTO,
} from '../../config/aprovacao';
import ModalRespostas, { DETALHE, buscarRespostas } from '../Gestor/requisicoes/ModalRespostas';
import BotaoPdfRequisicao from '../../components/BotaoPdfRequisicao';
import EnviarConhecimentoModal from './EnviarConhecimentoModal';
import { REQUISICOES } from '../../config/requisicoes';
import { agruparPorProjeto, funcaoDaRequisicao, nomeProjeto, normalizarCodigo } from '../Gestor/requisicoes/projetos';
import { carregarDetalhesLista, carregarResolvedorProjeto } from '../Gestor/requisicoes/detalhesRequisicoes';
import { notificarAprovadorSolic } from '../../services/notificarAprovadorSolic';
import { notificarSolicitanteReprovacao } from '../../services/notificarSolicitanteReprovacao';
import '../../components/UI/Components.css';
import '../Gestor/requisicoes/Requisicoes.css';
import './Admin.css';

const SELECT_SOL = `
  id, numero, tipo, status, iniciativa, gestor_id, colaborador_id, justificativa, salario_proposto, funcao_proposta, cargo_proposto, created_at, concluida_em,
  reenvios, edicao_motivo, edicao_em,
  colaborador:colaborador_id ( id, nome, funcao, salario ),
  gestor:gestor_id ( nome ),
  etapas:solicitacoes_rh_etapas ( id, ordem, aprovador_id, papel, tipo_etapa, status, justificativa, decidido_em ),
  ciencias:solicitacoes_rh_ciencia ( id, destinatario_id, enviado_em, ciente_em, destinatario:destinatario_id ( nome ) )
`;

/** Normaliza para busca: sem acento, sem caixa. */
const semAcento = (t) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Ícone de cada tipo nos filtros: o mesmo da tela de nova requisição.
const ICONE_TIPO = Object.fromEntries(REQUISICOES.filter((r) => r.tipoDb).map((r) => [r.tipoDb, r.icon]));

export default function AdminSolicitacoes() {
  const { user, markSolicVisto } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busca, setBusca] = useState('');
  const [acaoId, setAcaoId] = useState(null);
  const [decisao, setDecisao] = useState(null); // { sol, modo: 'aprovar' | 'reprovar' }
  const [comentario, setComentario] = useState('');
  const [verRespostas, setVerRespostas] = useState(null);
  const [solRespostas, setSolRespostas] = useState(null);
  const [expandido, setExpandido] = useState(() => new Set());
  const [detalhes, setDetalhes] = useState({});       // solicitacao_id -> função/projeto/profissional
  const [resolverProjeto, setResolverProjeto] = useState(null); // código -> { completo, cliente }
  const [gruposFechados, setGruposFechados] = useState(() => new Set());
  const seededRef = useRef(false);

  const toggleCard = (id) => setExpandido((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Escape hatch (fluxo travado): reatribuir a etapa atual a outra pessoa.
  const [poolReatribuir, setPoolReatribuir] = useState([]); // colaboradores ativos (gestor/admin)
  const [reatribuirSol, setReatribuirSol] = useState(null);
  const [reatribuirId, setReatribuirId] = useState('');

  // "Enviar para conhecimento" (só desligamento): ADM, TI etc. escolhidos pelo DP.
  const [conhecimentoSol, setConhecimentoSol] = useState(null);

  useEffect(() => {
    markSolicVisto?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    supabase
      .from('colaboradores')
      .select('id, nome, perfil')
      .in('perfil', ['gestor', 'admin'])
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setPoolReatribuir(data || []));
  }, []);

  const fetchSolicitacoes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('solicitacoes_rh')
        .select(SELECT_SOL)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDetalhes(await carregarDetalhesLista(data || []).catch(() => ({})));
      setSolicitacoes(data || []);
    } catch (err) {
      console.error('Erro ao buscar solicitações:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSolicitacoes();
    const handle = () => fetchSolicitacoes();
    window.addEventListener('solicitacoes_rh_atualizadas', handle);
    return () => window.removeEventListener('solicitacoes_rh_atualizadas', handle);
  }, [fetchSolicitacoes]);

  // Nome dos projetos (cliente + código completo): uma vez por visita.
  useEffect(() => {
    let vivo = true;
    carregarResolvedorProjeto()
      .then((fn) => { if (vivo) setResolverProjeto(() => fn); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  // Semeia UMA vez: abre expandidas as solicitações que aguardam a ação do admin.
  useEffect(() => {
    if (seededRef.current || solicitacoes.length === 0) return;
    seededRef.current = true;
    setExpandido(new Set(
      solicitacoes
        .filter((s) => acaoDisponivel(APROVADORES.admin, s.etapas) !== null)
        .map((s) => s.id)
    ));
  }, [solicitacoes]);

  // filtroStatus: 'todos' | 'pendente' | 'historico' (concluídas+reprovadas) | 'concluida' | 'reprovada'
  // Busca sem acento e sem caixa: quem procura "brandao" precisa achar
  // "BRANDÃO". Cobre o colaborador, quem abriu e o número da solicitação —
  // é por um desses três que se procura uma requisição específica.
  const termo = semAcento(busca).trim();
  // Também acha pelo código do projeto, pela função e pelo profissional da
  // contratação (que não tem colaborador_id).
  const semTipo = solicitacoes.filter((s) => {
    const matchStatus = filtroStatus === 'todos'
      ? true
      : filtroStatus === 'historico'
        ? s.status !== 'pendente'
        : s.status === filtroStatus;
    const d = detalhes[s.id];
    const matchBusca = !termo || [
      s.colaborador?.nome, s.gestor?.nome, s.numero != null ? `#${s.numero}` : '',
      d?.nome_profissional, d?.codigo_proposta_projeto, funcaoDaRequisicao(s, d),
    ].some((campo) => semAcento(campo).includes(termo));
    return matchStatus && matchBusca;
  });
  // Os chips de tipo contam dentro do status e da busca, e só aparecem os
  // tipos que existem (mais o ativo, para dar para desmarcar).
  const contagemTipo = semTipo.reduce((acc, s) => ({ ...acc, [s.tipo]: (acc[s.tipo] || 0) + 1 }), {});
  const tiposVisiveis = Object.keys(TIPO_LABEL).filter((t) => contagemTipo[t] || t === filtroTipo);
  const filtradas = semTipo.filter((s) => filtroTipo === 'todos' || s.tipo === filtroTipo);
  const itens = agruparPorProjeto(filtradas, detalhes);
  const toggleGrupo = (chave) => setGruposFechados((prev) => {
    const next = new Set(prev);
    if (next.has(chave)) next.delete(chave); else next.add(chave);
    return next;
  });
  const infoProjeto = (codigo) => (resolverProjeto && normalizarCodigo(codigo) ? resolverProjeto(codigo) : null);

  const cont = (st) => solicitacoes.filter((s) => s.status === st).length;
  const aguardandoAdmin = solicitacoes.filter((s) => acaoDisponivel(APROVADORES.admin, s.etapas) !== null).length;

  const todasExpandidas = filtradas.length > 0 && filtradas.every((s) => expandido.has(s.id));
  const alternarTodas = () => setExpandido(todasExpandidas ? new Set() : new Set(filtradas.map((s) => s.id)));

  // Desfechos do admin: 'aprovar', 'reprovar' (avisa o solicitante, que pode
  // responder) e 'cancelar' (o admin, último da cadeia, encerra a requisição).
  // Reprovar e cancelar exigem justificativa.
  const confirmarDecisao = async () => {
    if (!decisao) return;
    const { sol, modo } = decisao;
    const atual = etapaAtual(sol.etapas);
    if (!atual) return;
    const comentTrim = comentario.trim();
    if (modo !== 'aprovar' && !comentTrim) return; // justificativa obrigatória
    const coment = comentTrim || null;
    const agora = new Date().toISOString();
    setAcaoId(sol.id);
    try {
      if (modo === 'aprovar') {
        const { error } = await supabase
          .from('solicitacoes_rh_etapas')
          .update({ status: 'aprovada', justificativa: coment, decidido_em: agora })
          .eq('status', 'pendente')
          .eq('id', atual.id);
        if (error) throw error;
        notificarAprovadorSolic(sol.id);
      } else if (modo === 'reprovar') {
        const { data, error: e1 } = await supabase
          .from('solicitacoes_rh_etapas')
          .update({ status: 'reprovada', justificativa: coment, decidido_em: agora })
          .eq('id', atual.id)
          .eq('status', 'pendente')
          .select('id');
        if (e1) throw e1;
        if (!data || data.length === 0) { alert('Esta etapa já foi tratada. A lista será atualizada.'); }
        else {
          const { error: e2 } = await supabase
            .from('solicitacoes_rh')
            .update({ status: 'reprovada', updated_at: agora })
            .eq('id', sol.id);
          if (e2) throw e2;
          notificarSolicitanteReprovacao(sol.id);   // avisa o solicitante (best-effort)
        }
      } else if (modo === 'cancelar') {
        // Marca a etapa atual como cancelada (privilégio de admin, sem filtro por
        // aprovador) e encerra a requisição com a justificativa do cancelamento.
        const { data, error: e1 } = await supabase
          .from('solicitacoes_rh_etapas')
          .update({ status: 'cancelada', justificativa: coment, decidido_em: agora })
          .eq('id', atual.id)
          .eq('status', 'pendente')
          .select('id');
        if (e1) throw e1;
        if (!data || data.length === 0) { alert('Esta etapa já foi tratada. A lista será atualizada.'); }
        else {
          const { error: e2 } = await supabase
            .from('solicitacoes_rh')
            .update({
              status: 'cancelada', updated_at: agora,
              cancelamento_motivo: coment, cancelamento_por: user?.id || null, cancelamento_em: agora,
            })
            .eq('id', sol.id);
          if (e2) throw e2;
        }
      }
      setDecisao(null);
      setComentario('');
      await fetchSolicitacoes();
      window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    } catch (err) {
      console.error(err);
      const verbo = { aprovar: 'aprovar', reprovar: 'reprovar', cancelar: 'cancelar' }[modo];
      alert(`Erro ao ${verbo}. Tente novamente.`);
    } finally {
      setAcaoId(null);
    }
  };

  const executar = async (sol) => {
    const atual = etapaAtual(sol.etapas);
    if (!atual) return;
    setAcaoId(sol.id);
    try {
      const agora = new Date().toISOString();
      // Guarda: só executa se a etapa ainda estiver pendente.
      const { data, error: e1 } = await supabase
        .from('solicitacoes_rh_etapas')
        .update({ status: 'executada', decidido_em: agora })
        .eq('id', atual.id)
        .eq('status', 'pendente')
        .select('id');
      if (e1) throw e1;
      if (!data || data.length === 0) {
        alert('Esta etapa já foi tratada. A lista será atualizada.');
        await fetchSolicitacoes();
        return;
      }
      const { error: e2 } = await supabase
        .from('solicitacoes_rh')
        .update({ status: 'concluida', concluida_em: agora, updated_at: agora })
        .eq('id', sol.id);
      if (e2) throw e2;
      await fetchSolicitacoes();
      window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    } catch (err) {
      console.error(err);
      alert('Erro ao executar. Tente novamente.');
    } finally {
      setAcaoId(null);
    }
  };

  // ===== Escape hatch (fluxo travado) =====
  // Reatribui a etapa atual a outra pessoa (ex.: o responsável foi inativado).
  const confirmarReatribuir = async () => {
    if (!reatribuirSol || !reatribuirId) return;
    const atual = etapaAtual(reatribuirSol.etapas);
    if (!atual) return;
    setAcaoId(reatribuirSol.id);
    try {
      const novo = poolReatribuir.find((c) => c.id === reatribuirId);
      const { error } = await supabase
        .from('solicitacoes_rh_etapas')
        .update({ aprovador_id: reatribuirId, papel: novo?.nome || 'Aprovador' })
        .eq('id', atual.id)
        .eq('status', 'pendente');
      if (error) throw error;
      notificarAprovadorSolic(reatribuirSol.id);
      setReatribuirSol(null);
      setReatribuirId('');
      await fetchSolicitacoes();
      window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    } catch (err) {
      console.error(err);
      alert('Erro ao reatribuir. Tente novamente.');
    } finally {
      setAcaoId(null);
    }
  };

  // Força o avanço da etapa atual (aprova manualmente, registrando que foi o admin).
  const forcarAvanco = async (sol) => {
    const atual = etapaAtual(sol.etapas);
    if (!atual) return;
    if (!window.confirm('Forçar o avanço desta etapa? Ela será marcada como aprovada pelo admin e o fluxo seguirá para a próxima.')) return;
    setAcaoId(sol.id);
    try {
      const agora = new Date().toISOString();
      const novoStatus = atual.tipo_etapa === 'execucao' ? 'executada' : 'aprovada';
      const { error: e1 } = await supabase
        .from('solicitacoes_rh_etapas')
        .update({ status: novoStatus, justificativa: 'Avanço forçado pelo admin', decidido_em: agora })
        .eq('id', atual.id)
        .eq('status', 'pendente');
      if (e1) throw e1;
      if (atual.tipo_etapa === 'execucao') {
        const { error: e2 } = await supabase
          .from('solicitacoes_rh')
          .update({ status: 'concluida', concluida_em: agora, updated_at: agora })
          .eq('id', sol.id);
        if (e2) throw e2;
      } else {
        notificarAprovadorSolic(sol.id);
      }
      await fetchSolicitacoes();
      window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    } catch (err) {
      console.error(err);
      alert('Erro ao forçar avanço. Tente novamente.');
    } finally {
      setAcaoId(null);
    }
  };

  const excluir = async (id) => {
    if (!window.confirm('Excluir esta solicitação permanentemente?')) return;
    setAcaoId(id);
    try {
      const { error } = await supabase.from('solicitacoes_rh').delete().eq('id', id);
      if (error) throw error;
      setSolicitacoes((prev) => prev.filter((s) => s.id !== id));
      window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir. Tente novamente.');
    } finally {
      setAcaoId(null);
    }
  };

  const parseDesligamento = (just) => {
    if (just?.includes('Data solicitada para desligamento:')) {
      const m = just.match(/Data solicitada para desligamento: (.*?)\n\nJustificativa: (.*)/s);
      if (m) return { data: m[1], texto: m[2] };
    }
    return { data: null, texto: just };
  };

  // Um card de requisição. Dentro de um grupo de projeto o código já está no
  // cabeçalho do grupo, então o card não repete.
  const renderCard = (s, { emGrupo = false } = {}) => {
    const resumo = resumoAndamento(s, s.etapas);
    const tomB = badgeDeStatus(resumo.tom);
    const acao = acaoDisponivel(APROVADORES.admin, s.etapas); // 'aprovacao' | 'execucao' | null
    const det = s.tipo === 'desligamento' ? parseDesligamento(s.justificativa) : { data: null, texto: s.justificativa };
    const detLista = detalhes[s.id];
    // Contratação não tem colaborador_id: quem entra é o profissional do formulário.
    const nomeColab = s.colaborador?.nome || detLista?.nome_profissional?.trim() || '';
    const funcao = funcaoDaRequisicao(s, detLista);
    const codProjeto = s.tipo === 'formulario_contratacao' && normalizarCodigo(detLista?.codigo_proposta_projeto)
      ? detLista.codigo_proposta_projeto.trim()
      : null;
    const nomeProj = codProjeto ? nomeProjeto(infoProjeto(codProjeto)) : '';
    const aberto = expandido.has(s.id);
    return (
      <div key={s.id} className={`sol-card ${acao ? 'sol-card--acao' : ''}`}>
        <button
          type="button"
          className="sol-card-header"
          aria-expanded={aberto}
          aria-controls={`sol-body-${s.id}`}
          onClick={() => toggleCard(s.id)}
        >
          <ChevronDown size={16} aria-hidden className={`sol-card-chevron ${aberto ? 'is-open' : ''}`} />
          <span className="sol-card-headtext">
            <span className="sol-card-headline sol-card-colab">
              {s.numero != null && `#${s.numero} · `}{TIPO_LABEL[s.tipo]} · {nomeColab || (s.gestor?.nome ? `Solicitado por ${s.gestor.nome}` : '—')}
            </span>
            {(funcao || (codProjeto && !emGrupo)) && (
              <span className="req-card-meta">
                {funcao && <span className="req-card-funcao"><Briefcase size={12} aria-hidden /> {funcao}</span>}
                {codProjeto && !emGrupo && (
                  <span className="req-card-projeto" title={nomeProj || undefined}>
                    <FolderKanban size={12} aria-hidden /> {codProjeto}
                    {nomeProj && <span className="req-card-projeto-nome"> · {nomeProj}</span>}
                  </span>
                )}
              </span>
            )}
            {!aberto && resumo.tom === 'pendente' && (
              <span className="sol-card-headsub">{resumo.texto}</span>
            )}
          </span>
          <span className={`badge ${tomB.badge}`}>{tomB.label}</span>
        </button>

        {aberto && (
        <div id={`sol-body-${s.id}`} className="sol-card-body">
        <div className="sol-card-top">
          <div>
            <div className="sol-card-colab">{nomeColab || '—'}</div>
            <div className="sol-card-tipo">
              {TIPO_LABEL[s.tipo]}
              {s.iniciativa && <span className="sol-card-iniciativa"> · {INICIATIVA_LABEL[s.iniciativa]}</span>}
              {s.gestor?.nome && <span> · solicitado por {s.gestor.nome}</span>}
              {s.created_at && <span className="sol-card-iniciativa"> · Aberta em {new Date(s.created_at).toLocaleDateString('pt-BR')}</span>}
            </div>
          </div>
        </div>

        <div className="sol-card-info req-card-info">
          {s.tipo !== 'aumento_salario' && funcao && (
            <span>Função: <strong>{funcao}</strong></span>
          )}
          {codProjeto && (
            <span>Projeto: <strong>{codProjeto}</strong>{nomeProj && ` · ${nomeProj}`}</span>
          )}
          {s.tipo === 'aumento_salario' && s.salario_proposto != null && (
            <span>Valor: {formatarMoeda(s.colaborador?.salario)} → <strong style={{ color: 'var(--color-success)' }}>{formatarMoeda(s.salario_proposto)}</strong></span>
          )}
          {s.tipo === 'aumento_salario' && s.funcao_proposta && (
            <span>Função: {s.colaborador?.funcao || '—'} → <strong style={{ color: 'var(--color-success)' }}>{s.funcao_proposta}</strong></span>
          )}
          {s.tipo === 'aumento_salario' && s.cargo_proposto && (
            <span>Cargo: <strong style={{ color: 'var(--color-success)' }}>{s.cargo_proposto}</strong></span>
          )}
          {s.tipo === 'desligamento' && det.data && (
            <span>Desligamento sugerido: <strong style={{ color: 'var(--color-danger)' }}>{det.data}</strong></span>
          )}
        </div>
        {det.texto && <div className="sol-card-just">{det.texto}</div>}

        {/* Editada pelo solicitante depois de enviada: a cadeia recomeçou,
            então o que já tinha sido aprovado antes não vale mais. */}
        {s.edicao_motivo && (
          <div className="sol-card-resumo tom-devolvida">
            <strong>
              Editada pelo solicitante{s.edicao_em ? ` em ${new Date(s.edicao_em).toLocaleDateString('pt-BR')}` : ''} — a aprovação recomeçou:
            </strong> {s.edicao_motivo}
          </div>
        )}

        <div className={`sol-card-resumo tom-${resumo.tom}`}>{resumo.texto}</div>

        <FluxoTimeline etapas={s.etapas} />

        {/* Consulta e ferramentas do admin à esquerda; a decisão à direita. */}
        <div className="sol-card-actions req-card-acoes">
          <div className="req-card-acoes-sec">
            <BotaoPdfRequisicao sol={s} nomeColaborador={nomeColab} nomeSolicitante={s.gestor?.nome} />
            {DETALHE[s.tipo] && (
              <button className="btn btn-outline btn-sm" disabled={acaoId === s.id}
                onClick={async () => { setSolRespostas(s); setVerRespostas(await buscarRespostas(s)); }}>
                <FileText size={14} /> Ver respostas
              </button>
            )}
            {s.tipo === 'desligamento' && s.status !== 'cancelada' && (
              <button className="btn btn-outline btn-sm" disabled={acaoId === s.id}
                title="Avisar ADM, TI e outros envolvidos no recolhimento"
                onClick={() => setConhecimentoSol(s)}>
                <Send size={14} /> Enviar para conhecimento{s.ciencias?.length ? ` (${s.ciencias.length})` : ''}
              </button>
            )}
            {s.status === 'pendente' && (
              <>
                <button className="btn btn-outline btn-sm" title="Reatribuir a etapa atual a outra pessoa" disabled={acaoId === s.id} onClick={() => { setReatribuirSol(s); setReatribuirId(''); }}>
                  <Wrench size={14} /> Reatribuir
                </button>
                <button className="btn btn-outline btn-sm" title="Forçar avanço da etapa atual" disabled={acaoId === s.id} onClick={() => forcarAvanco(s)}>
                  <FastForward size={14} /> Forçar avanço
                </button>
                <button className="btn btn-outline btn-sm req-btn-perigo" title="Cancelar a requisição (encerra o fluxo)" disabled={acaoId === s.id} onClick={() => { setDecisao({ sol: s, modo: 'cancelar' }); setComentario(''); }}>
                  <Ban size={14} /> Cancelar requisição
                </button>
              </>
            )}
            <button className="btn btn-ghost btn-sm req-btn-excluir" title="Excluir" aria-label="Excluir requisição" disabled={acaoId === s.id} onClick={() => excluir(s.id)}>
              <Trash2 size={15} />
            </button>
          </div>
          {acao && (
            <div className="req-card-acoes-dec">
              {acao === 'aprovacao' && (
                <>
                  <button className="btn btn-outline btn-sm req-btn-perigo" disabled={acaoId === s.id} onClick={() => { setDecisao({ sol: s, modo: 'reprovar' }); setComentario(''); }}>
                    <X size={14} /> Reprovar
                  </button>
                  <button className="btn btn-success btn-sm" disabled={acaoId === s.id} onClick={() => { setDecisao({ sol: s, modo: 'aprovar' }); setComentario(''); }}>
                    {acaoId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
                  </button>
                </>
              )}
              {acao === 'execucao' && (
                <button className="btn btn-primary btn-sm" disabled={acaoId === s.id} onClick={() => executar(s)}>
                  {acaoId === s.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />} Executar / Concluir
                </button>
              )}
            </div>
          )}
        </div>
        </div>
        )}
      </div>
    );
  };

  const renderGrupo = (g) => {
    const aberto = !gruposFechados.has(g.chave);
    const nome = nomeProjeto(infoProjeto(g.codigo));
    const aguardam = g.sols.filter((s) => acaoDisponivel(APROVADORES.admin, s.etapas) !== null).length;
    return (
      <section key={`g-${g.chave}`} className={`req-grupo ${aguardam ? 'req-grupo--acao' : ''}`}>
        <button
          type="button"
          className="req-grupo-header"
          aria-expanded={aberto}
          onClick={() => toggleGrupo(g.chave)}
        >
          <ChevronDown size={16} aria-hidden className={`sol-card-chevron ${aberto ? 'is-open' : ''}`} />
          <FolderKanban size={18} aria-hidden className="req-grupo-icone" />
          <span className="req-grupo-titulo">
            <span className="req-grupo-codigo">{g.codigo}</span>
            {nome && <span className="req-grupo-nome">{nome}</span>}
          </span>
          <span className="req-grupo-tags">
            {aguardam > 0 && <span className="req-grupo-tag req-grupo-tag--acao">{aguardam} aguardando você</span>}
            <span className="req-grupo-tag">{g.sols.length} contratações</span>
          </span>
        </button>
        {aberto && (
          <div className="req-grupo-lista">
            {g.sols.map((s) => renderCard(s, { emGrupo: true }))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><FileText size={28} /> Requisições DP</h1>
      <p className="page-subtitle">Aprove e execute as solicitações dos gestores conforme o fluxo de cada tipo.</p>

      {/* Resumo */}
      <div className="cards-grid" style={{ marginBottom: 'var(--space-xl)' }}>
        {[
          { key: 'todos', label: 'Total', count: solicitacoes.length, accent: 'accent' },
          { key: 'aguardando', label: 'Aguardando você', count: aguardandoAdmin, accent: 'warning' },
          { key: 'concluida', label: 'Concluídas', count: cont('concluida'), accent: 'success' },
          { key: 'reprovada', label: 'Reprovadas', count: cont('reprovada'), accent: 'danger' },
        ].map((c) => (
          <div
            key={c.key}
            className={`stat-card ${c.accent} ${filtroStatus === c.key ? 'is-active' : ''}`}
            onClick={() => setFiltroStatus(c.key === 'aguardando' ? 'todos' : c.key)}
            style={{ cursor: 'pointer' }}
          >
            <div className="stat-card-value">{c.count}</div>
            <div className="stat-card-label">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Abas: fila ativa x histórico (concluídas + reprovadas) */}
      <div className="req-tabs" style={{ marginTop: 0 }}>
        {[
          { key: 'todos', label: 'Todas', icone: FileText },
          { key: 'pendente', label: 'Em andamento', icone: Loader2 },
          { key: 'historico', label: 'Histórico', icone: History },
        ].map((t) => {
          const ativa = t.key === 'historico'
            ? ['historico', 'concluida', 'reprovada'].includes(filtroStatus)
            : filtroStatus === t.key;
          const Icone = t.icone;
          return (
            <button key={t.key} type="button" className={`req-tab ${ativa ? 'active' : ''}`} onClick={() => setFiltroStatus(t.key)}>
              <Icone size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            Solicitações
            {filtradas.length > 1 && (
              <button className="btn btn-outline btn-sm" onClick={alternarTodas}>
                {todasExpandidas ? 'Recolher todas' : 'Expandir todas'}
              </button>
            )}
          </div>
          <div className="sol-busca">
            <Search size={15} aria-hidden />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, nº, projeto ou função…"
              aria-label="Buscar por colaborador, solicitante, número, código do projeto ou função"
            />
          </div>
        </div>
        <div className="req-tipos" role="group" aria-label="Filtrar por tipo de requisição">
          {['todos', ...tiposVisiveis].map((t) => {
            const Icone = t === 'todos' ? LayoutList : (ICONE_TIPO[t] || FileText);
            const ativo = filtroTipo === t;
            const n = t === 'todos' ? semTipo.length : (contagemTipo[t] || 0);
            return (
              <button key={t} type="button" className={`req-tipo ${ativo ? 'is-active' : ''}`}
                aria-pressed={ativo}
                onClick={() => setFiltroTipo(t)}
                title={t === 'todos' ? 'Todos os tipos' : TIPO_LABEL[t]}>
                <Icone size={15} aria-hidden />
                <span>{t === 'todos' ? 'Todos' : TIPO_LABEL_CURTO[t]}</span>
                <span className="req-tipo-n">{n}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}><Loader2 size={24} className="animate-spin" /></div>
        ) : filtradas.length === 0 ? (
          <div className="table-empty" style={{ padding: 'var(--space-3xl)' }}>
            {termo
              ? <>Nenhuma solicitação para “{busca.trim()}”. <button type="button" className="btn btn-outline btn-sm" onClick={() => setBusca('')}>Limpar busca</button></>
              : 'Nenhuma solicitação encontrada.'}
          </div>
        ) : (
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {itens.map((it) => (it.tipo === 'grupo' ? renderGrupo(it) : renderCard(it.sol)))}
          </div>
        )}
      </div>

      <ModalRespostas
        respostas={verRespostas}
        sol={solRespostas}
        nomeColaborador={solRespostas?.colaborador?.nome}
        nomeSolicitante={solRespostas?.gestor?.nome}
        onClose={() => { setVerRespostas(null); setSolRespostas(null); }}
      />

      {conhecimentoSol && (
        <EnviarConhecimentoModal
          sol={conhecimentoSol}
          onClose={() => setConhecimentoSol(null)}
          onEnviado={async () => { setConhecimentoSol(null); await fetchSolicitacoes(); }}
        />
      )}

      {/* Modal de decisão: aprovar / reprovar / cancelar */}
      {decisao && (() => {
        const cfg = {
          aprovar: {
            titulo: 'Aprovar solicitação', btn: 'btn-success', obrig: false,
            desc: 'A solicitação seguirá para a próxima etapa do fluxo. Você pode deixar um comentário, se quiser.',
            label: 'Comentário (opcional)', placeholder: 'Adicione um comentário, se quiser...',
            confirmar: <><Check size={16} /> Confirmar aprovação</>, processando: 'Aprovando...',
          },
          reprovar: {
            titulo: 'Reprovar solicitação', btn: 'btn-danger', obrig: true,
            desc: <>A solicitação será <strong>reprovada</strong>. O solicitante é avisado por e-mail e pode responder — aí ela volta para a sua decisão.</>,
            label: 'Motivo da reprovação', placeholder: 'Explique o motivo da reprovação...',
            confirmar: <><X size={16} /> Confirmar reprovação</>, processando: 'Reprovando...',
          },
          cancelar: {
            titulo: 'Cancelar requisição', btn: 'btn-danger', obrig: true,
            desc: <>A requisição será <strong>cancelada</strong> e o fluxo encerrado. Registre o motivo do cancelamento.</>,
            label: 'Motivo do cancelamento', placeholder: 'Explique por que está cancelando...',
            confirmar: <><Ban size={16} /> Confirmar cancelamento</>, processando: 'Cancelando...',
          },
        }[decisao.modo];
        const faltaJustificativa = cfg.obrig && !comentario.trim();
        return (
        <div className="modal-overlay" onClick={() => setDecisao(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{cfg.titulo}</span>
              <button className="modal-close" onClick={() => setDecisao(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>{cfg.desc}</p>
              <div className="form-group">
                <label className="form-label">{cfg.label}{cfg.obrig && <span className="required"> *</span>}</label>
                <textarea
                  className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder={cfg.placeholder}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
                {faltaJustificativa && <span className="contratacao-erro">A justificativa é obrigatória.</span>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDecisao(null)}>Fechar</button>
              <button className={`btn ${cfg.btn}`} disabled={acaoId === decisao.sol.id || faltaJustificativa} onClick={confirmarDecisao}>
                {acaoId === decisao.sol.id ? cfg.processando : cfg.confirmar}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Modal de reatribuição (escape hatch) */}
      {reatribuirSol && (
        <div className="modal-overlay" onClick={() => setReatribuirSol(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Reatribuir etapa atual</span>
              <button className="modal-close" onClick={() => setReatribuirSol(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                A etapa atual passará a ser responsabilidade da pessoa escolhida. Use quando o responsável saiu ou foi inativado.
              </p>
              <div className="form-group">
                <label className="form-label">Novo responsável <span className="required">*</span></label>
                <select className="form-select" value={reatribuirId} onChange={(e) => setReatribuirId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {poolReatribuir.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}{c.perfil === 'admin' ? ' (Admin)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setReatribuirSol(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!reatribuirId || acaoId === reatribuirSol.id} onClick={confirmarReatribuir}>
                {acaoId === reatribuirSol.id ? 'Reatribuindo...' : <><Wrench size={16} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
