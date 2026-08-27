import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Workflow, Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, AlertCircle, CheckCircle2, Coins,
  ChevronRight, User, UserCircle2, Headset, GitBranch, RotateCcw, Undo2,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../services/supabase';
import { CLASSES_ADM } from '../../../../config/administrativo';
import SearchSelect from '../../../../components/UI/SearchSelect';
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

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [gente, { data, error }] = await Promise.all([
        listarPessoas(),
        supabase.from('chamados_adm_fluxos').select('solicitante_id, classe, aprovadores'),
      ]);
      if (error) throw new Error(error.message);
      setPessoas(gente);
      setFluxos(data || []);
    } catch (e) {
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
   */
  const restaurarCadeia = useCallback(() => {
    setEditado(false);
    setSalvo('');
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
  }, [solicitanteId, classe]);

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
    setCadeia(fn);
  };

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
    if (!window.confirm(`Remover a cadeia cadastrada e voltar ${volta}?`)) return;
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
      setSalvo(`Exceção removida — o chamado volta ${volta}.`);
    } catch (e) {
      setErro(`Não foi possível remover: ${e.message}`);
    } finally {
      setRemovendo(false);
    }
  };

  if (modules?.administrativo !== 'admin') return <Navigate to="/administrativo/novo" replace />;

  const porAlcada = classe && CLASSES_POR_ALCADA.has(classe);

  return (
    <div className="adm-page adm-page-wide">
      <h1 className="adm-title"><Workflow size={24} /> Fluxos de aprovação</h1>
      <p className="adm-sub">
        Defina por quais aprovadores passa o chamado de cada pessoa. O fluxo geral vale para
        todas as classes; cadastre uma classe só quando ela precisar de um caminho diferente.
      </p>

      {erro && <div className="adm-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}
      {salvo && <div className="adm-aviso tom-info"><CheckCircle2 size={16} /> {salvo}</div>}

      {carregando ? (
        <div className="adm-vazio"><Loader2 size={20} className="adm-spin" /> Carregando…</div>
      ) : (
        <div className="adm-card">
          <div className="adm-campo">
            <label>Solicitante</label>
            <SearchSelect value={solicitanteId} onChange={setSolicitanteId} options={opcoes}
              placeholder="Busque pelo nome…" ariaLabel="Solicitante" />
          </div>

          <div className="adm-campo">
            <label htmlFor="fx-classe">Aplica-se a</label>
            <select id="fx-classe" className="adm-select" value={classe}
              onChange={(e) => setClasse(e.target.value)}>
              <option value={FLUXO_GERAL}>Fluxo geral (todas as classes)</option>
              {CLASSES_ADM.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}{linhaDe(solicitanteId, c.slug) ? ' · configurado' : ''}
                </option>
              ))}
            </select>
          </div>

          {porAlcada && (
            <div className="adm-aviso tom-info">
              <Coins size={16} />
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
              <div className="adm-aviso tom-info">
                <GitBranch size={16} />
                <span>
                  {fonte === 'propria' && (
                    <>Esta pessoa tem uma <strong>exceção cadastrada</strong>
                      {classe === FLUXO_GERAL ? ' para todas as classes' : ' nesta classe'}.
                      A cadeia abaixo é fixa: mudança de gestor no organograma{' '}
                      <strong>não</strong> a altera. Edite os degraus e salve, ou use
                      “{herdaGeral ? 'Voltar ao fluxo geral' : 'Voltar ao padrão'}”.</>
                  )}
                  {fonte === 'herdada' && (
                    <>Esta classe não tem regra própria e segue o{' '}
                      <strong>fluxo geral</strong> desta pessoa. Ajuste os degraus abaixo e
                      salve para esta classe passar a ter um caminho só dela.</>
                  )}
                  {fonte === 'padrao' && (padrao === null
                    ? 'Consultando o organograma…'
                    : padrao.pessoas.length
                      ? <>Seguindo o <strong>padrão do organograma</strong>: o coordenador da
                        pessoa e o gerente acima dele. Ele se ajusta sozinho quando alguém
                        troca de gestor. Mexa nos degraus abaixo só se este caminho não servir
                        — ao salvar, a cadeia vira uma exceção fixa.</>
                      : <>Esta pessoa não tem ninguém acima dela no organograma — hoje ela{' '}
                        <strong>não consegue abrir</strong> chamado que exija aprovação.
                        Monte a cadeia abaixo para destravar, ou cadastre o superior dela
                        no organograma.</>)}
                </span>
              </div>

              <div className="adm-fx-canvas">
                <div className="adm-fx-no adm-fx-no-inicio">
                  <span className="adm-fx-avatar"><User size={15} /></span>
                  <span className="adm-fx-corpo">
                    <small>Solicitante</small>
                    <strong>{nomePorId[solicitanteId] || '—'}</strong>
                  </span>
                </div>

                {fonte === 'padrao' && padrao === null && (
                  <div className="adm-fx-seg">
                    <ChevronRight className="adm-fx-seta" size={18} />
                    <div className="adm-fx-no adm-fx-no-padrao">
                      <Loader2 size={15} className="adm-spin" />
                      <span className="adm-fx-corpo"><small>Lendo o organograma…</small></span>
                    </div>
                  </div>
                )}

                {cadeia.map((id, i) => (
                  <div key={`${id}-${i}`} className="adm-fx-seg">
                    <ChevronRight className="adm-fx-seta" size={18} />
                    <div className={`adm-fx-no adm-fx-no-etapa${fonte === 'padrao' && !editado ? ' adm-fx-no-padrao' : ''}`}>
                      <span className="adm-fx-num">{i + 1}</span>
                      <span className="adm-fx-avatar">
                        {id ? iniciais(nomePorId[id]) : <UserCircle2 size={15} />}
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
                      </span>
                      <span className="adm-fx-tools">
                        <button type="button" title="Subir" disabled={i === 0}
                          onClick={() => mover(i, -1)}><ChevronUp size={14} /></button>
                        <button type="button" title="Descer" disabled={i === cadeia.length - 1}
                          onClick={() => mover(i, 1)}><ChevronDown size={14} /></button>
                        <button type="button" title="Remover" className="del"
                          onClick={() => editarCadeia((c) => c.filter((_, idx) => idx !== i))}>
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </div>
                  </div>
                ))}

                <div className="adm-fx-seg">
                  <ChevronRight className="adm-fx-seta" size={18} />
                  <button type="button" className="adm-fx-add"
                    onClick={() => editarCadeia((c) => [...c, ''])}>
                    <Plus size={15} /> Aprovador
                  </button>
                </div>

                <div className="adm-fx-seg">
                  <ChevronRight className="adm-fx-seta" size={18} />
                  <div className="adm-fx-no adm-fx-no-fim">
                    <span className="adm-fx-avatar"><Headset size={15} /></span>
                    <span className="adm-fx-corpo">
                      <small>Atendimento</small>
                      <strong>Time do Administrativo</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="adm-acoes">
                <button type="button" className="adm-btn adm-btn-primary" onClick={salvar}
                  disabled={salvando || removendo}>
                  {salvando
                    ? <><Loader2 size={16} className="adm-spin" /> Salvando…</>
                    : <><Save size={16} /> {fonte === 'propria' ? 'Salvar alterações' : 'Salvar como exceção'}</>}
                </button>

                {/* Só aparece quando existe o que remover: nas outras fontes o
                    botão não teria linha para apagar e viraria promessa vazia. */}
                {fonte === 'propria' && (
                  <button type="button" className="adm-btn adm-btn-ghost" onClick={voltarAoPadrao}
                    disabled={salvando || removendo}>
                    {removendo
                      ? <><Loader2 size={16} className="adm-spin" /> Removendo…</>
                      : <><RotateCcw size={16} /> {herdaGeral ? 'Voltar ao fluxo geral' : 'Voltar ao padrão'}</>}
                  </button>
                )}

                {/* Desfaz o rascunho sem ir ao banco — o efeito repõe a cadeia
                    que estava valendo quando `editado` volta a ser falso. */}
                {editado && (
                  <button type="button" className="adm-btn adm-btn-ghost"
                    onClick={() => { setErro(''); restaurarCadeia(); }}
                    disabled={salvando || removendo}>
                    <Undo2 size={16} /> Descartar alterações
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
