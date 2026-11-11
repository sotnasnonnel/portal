import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import { formatarMoeda, parseDesligamento } from '../../../utils/formatters';
import { Check, X, Loader2, ClipboardCheck, FileText, ChevronDown, User, AlertTriangle, FolderKanban, Briefcase, LayoutList } from 'lucide-react';
import FluxoTimeline from '../../../components/Solicitacoes/FluxoTimeline';
import SearchSelect from '../../../components/UI/SearchSelect';
import { opcoesSolicitantes } from './solicitantes';
import {
  etapaAtual, acaoDisponivel, resumoAndamento, badgeDeStatus,
  INICIATIVA_LABEL, TIPO_LABEL, TIPO_LABEL_CURTO,
} from '../../../config/aprovacao';
import ModalRespostas, { DETALHE, buscarRespostas } from './ModalRespostas';
import BotaoGerarNovaVaga from './BotaoGerarNovaVaga';
import AcoesEditarRequisicao from './AcoesEditarRequisicao';
import RequisicoesRh from './RequisicoesRh';
import { REQUISICOES } from '../../../config/requisicoes';
import {
  agruparPorProjeto, funcaoDaRequisicao, nomeProjeto, normalizarCodigo,
  codigoProjetoTexto, nomeInformado, rotuloGrupo,
} from './projetos';
import { carregarDetalhesLista, carregarResolvedorProjeto } from './detalhesRequisicoes';
import { decidirRequisicaoRh } from '../../../services/decisaoRequisicaoRh';
import BotaoPdfRequisicao from '../../../components/BotaoPdfRequisicao';
import '../../../components/UI/Components.css';
import '../Gestor.css';
import './Requisicoes.css';

// Ícone de cada tipo nos filtros: o mesmo da tela de nova requisição.
const ICONE_TIPO = Object.fromEntries(REQUISICOES.filter((r) => r.tipoDb).map((r) => [r.tipoDb, r.icon]));

const SELECT_SOL = `
  id, numero, tipo, status, iniciativa, gestor_id, colaborador_id, justificativa, salario_proposto, funcao_proposta, cargo_proposto, created_at,
  reenvios, edicao_motivo, edicao_em,
  colaborador:colaborador_id ( nome, funcao, salario ),
  gestor:gestor_id ( nome ),
  etapas:solicitacoes_rh_etapas ( id, ordem, aprovador_id, papel, tipo_etapa, status, justificativa, decidido_em )
`;

