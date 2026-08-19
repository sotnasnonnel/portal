import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Workflow, Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, AlertCircle, CheckCircle2, Coins,
  ChevronRight, User, UserCircle2, Headset, GitBranch,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../services/supabase';
import { CLASSES_ADM } from '../../../../config/administrativo';
import SearchSelect from '../../../../components/UI/SearchSelect';
import { listarPessoas } from '../../lib/chamados';
import { SERVICOS_COM_ALCADA, FLUXO_GERAL } from '../../lib/alcadaAdm';
import { resolverPapeis } from '../../../../services/alcadas';

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
  // Quem aprovaria HOJE se nada estivesse cadastrado: o superior direto, lido do
  // organograma. Sem mostrar isso, a tela parecia dizer que não há fluxo nenhum.
  const [padrao, setPadrao] = useState(null);   // null = ainda buscando
  const [temCadastro, setTemCadastro] = useState(false);

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

  // Classe sem regra própria herda a cadeia geral — mesmo pré-preenchimento do DP.
  useEffect(() => {
    if (!solicitanteId) { setCadeia([]); setTemCadastro(false); return; }
    const linha = linhaDe(solicitanteId, classe);
    if (linha) {
      setCadeia([...(linha.aprovadores || [])]);
      setTemCadastro(true);
      return;
    }
    const geral = linhaDe(solicitanteId, FLUXO_GERAL);
    setCadeia(classe === FLUXO_GERAL ? [] : [...(geral?.aprovadores || [])]);
    setTemCadastro(classe !== FLUXO_GERAL && !!geral);
    setSalvo('');
  }, [solicitanteId, classe, linhaDe]);

  // O padrão do organograma, buscado por solicitante. É o que vale de verdade
  // quando ninguém cadastrou nada — e é a informação que faltava na tela.
  useEffect(() => {
    if (!solicitanteId) { setPadrao(null); return undefined; }
    let cancelado = false;
    setPadrao(null);
    resolverPapeis(solicitanteId, ['GERENTE'])
      .then((r) => {
        if (cancelado) return;
        const primeira = (r?.etapas || [])[0];
        setPadrao({ nome: primeira?.nome || primeira?.candidatos?.[0]?.nome || '' });
      })
      .catch(() => { if (!cancelado) setPadrao({ nome: '' }); });
    return () => { cancelado = true; };
  }, [solicitanteId]);

  const nomePorId = useMemo(
    () => Object.fromEntries(pessoas.map((p) => [p.id, p.nome])),
    [pessoas],
  );
  const opcoes = useMemo(() => pessoas.map((p) => ({ value: p.id, label: p.nome })), [pessoas]);

  const mover = (i, d) => setCadeia((c) => {
    const alvo = i + d;
    if (alvo < 0 || alvo >= c.length) return c;
    const copia = [...c];
    [copia[i], copia[alvo]] = [copia[alvo], copia[i]];
    return copia;
  });

  const salvar = async () => {
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
      setSalvo('Fluxo salvo.');
    } catch (e) {
      setErro(`Não foi possível salvar: ${e.message}`);
    } finally {
      setSalvando(false);
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
                Esta classe tem serviço com valor, e nesses casos quem aprova é definido pela
                <strong> alçada por valor</strong> — a mesma tabela do Financeiro. O que você
                cadastrar aqui não será usado nesses serviços.
              </span>
            </div>
          )}

          {!solicitanteId ? (
            <p className="adm-campo-dica">Escolha um solicitante para ver e montar a cadeia.</p>
          ) : (
            <>
              {/* Sem cadastro NÃO significa sem aprovação: o chamado cai no
                  superior direto. Dizer isso aqui evita a leitura de que a
                  pessoa está sem fluxo — que era o que a tela sugeria. */}
              {!temCadastro && (
                <div className="adm-aviso tom-info">
                  <GitBranch size={16} />
                  <span>
                    {padrao === null
                      ? 'Consultando o organograma…'
                      : padrao?.nome
                        ? <>Nada cadastrado para esta pessoa, então vale o padrão do organograma:
                          o chamado vai para <strong>{padrao.nome}</strong>, o superior direto.
                          Cadastre abaixo só se o caminho precisar ser outro.</>
                        : <>Esta pessoa não tem superior no organograma nem fluxo cadastrado —
                          hoje ela <strong>não consegue abrir</strong> chamado que exija aprovação.
                          Monte a cadeia abaixo para destravar.</>}
                  </span>
                </div>
              )}

              <div className="adm-fx-canvas">
                <div className="adm-fx-no adm-fx-no-inicio">
                  <span className="adm-fx-avatar"><User size={15} /></span>
                  <span className="adm-fx-corpo">
                    <small>Solicitante</small>
                    <strong>{nomePorId[solicitanteId] || '—'}</strong>
                  </span>
                </div>

                {/* Padrão do organograma desenhado como etapa fantasma: mostra o
                    que acontece hoje sem fingir que está cadastrado. */}
                {!temCadastro && cadeia.length === 0 && padrao?.nome && (
                  <div className="adm-fx-seg">
                    <ChevronRight className="adm-fx-seta" size={18} />
                    <div className="adm-fx-no adm-fx-no-padrao">
                      <span className="adm-fx-avatar">{iniciais(padrao.nome)}</span>
                      <span className="adm-fx-corpo">
                        <small>Padrão · superior direto</small>
                        <strong>{padrao.nome}</strong>
                      </span>
                    </div>
                  </div>
                )}

                {cadeia.map((id, i) => (
                  <div key={`${id}-${i}`} className="adm-fx-seg">
                    <ChevronRight className="adm-fx-seta" size={18} />
                    <div className="adm-fx-no adm-fx-no-etapa">
                      <span className="adm-fx-num">{i + 1}</span>
                      <span className="adm-fx-avatar">
                        {id ? iniciais(nomePorId[id]) : <UserCircle2 size={15} />}
                      </span>
                      <span className="adm-fx-corpo">
                        <small>Aprovação {i + 1}</small>
                        <SearchSelect
                          value={id}
                          onChange={(v) => setCadeia((c) => c.map((x, idx) => (idx === i ? v : x)))}
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
                          onClick={() => setCadeia((c) => c.filter((_, idx) => idx !== i))}>
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </div>
                  </div>
                ))}

                <div className="adm-fx-seg">
                  <ChevronRight className="adm-fx-seta" size={18} />
                  <button type="button" className="adm-fx-add"
                    onClick={() => setCadeia((c) => [...c, ''])}>
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
                <button type="button" className="adm-btn adm-btn-primary" onClick={salvar} disabled={salvando}>
                  {salvando ? <><Loader2 size={16} className="adm-spin" /> Salvando…</> : <><Save size={16} /> Salvar fluxo</>}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
