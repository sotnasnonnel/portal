import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Workflow, Plus, Trash2, ArrowLeft, ArrowRight, Save, Loader2, AlertCircle, CheckCircle2, Coins,
  ChevronRight, User, UserCircle2, Headset, GitBranch, RotateCcw, Undo2, Pin,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../services/supabase';
import { CLASSES_ADM } from '../../../../config/administrativo';
import SearchSelect from '../../../../components/UI/SearchSelect';
import { CabecalhoPagina, Carregando } from '../components/ui';
import { listarPessoas, previewCadeiaEfetiva } from '../../lib/chamados';
import { SERVICOS_COM_ALCADA, FLUXO_GERAL } from '../../lib/alcadaAdm';

/** Iniciais para o avatar do nó, como no diagrama da Gestão de Pessoas. */
const iniciais = (nome) => String(nome || '').trim().split(/\s+/).filter(Boolean)
  .slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

// Classes cujos serviços têm gasto: a cadeia delas vem da alçada por valor, não
// daqui. Mostrar o campo levaria o admin a cadastrar algo que seria ignorado.
const CLASSES_POR_ALCADA = new Set(
  Object.keys(SERVICOS_COM_ALCADA).map((k) => k.split('/')[0]),
);

export default function FluxosAdm() {
  const { modules } = useAuth();
  const [pessoas, setPessoas] = useState([]);
  const [fluxos, setFluxos] = useState([]);
  const [solicitanteId, setSolicitanteId] = useState('');
  const [classe, setClasse] = useState(FLUXO_GERAL);
  const [cadeia, setCadeia] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [falhouCarga, setFalhouCarga] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState('');
  const [removendo, setRemovendo] = useState(false);
  // Quem aprovaria HOJE se nada estivesse cadastrado: o coordenador da pessoa e
  // o gerente acima dele, lidos do organograma. Sem mostrar isso, a tela
  // parecia dizer que não há fluxo nenhum.
  const [padrao, setPadrao] = useState(null);   // null = ainda buscando
  // De onde veio a cadeia que está na tela:
  //   'padrao'   — a escada do organograma, que ninguém cadastrou (e que segue
  //                acompanhando troca de gestor enquanto não for salva);
  //   'herdada'  — o fluxo geral desta pessoa, aplicado a uma classe sem regra;
  //   'propria'  — exceção cadastrada para esta pessoa NESTA classe.
  // Sem essa distinção a tela mostra a mesma cadeia em três situações que se
  // desfazem de maneiras diferentes.
  const [fonte, setFonte] = useState('padrao');
  // Enquanto o admin não mexe, a cadeia acompanha o padrão que chegar do banco.
  // Depois do primeiro toque ela é dele — sobrescrever apagaria a edição.
  const [editado, setEditado] = useState(false);
  // Sobe quando a exceção é removida: a resposta guardada em `padrao` veio com a
  // exceção valendo, e sem nova consulta o editor reporia a cadeia que acabou de
  // ser apagada, agora com cara de organograma.
  const [versaoPadrao, setVersaoPadrao] = useState(0);
  const cartaoRef = useRef(null);
  const canvasRef = useRef(null);
  const abrirNovaEtapa = useRef(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setFalhouCarga(false);
    setErro('');
    try {
      const [gente, { data, error }] = await Promise.all([
        listarPessoas(),
        supabase.from('chamados_adm_fluxos').select('solicitante_id, classe, aprovadores'),
      ]);
      if (error) throw new Error(error.message);
      setPessoas(gente);
      setFluxos(data || []);
    } catch (e) {
      setFalhouCarga(true);
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const linhaDe = useCallback(
    (sid, cls) => fluxos.find((f) => f.solicitante_id === sid && (f.classe || '') === cls),
    [fluxos],
  );

  /**
   * Põe na tela a cadeia que vale HOJE para (solicitante, classe), jogando fora
   * qualquer rascunho. Serve a dois momentos: a troca de solicitante/classe e o
   * "Descartar alterações" — que precisam fazer exatamente a mesma coisa.
   *
   * Não limpa `salvo`: esta função roda também quando `fluxos` muda, ou seja,
   * logo depois de salvar ou remover, e apagava a confirmação antes de ela
   * aparecer. Quem limpa a mensagem é o gesto do usuário (trocarAlvo, Descartar).
   */
  const restaurarCadeia = useCallback(() => {
    setEditado(false);
    if (!solicitanteId) { setCadeia([]); setFonte('padrao'); return; }

    const propria = linhaDe(solicitanteId, classe);
    if (propria) {
      setCadeia([...(propria.aprovadores || [])]);
      setFonte('propria');
      return;
    }
    // Classe sem regra própria herda a cadeia geral — mesmo pré-preenchimento do DP.
    const geral = classe === FLUXO_GERAL ? null : linhaDe(solicitanteId, FLUXO_GERAL);
    if (geral) {
      setCadeia([...(geral.aprovadores || [])]);
      setFonte('herdada');
      return;
    }
    // Sem cadastro nenhum: a cadeia vem do organograma. Fica vazia só até o
    // padrão chegar do banco (o efeito abaixo preenche).
    setCadeia([]);
    setFonte('padrao');
  }, [solicitanteId, classe, linhaDe]);

  useEffect(() => { restaurarCadeia(); }, [restaurarCadeia]);

  // O padrão do organograma, buscado por solicitante. É o que vale de verdade
  // quando ninguém cadastrou nada, e é ele que abastece o editor: cadastrar uma
  // exceção quase sempre é MUDAR um degrau da escada, não montar tudo de novo.
  useEffect(() => {
    if (!solicitanteId) { setPadrao(null); return undefined; }
    let cancelado = false;
    setPadrao(null);
    previewCadeiaEfetiva(solicitanteId, classe)
      .then((r) => { if (!cancelado) setPadrao(r); })
      .catch(() => { if (!cancelado) setPadrao({ origem: 'organograma', pessoas: [] }); });
    return () => { cancelado = true; };
  }, [solicitanteId, classe, versaoPadrao]);

  // Preenche o editor com a escada assim que ela chega — só quando não há
  // cadastro e o admin ainda não mexeu, para não apagar o que ele digitou
  // enquanto a consulta voltava.
  useEffect(() => {
    if (fonte !== 'padrao' || editado || !padrao) return;
    setCadeia(padrao.pessoas.map((p) => p.id));
  }, [padrao, fonte, editado]);

  const nomePorId = useMemo(
    () => Object.fromEntries(pessoas.map((p) => [p.id, p.nome])),
    [pessoas],
  );
  const opcoes = useMemo(() => pessoas.map((p) => ({ value: p.id, label: p.nome })), [pessoas]);

  // Removida a exceção desta classe, a pessoa cai no fluxo geral dela — se
  // houver um — e só então no organograma. Muda o texto dos botões e do aviso.
  const herdaGeral = classe !== FLUXO_GERAL && !!linhaDe(solicitanteId, FLUXO_GERAL);
  // O papel de cada pessoa na escada ('Gestor direto', 'Gerente'), para a etapa
  // dizer POR QUE aquela pessoa está ali enquanto ninguém mexeu.
  const papelPorId = useMemo(
    () => Object.fromEntries((padrao?.pessoas || []).map((p) => [p.id, p.papel])),
    [padrao],
  );

  // Toda mudança na cadeia passa por aqui: marcar `editado` num lugar só evita
  // que um botão novo esqueça de fazê-lo e tenha a edição sobrescrita pelo padrão.
  const editarCadeia = (fn) => {
    setEditado(true);
    setSalvo('');
    setErro('');
    setCadeia(fn);
  };

  // A troca de pessoa ou classe repõe a cadeia da tela; com rascunho aberto isso
  // jogava a edição fora em silêncio.
  const trocarAlvo = (sid, cls) => {
    if (sid === solicitanteId && cls === classe) return false;
    if (editado && !window.confirm('Esta cadeia tem alterações não salvas. Descartar e continuar?')) return false;
    setSolicitanteId(sid);
    setClasse(cls);
    setSalvo('');
    setErro('');
    return true;
  };

  // "+ Aprovador" já abre a busca da etapa nova: o próximo passo é sempre escolher
  // a pessoa, e uma etapa em branco parada na tela só atrapalha.
  const cadeiaTamanho = cadeia.length;
  useEffect(() => {
    if (!abrirNovaEtapa.current) return;
    abrirNovaEtapa.current = false;
    const botoes = canvasRef.current?.querySelectorAll('.ss2-btn');
    botoes?.[botoes.length - 1]?.click();
  }, [cadeiaTamanho]);

  // O que já está cadastrado, para o admin não ter de testar pessoa por pessoa
  // para descobrir quem saiu do caminho automático.
  const excecoes = useMemo(() => fluxos
    .map((f) => ({
      ...f,
      classe: f.classe || '',
      nome: nomePorId[f.solicitante_id] || 'Pessoa não encontrada',
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.classe.localeCompare(b.classe, 'pt-BR')), [fluxos, nomePorId]);

  // Mesma pessoa em duas etapas: o salvar recusa, mas o aviso na própria etapa
  // mostra qual é, sem a pessoa ter de procurar.
  const repetidos = new Set(cadeia.filter((id, i) => id && cadeia.indexOf(id) !== i));

  const mover = (i, d) => editarCadeia((c) => {
    const alvo = i + d;
    if (alvo < 0 || alvo >= c.length) return c;
    const copia = [...c];
    [copia[i], copia[alvo]] = [copia[alvo], copia[i]];
    return copia;
  });

  const salvar = async () => {
    if (!cadeia.length) {
      setErro('A cadeia está vazia. Adicione ao menos um aprovador — ou use "Voltar ao padrão" '
        + 'para o chamado seguir pelo organograma.');
      return;
    }
    if (cadeia.some((a) => !a)) { setErro('Há uma etapa sem aprovador escolhido.'); return; }
    // Mesma pessoa duas vezes na cadeia significa aprovar o mesmo chamado duas
    // vezes seguidas — quase sempre é engano de cadastro.
    if (new Set(cadeia).size !== cadeia.length) {
      setErro('A mesma pessoa aparece mais de uma vez na cadeia.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const { error } = await supabase.from('chamados_adm_fluxos').upsert(
        { solicitante_id: solicitanteId, classe, aprovadores: cadeia, updated_at: new Date().toISOString() },
        { onConflict: 'solicitante_id,classe' },
      );
      if (error) throw new Error(error.message);
      setFluxos((f) => [
        ...f.filter((x) => !(x.solicitante_id === solicitanteId && (x.classe || '') === classe)),
        { solicitante_id: solicitanteId, classe, aprovadores: cadeia },
      ]);
      setFonte('propria');
      setEditado(false);
      setSalvo('Fluxo salvo. A partir de agora esta cadeia é fixa e não acompanha mais o organograma.');
    } catch (e) {
      setErro(`Não foi possível salvar: ${e.message}`);
    } finally {
      setSalvando(false);
    }
  };

  /**
   * Apaga a exceção desta classe e devolve a pessoa ao caminho automático.
   *
   * Existe porque salvar é fácil e desfazer não era: uma exceção criada por
   * engano ficava valendo para sempre, e esvaziar a cadeia para "desligar" não
   * funciona — cadeia vazia significaria chamado sem aprovador.
   */
  const voltarAoPadrao = async () => {
    const volta = herdaGeral ? 'ao fluxo geral desta pessoa' : 'ao padrão do organograma';
    const nome = nomePorId[solicitanteId] || 'esta pessoa';
    if (!window.confirm(`Remover a cadeia cadastrada de ${nome} e voltar ${volta}? Não dá para desfazer.`)) return;
    setRemovendo(true);
    setErro('');
    try {
      const { error } = await supabase.from('chamados_adm_fluxos')
        .delete()
        .eq('solicitante_id', solicitanteId)
        .eq('classe', classe);
      if (error) throw new Error(error.message);
      // Tira a linha do estado local: os efeitos acima recalculam a fonte e
      // repõem a escada do organograma no editor.
      setFluxos((f) => f.filter((x) => !(x.solicitante_id === solicitanteId && (x.classe || '') === classe)));
      setVersaoPadrao((v) => v + 1);
      setSalvo(`Exceção removida — o chamado volta ${volta}.`);
    } catch (e) {
      setErro(`Não foi possível remover: ${e.message}`);
    } finally {
      setRemovendo(false);
    }
  };

  if (modules?.administrativo !== 'admin') return <Navigate to="/administrativo/novo" replace />;

  const porAlcada = classe && CLASSES_POR_ALCADA.has(classe);
  const proprio = fonte === 'propria';
  const semEscada = fonte === 'padrao' && padrao !== null && padrao.pessoas.length === 0;
  const rotuloClasse = (cls) => (cls === FLUXO_GERAL
    ? 'Todas as classes (fluxo geral)'
    : CLASSES_ADM.find((c) => c.slug === cls)?.label || cls);

  // Selo curto do estado da cadeia: a diferença entre os três precisa ser vista
  // de relance, não lida num parágrafo.
  let selo = 'Lendo o organograma…';
  let seloTom = 'padrao';
  if (editado) { selo = 'Alterações não salvas'; seloTom = 'rascunho'; }
  else if (proprio) { selo = 'Exceção cadastrada'; seloTom = 'propria'; }
  else if (fonte === 'herdada') { selo = 'Herdado do fluxo geral'; seloTom = 'herdada'; }
  else if (semEscada) { selo = 'Sem aprovador'; seloTom = 'alerta'; }
  else if (padrao !== null) { selo = 'Automático: organograma'; seloTom = 'padrao'; }

  return (
    <div className="adm-page adm-page-wide">
      <CabecalhoPagina
        Icon={Workflow}
        titulo="Fluxos de aprovação"
        subtitulo="Defina por quais aprovadores passa o chamado de cada pessoa. O fluxo geral vale para todas as classes; cadastre uma classe só quando ela precisar de um caminho diferente."
      />

      {carregando ? (
        <Carregando />
      ) : falhouCarga ? (
        <div className="adm-aviso tom-erro" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{erro}</span>
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm adm-aviso-acao" onClick={carregar}>
            <RotateCcw size={14} aria-hidden="true" /> Tentar de novo
          </button>
        </div>
      ) : (
        <>
        <div className="adm-card adm-fx-cartao" ref={cartaoRef}>
          <div className="adm-fx-alvo">
            <div className="adm-campo">
              <span className="adm-campo-rotulo">Solicitante</span>
              <SearchSelect value={solicitanteId} onChange={(v) => trocarAlvo(v, classe)} options={opcoes}
                placeholder="Busque pelo nome…" ariaLabel="Solicitante" />
            </div>

            <div className="adm-campo">
              <label htmlFor="fx-classe">Aplica-se a</label>
              <select id="fx-classe" className="adm-select" value={classe}
                onChange={(e) => trocarAlvo(solicitanteId, e.target.value)}>
                <option value={FLUXO_GERAL}>
                  Fluxo geral (todas as classes){linhaDe(solicitanteId, FLUXO_GERAL) ? ' · configurado' : ''}
                </option>
                {CLASSES_ADM.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}{linhaDe(solicitanteId, c.slug) ? ' · configurado' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {porAlcada && (
            <div className="adm-aviso tom-info">
              <Coins size={16} aria-hidden="true" />
              <span>
                Esta classe tem serviço com valor. Nesses casos a cadeia daqui decide{' '}
                <strong>primeiro</strong> e a <strong>alçada por valor</strong> entra depois,
                somando os aprovadores que a faixa exigir — acima de R$ 5.000, COO e Gerente
                Financeiro; acima de R$ 20.000, também o CEO.
              </span>
            </div>
          )}

          {!solicitanteId ? (
            <p className="adm-campo-dica">Escolha um solicitante para ver e montar a cadeia.</p>
          ) : (
            <>
              {/* Qual dos três estados a cadeia da tela está — e o que acontece
                  se ela for salva. Sem isto as três situações se parecem, e
                  salvar por engano congela um caminho que era automático. */}
              <div className="adm-fx-estado">
                <span className={`adm-fx-selo tom-${seloTom}`}>
                  {proprio && !editado ? <Pin size={13} aria-hidden="true" /> : <GitBranch size={13} aria-hidden="true" />}
                  {selo}
                </span>
                <p>
                  {editado && (proprio
                    ? 'Salve para a nova cadeia valer, ou descarte para voltar à que está cadastrada.'
                    : 'Ao salvar, esta cadeia vira uma exceção fixa e deixa de acompanhar o organograma.')}
                  {!editado && proprio && (
                    <>A cadeia{classe === FLUXO_GERAL ? ' vale para todas as classes e' : ' desta classe'} é fixa:
                      mudança de gestor no organograma <strong>não</strong> a altera. Edite os degraus e
                      salve, ou use “{herdaGeral ? 'Voltar ao fluxo geral' : 'Voltar ao padrão'}”.</>
                  )}
                  {!editado && fonte === 'herdada' && (
                    <>Esta classe não tem regra própria e segue o fluxo geral desta pessoa. Ajuste os
                      degraus abaixo e salve para ela ter um caminho só dela.</>
                  )}
                  {!editado && fonte === 'padrao' && padrao !== null && (padrao.pessoas.length
                    ? <>O coordenador da pessoa e o gerente acima dele. Ajusta-se sozinho quando alguém
                      troca de gestor; mexa só se este caminho não servir.</>
                    : <>Esta pessoa não tem ninguém acima dela no organograma — hoje ela{' '}
                      <strong>não consegue abrir</strong> chamado que exija aprovação. Monte a cadeia
                      abaixo para destravar, ou cadastre o superior dela no organograma.</>)}
                </p>
              </div>

              <div className="adm-fx-canvas" ref={canvasRef}>
                <div className="adm-fx-no adm-fx-no-inicio">
                  <span className="adm-fx-avatar"><User size={15} aria-hidden="true" /></span>
                  <span className="adm-fx-corpo">
                    <small>Solicitante</small>
                    <strong>{nomePorId[solicitanteId] || '—'}</strong>
                  </span>
                </div>

                {fonte === 'padrao' && padrao === null && (
                  <div className="adm-fx-seg">
                    <ChevronRight className="adm-fx-seta" size={18} aria-hidden="true" />
                    <div className="adm-fx-no adm-fx-no-padrao">
                      <Loader2 size={15} className="adm-spin" aria-hidden="true" />
                      <span className="adm-fx-corpo"><small>Lendo o organograma…</small></span>
                    </div>
                  </div>
                )}

                {/* A key é a posição, e não a pessoa: com a pessoa na key, cada
                    troca ou movimento remontava a etapa e o foco do teclado sumia
                    no meio da edição. */}
                {cadeia.map((id, i) => (
                  <div key={i} className="adm-fx-seg">
                    <ChevronRight className="adm-fx-seta" size={18} aria-hidden="true" />
                    <div className={`adm-fx-no adm-fx-no-etapa${fonte === 'padrao' && !editado ? ' adm-fx-no-padrao' : ''}${!id || repetidos.has(id) ? ' is-pendente' : ''}`}>
                      <span className="adm-fx-num" aria-hidden="true">{i + 1}</span>
                      <span className="adm-fx-avatar">
                        {id ? iniciais(nomePorId[id]) : <UserCircle2 size={15} aria-hidden="true" />}
                      </span>
                      <span className="adm-fx-corpo">
                        {/* Enquanto vale o padrão, a etapa diz POR QUE aquela
                            pessoa está ali — trocar um "Gerente" às cegas é o
                            engano que o rótulo evita. */}
                        <small>{(fonte === 'padrao' && !editado && papelPorId[id]) || `Aprovação ${i + 1}`}</small>
                        <SearchSelect
                          value={id}
                          onChange={(v) => editarCadeia((c) => c.map((x, idx) => (idx === i ? v : x)))}
                          options={opcoes}
                          placeholder="Escolha o aprovador…"
                          ariaLabel={`Aprovador ${i + 1}`}
                        />
                        {repetidos.has(id) && <em className="adm-fx-repetido">Já está em outra etapa</em>}
                        {/* Setas para os lados porque o diagrama corre na horizontal:
                            "subir" e "descer" não correspondiam ao que se via. No
                            celular ele empilha, e o CSS gira as setas junto. */}
                        <span className="adm-fx-tools">
                          <button type="button" className="mover" title="Mover para antes" aria-label={`Mover a etapa ${i + 1} para antes`}
                            disabled={i === 0}
                            onClick={() => mover(i, -1)}><ArrowLeft size={15} aria-hidden="true" /></button>
                          <button type="button" className="mover" title="Mover para depois" aria-label={`Mover a etapa ${i + 1} para depois`}
                            disabled={i === cadeia.length - 1}
                            onClick={() => mover(i, 1)}><ArrowRight size={15} aria-hidden="true" /></button>
                          <button type="button" title="Remover etapa" aria-label={`Remover a etapa ${i + 1}`} className="del"
                            onClick={() => editarCadeia((c) => c.filter((_, idx) => idx !== i))}>
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </span>
                      </span>
                    </div>
                  </div>
                ))}

                <div className="adm-fx-seg">
                  <ChevronRight className="adm-fx-seta" size={18} aria-hidden="true" />
                  <button type="button" className="adm-fx-add"
                    onClick={() => { abrirNovaEtapa.current = true; editarCadeia((c) => [...c, '']); }}>
                    <Plus size={15} aria-hidden="true" /> Aprovador
                  </button>
                </div>

                <div className="adm-fx-seg">
                  <ChevronRight className="adm-fx-seta" size={18} aria-hidden="true" />
                  <div className="adm-fx-no adm-fx-no-fim">
                    <span className="adm-fx-avatar"><Headset size={15} aria-hidden="true" /></span>
                    <span className="adm-fx-corpo">
                      <small>Atendimento</small>
                      <strong>Time do Atendimento</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Colado aos botões, e não no topo: é onde o olho está ao salvar, e
                  no celular o topo da página já saiu de vista. */}
              {erro && (
                <div className="adm-aviso tom-erro adm-fx-msg" role="alert">
                  <AlertCircle size={16} aria-hidden="true" /> <span>{erro}</span>
                </div>
              )}
              {salvo && (
                <div className="adm-aviso tom-ok adm-fx-msg" role="status">
                  <CheckCircle2 size={16} aria-hidden="true" /> <span>{salvo}</span>
                </div>
              )}

              <div className="adm-acoes adm-fx-acoes">
                {/* Sem edição, salvar aqui só congela o caminho automático como
                    exceção. Ainda pode ser o que se quer, então o botão continua,
                    mas sem o peso de ação principal; e cadastrada sem mudança não
                    tem o que salvar. */}
                <button
                  type="button"
                  className={`adm-btn ${editado ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
                  onClick={salvar}
                  disabled={salvando || removendo || (!editado && (proprio || cadeia.length === 0))}
                  title={!editado && !proprio ? 'Fixa a cadeia atual: ela deixa de acompanhar o organograma' : undefined}
                >
                  {salvando
                    ? <><Loader2 size={16} className="adm-spin" aria-hidden="true" /> Salvando…</>
                    : <><Save size={16} aria-hidden="true" /> {proprio ? 'Salvar alterações' : editado ? 'Salvar como exceção' : 'Fixar como exceção'}</>}
                </button>

                {/* Desfaz o rascunho sem ir ao banco — o efeito repõe a cadeia
                    que estava valendo quando `editado` volta a ser falso. */}
                {editado && (
                  <button type="button" className="adm-btn adm-btn-ghost"
                    onClick={() => { setErro(''); setSalvo(''); restaurarCadeia(); }}
                    disabled={salvando || removendo}>
                    <Undo2 size={16} aria-hidden="true" /> Descartar alterações
                  </button>
                )}

                {/* Só aparece quando existe o que remover: nas outras fontes o
                    botão não teria linha para apagar e viraria promessa vazia.
                    Afastado dos outros porque apaga o cadastro de vez. */}
                {proprio && (
                  <button type="button" className="adm-btn adm-btn-recusa adm-fx-remover" onClick={voltarAoPadrao}
                    disabled={salvando || removendo}>
                    {removendo
                      ? <><Loader2 size={16} className="adm-spin" aria-hidden="true" /> Removendo…</>
                      : <><RotateCcw size={16} aria-hidden="true" /> {herdaGeral ? 'Voltar ao fluxo geral' : 'Voltar ao padrão'}</>}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="adm-card">
          <h2 className="adm-card-tit">Exceções cadastradas ({excecoes.length})</h2>
          {excecoes.length === 0 ? (
            <p className="adm-campo-dica">
              Nenhuma: todo mundo segue o padrão do organograma.
            </p>
          ) : (
            <>
              <p className="adm-campo-dica">
                Quem saiu do caminho automático. Estas cadeias não acompanham troca de gestor.
              </p>
              <ul className="adm-fx-excecoes">
                {excecoes.map((f) => {
                  const atual = f.solicitante_id === solicitanteId && f.classe === classe;
                  return (
                    <li key={`${f.solicitante_id}/${f.classe}`}>
                      <button
                        type="button"
                        className={`adm-fx-excecao${atual ? ' is-atual' : ''}`}
                        aria-current={atual ? 'true' : undefined}
                        onClick={() => {
                          if (trocarAlvo(f.solicitante_id, f.classe)) {
                            cartaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }}
                      >
                        <strong>{f.nome}</strong>
                        <span className="adm-fx-excecao-classe">{rotuloClasse(f.classe)}</span>
                        <span className="adm-fx-excecao-cadeia">
                          {(f.aprovadores || []).map((id) => nomePorId[id] || 'Pessoa não encontrada').join(' → ')}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
        </>
      )}
    </div>
  );
}