export default function AcompanharRequisicoes() {
  const { user, markSolicVisto } = useAuth();
  const [participa, setParticipa] = useState([]);
  const [nomes, setNomes] = useState({}); // id -> nome (solicitante/colaborador), via RPC
  const [loading, setLoading] = useState(true);
  const [acaoId, setAcaoId] = useState(null);
  const [decisao, setDecisao] = useState(null); // { sol, modo: 'aprovar' | 'reprovar' }
  const [comentario, setComentario] = useState('');
  const [verRespostas, setVerRespostas] = useState(null);
  const [solRespostas, setSolRespostas] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroSolic, setFiltroSolic] = useState(''); // '' = todos os solicitantes
  const [detalhes, setDetalhes] = useState({});       // solicitacao_id -> função/projeto/profissional
  const [resolverProjeto, setResolverProjeto] = useState(null); // código -> { completo, cliente }
  const [gruposFechados, setGruposFechados] = useState(() => new Set());

  const abrirRespostas = async (sol) => { setSolRespostas(sol); setVerRespostas(await buscarRespostas(sol)); };

  const [expandido, setExpandido] = useState(() => new Set());
  const seededRef = useRef(false);

  const toggleCard = (id) => setExpandido((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Solicitantes distintos (quem abriu a requisição = gestor_id), ordenados por nome.
  const solicitantes = useMemo(() => opcoesSolicitantes(participa, nomes), [participa, nomes]);

  // Os chips de tipo contam dentro do solicitante escolhido, e só aparecem os
  // tipos que existem na lista (mais o ativo, para dar para desmarcar).
  const doSolicitante = participa.filter((s) => !filtroSolic || s.gestor_id === filtroSolic);
  const contagemTipo = doSolicitante.reduce((acc, s) => ({ ...acc, [s.tipo]: (acc[s.tipo] || 0) + 1 }), {});
  const tiposVisiveis = Object.keys(TIPO_LABEL).filter((t) => contagemTipo[t] || t === filtroTipo);
  const filtradas = doSolicitante.filter((s) => filtroTipo === 'todos' || s.tipo === filtroTipo);
  const itens = agruparPorProjeto(filtradas, detalhes);
  const toggleGrupo = (chave) => setGruposFechados((prev) => {
    const next = new Set(prev);
    if (next.has(chave)) next.delete(chave); else next.add(chave);
    return next;
  });
  const infoProjeto = (codigo) => (resolverProjeto && normalizarCodigo(codigo) ? resolverProjeto(codigo) : null);
  const todasExpandidas = filtradas.length > 0 && filtradas.every((s) => expandido.has(s.id));
  const alternarTodas = () => setExpandido(todasExpandidas ? new Set() : new Set(filtradas.map((s) => s.id)));

  const fetchParticipa = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('solicitacoes_rh')
      .select(SELECT_SOL)
      .order('created_at', { ascending: false });
    const veTudo = user.rhDp || user.perfil === 'admin';
    const minhas = veTudo
      ? (data || [])
      : (data || []).filter((s) => s.gestor_id === user.id || (s.etapas || []).some((e) => e.aprovador_id === user.id));
    // Resolve nomes de solicitante e colaborador via RPC: a RLS de colaboradores
    // esconde quem não é superior, então o join gestor/colaborador vem nulo para
    // quem só aprova. A RPC SECURITY DEFINER devolve só (id, nome).
    const ids = [...new Set(minhas.flatMap((s) => [s.gestor_id, s.colaborador_id]).filter(Boolean))];
    const [cols, dets] = await Promise.all([
      ids.length ? supabase.rpc('nomes_colaboradores', { p_ids: ids }).then((r) => r.data) : [],
      carregarDetalhesLista(minhas).catch(() => ({})),
    ]);
    setNomes(Object.fromEntries((cols || []).map((c) => [c.id, c.nome])));
    setDetalhes(dets);
    setParticipa(minhas);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchParticipa(); }, [fetchParticipa]);

  // Nome dos projetos (cliente + código completo): uma vez por visita.
  useEffect(() => {
    let vivo = true;
    carregarResolvedorProjeto()
      .then((fn) => { if (vivo) setResolverProjeto(() => fn); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  // Semeia UMA vez: abre expandidas as requisições que aguardam a ação deste usuário.
  useEffect(() => {
    if (seededRef.current || participa.length === 0) return;
    seededRef.current = true;
    setExpandido(new Set(
      participa
        .filter((s) => acaoDisponivel(user?.id, s.etapas) === 'aprovacao')
        .map((s) => s.id)
    ));
  }, [participa, user?.id]);

  useEffect(() => {
    markSolicVisto?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Desfechos: 'aprovar' (segue o fluxo) e 'reprovar' (encerra e avisa o
  // solicitante, que pode responder e devolver à decisão de quem reprovou).
  // Reprovar exige justificativa — validado aqui e no botão do modal.
  const confirmarDecisao = async () => {
    if (!decisao) return;
    const { sol, modo } = decisao;
    if (!etapaAtual(sol.etapas)) return;
    if (modo !== 'aprovar' && !comentario.trim()) return; // justificativa obrigatória
    setAcaoId(sol.id);
    try {
      // Mesma função da central de Aprovações: grava, avisa e dispara o evento.
      const r = await decidirRequisicaoRh({
        sol, userId: user.id, aprovar: modo === 'aprovar', comentario,
      });
      if (r === 'ja_tratada') {
        alert('Esta etapa já foi tratada por outra pessoa. A lista será atualizada.');
      }
      setDecisao(null);
      setComentario('');
      await fetchParticipa();
    } catch (err) {
      console.error(err);
      const verbo = { aprovar: 'aprovar', reprovar: 'reprovar', devolver: 'devolver' }[modo];
      alert(`Erro ao ${verbo}. Tente novamente.`);
    } finally {
      setAcaoId(null);
    }
  };

  // RH/DP: visão organizada (filtros por status + lista + modal do fluxo), somente leitura.
  if (user?.rhDp) {
    return <RequisicoesRh participa={participa} nomes={nomes} loading={loading} />;
  }

  // Um card de requisição. Dentro de um grupo de projeto o código já está no
  // cabeçalho do grupo, então o card não repete.
  const renderCard = (s, { emGrupo = false } = {}) => {
    const resumo = resumoAndamento(s, s.etapas);
    const tomB = badgeDeStatus(resumo.tom);
    const podeAprovar = !user?.rhDp && acaoDisponivel(user?.id, s.etapas) === 'aprovacao';
    const det = s.tipo === 'desligamento' ? parseDesligamento(s.justificativa) : { data: null, texto: s.justificativa };
    const detLista = detalhes[s.id];
    const nomeSolic = nomes[s.gestor_id] || s.gestor?.nome || '—';
    // Contratação não tem colaborador_id: quem entra é o profissional do formulário.
    const nomeColab = nomes[s.colaborador_id] || s.colaborador?.nome || detLista?.nome_profissional?.trim() || '';
    const funcao = funcaoDaRequisicao(s, detLista);
    const codProjeto = codigoProjetoTexto(s, detLista);
    const nomeProj = codProjeto ? nomeProjeto(infoProjeto(codProjeto), nomeInformado(s, detLista)) : '';
    const aberto = expandido.has(s.id);
    return (
      <div key={s.id} className={`sol-card ${podeAprovar ? 'sol-card--acao' : ''}`}>
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
              {s.numero != null && `#${s.numero} · `}{TIPO_LABEL[s.tipo]} · {nomeColab || `Solicitado por ${nomeSolic}`}
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
            <div className="sol-card-colab">{nomeColab || `Solicitado por ${nomeSolic}`}</div>
            <div className="sol-card-tipo">
              {TIPO_LABEL[s.tipo]}
              {s.iniciativa && <span className="sol-card-iniciativa"> · {INICIATIVA_LABEL[s.iniciativa]}</span>}
              {nomeColab && <span className="sol-card-iniciativa"> · Solicitado por {nomeSolic}</span>}
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

        {/* O solicitante editou depois de enviada: a cadeia foi reiniciada e
            quem já tinha aprovado decide de novo — precisa saber o que mudou. */}
        {s.edicao_motivo && (
          <div className="sol-card-resumo tom-devolvida" style={{ display: 'flex', gap: 8 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              <strong>
                Editada pelo solicitante{s.edicao_em ? ` em ${new Date(s.edicao_em).toLocaleDateString('pt-BR')}` : ''} — a aprovação recomeçou:
              </strong> {s.edicao_motivo}
            </span>
          </div>
        )}

        <div className={`sol-card-resumo tom-${resumo.tom}`}>{resumo.texto}</div>

        <FluxoTimeline etapas={s.etapas} />

        <div className="sol-card-actions req-card-acoes">
          <div className="req-card-acoes-sec">
            <BotaoPdfRequisicao sol={s} nomeColaborador={nomeColab} nomeSolicitante={nomeSolic} />
            {DETALHE[s.tipo] && (
              <button className="btn btn-outline btn-sm" onClick={() => abrirRespostas(s)}>
                <FileText size={14} /> Ver respostas
              </button>
            )}
            {/* Estas duas só aparecem para o SOLICITANTE da requisição
                (ver podeEditarRequisicao / podeGerarNovaVaga). */}
            <AcoesEditarRequisicao sol={s} onFeito={fetchParticipa} />
            <BotaoGerarNovaVaga sol={s} />
          </div>
          {podeAprovar && (
            <div className="req-card-acoes-dec">
              <button className="btn btn-outline btn-sm req-btn-perigo" disabled={acaoId === s.id} onClick={() => { setDecisao({ sol: s, modo: 'reprovar' }); setComentario(''); }}>
                <X size={14} /> Reprovar
              </button>
              <button className="btn btn-success btn-sm" disabled={acaoId === s.id} onClick={() => { setDecisao({ sol: s, modo: 'aprovar' }); setComentario(''); }}>
                {acaoId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
              </button>
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
    const nome = nomeProjeto(infoProjeto(g.codigo), g.nomeInformado);
    const aguardam = g.sols.filter((s) => acaoDisponivel(user?.id, s.etapas) === 'aprovacao').length;
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
            <span className="req-grupo-tag">{rotuloGrupo(g.tipoReq, g.sols.length)}</span>
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
    <div className="gestor-page animate-fade-in-up">
      <h1 className="page-title"><ClipboardCheck size={28} /> Aprovar / Acompanhar</h1>
      <p className="page-subtitle">Requisições que você criou ou nas quais participa da cadeia de aprovação.</p>

      <div className="table-container" style={{ marginTop: 'var(--space-md)' }}>
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
          <div className="table-header-title"><ClipboardCheck size={16} /> Requisições que você participa</div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
            {solicitantes.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', minWidth: 220 }}>
                <User size={15} color="var(--color-text-muted)" />
                <div style={{ flex: 1 }}>
                  <SearchSelect
                    value={filtroSolic}
                    onChange={setFiltroSolic}
                    ariaLabel="Filtrar por solicitante"
                    placeholder="Todos os solicitantes"
                    options={[{ value: '', label: 'Todos os solicitantes' }, ...solicitantes]}
                  />
                </div>
              </div>
            )}
            {participa.length > 1 && (
              <button className="btn btn-outline btn-sm" onClick={alternarTodas}>
                {todasExpandidas ? 'Recolher todas' : 'Expandir todas'}
              </button>
            )}
          </div>
        </div>
        {participa.length > 0 && (
          <div className="req-tipos" role="group" aria-label="Filtrar por tipo de requisição">
            {['todos', ...tiposVisiveis].map((t) => {
              const Icone = t === 'todos' ? LayoutList : (ICONE_TIPO[t] || FileText);
              const ativo = filtroTipo === t;
              const n = t === 'todos' ? doSolicitante.length : (contagemTipo[t] || 0);
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
        )}
        {loading ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>Carregando...</div>
        ) : participa.length === 0 ? (
          <div className="table-empty" style={{ padding: 'var(--space-3xl)' }}>Nenhuma requisição para acompanhar.</div>
        ) : filtradas.length === 0 ? (
          <div className="table-empty" style={{ padding: 'var(--space-3xl)' }}>Nenhuma requisição para os filtros selecionados.</div>
        ) : (
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {itens.map((it) => (it.tipo === 'grupo' ? renderGrupo(it) : renderCard(it.sol)))}
          </div>
        )}
      </div>

      {decisao && (() => {
        const { modo } = decisao;
        const cfg = {
          aprovar: {
            titulo: 'Aprovar requisição', btn: 'btn-success', obrig: false,
            desc: 'A requisição seguirá para a próxima etapa do fluxo. Você pode deixar um comentário, se quiser.',
            label: 'Comentário (opcional)', placeholder: 'Adicione um comentário, se quiser...',
            confirmar: <><Check size={16} /> Confirmar aprovação</>, processando: 'Aprovando...',
          },
          reprovar: {
            titulo: 'Reprovar requisição', btn: 'btn-danger', obrig: true,
            desc: <>A requisição será <strong>reprovada</strong>. O solicitante é avisado por e-mail e pode responder — aí ela volta para a sua decisão.</>,
            label: 'Motivo da reprovação', placeholder: 'Explique o motivo da reprovação...',
            confirmar: <><X size={16} /> Confirmar reprovação</>, processando: 'Reprovando...',
          },
        }[modo];
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
                <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder={cfg.placeholder}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)} />
                {faltaJustificativa && (
                  <span className="contratacao-erro">A justificativa é obrigatória.</span>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDecisao(null)}>Cancelar</button>
              <button className={`btn ${cfg.btn}`} disabled={acaoId === decisao.sol.id || faltaJustificativa} onClick={confirmarDecisao}>
                {acaoId === decisao.sol.id ? cfg.processando : cfg.confirmar}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      <ModalRespostas
        respostas={verRespostas}
        sol={solRespostas}
        nomeColaborador={solRespostas ? (nomes[solRespostas.colaborador_id] || solRespostas.colaborador?.nome) : undefined}
        nomeSolicitante={solRespostas ? (nomes[solRespostas.gestor_id] || solRespostas.gestor?.nome) : undefined}
        onClose={() => { setVerRespostas(null); setSolRespostas(null); }}
      />
    </div>
  );
}
