import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Workflow, Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, AlertCircle, CheckCircle2, Coins,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../services/supabase';
import { CLASSES_ADM } from '../../../../config/administrativo';
import SearchSelect from '../../../../components/UI/SearchSelect';
import { listarPessoas } from '../../lib/chamados';
import { SERVICOS_COM_ALCADA, FLUXO_GERAL } from '../../lib/alcadaAdm';

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
    if (!solicitanteId) { setCadeia([]); return; }
    const linha = linhaDe(solicitanteId, classe);
    if (linha) { setCadeia([...(linha.aprovadores || [])]); return; }
    const geral = linhaDe(solicitanteId, FLUXO_GERAL);
    setCadeia(classe === FLUXO_GERAL ? [] : [...(geral?.aprovadores || [])]);
    setSalvo('');
  }, [solicitanteId, classe, linhaDe]);

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
            <p className="adm-campo-dica">Escolha um solicitante para montar a cadeia.</p>
          ) : (
            <>
              <div className="adm-campo">
                <label>Cadeia de aprovação, na ordem</label>
                {cadeia.length === 0 && (
                  <span className="adm-campo-dica">
                    Cadeia vazia: os chamados desta pessoa não passam por aprovação.
                  </span>
                )}
                {cadeia.map((id, i) => (
                  <div key={`${id}-${i}`} className="adm-linha">
                    <span className="adm-ordem">{i + 1}</span>
                    <SearchSelect
                      value={id}
                      onChange={(v) => setCadeia((c) => c.map((x, idx) => (idx === i ? v : x)))}
                      options={opcoes}
                      placeholder="Escolha o aprovador…"
                      ariaLabel={`Aprovador ${i + 1}`}
                    />
                    <button type="button" className="adm-anexo-x" title="Subir" onClick={() => mover(i, -1)}>
                      <ChevronUp size={15} />
                    </button>
                    <button type="button" className="adm-anexo-x" title="Descer" onClick={() => mover(i, 1)}>
                      <ChevronDown size={15} />
                    </button>
                    <button type="button" className="adm-anexo-x" title="Remover"
                      onClick={() => setCadeia((c) => c.filter((_, idx) => idx !== i))}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button type="button" className="adm-anexo-btn" onClick={() => setCadeia((c) => [...c, ''])}>
                  <Plus size={16} /> Adicionar aprovador
                </button>
              </div>

              {cadeia.length > 0 && (
                <p className="adm-campo-dica">
                  Ordem: {cadeia.map((id) => nomePorId[id] || '—').join(' → ')}
                </p>
              )}

              <div className="adm-acoes">
                <button type="button" className="adm-btn adm-btn-primary" onClick={salvar} disabled={salvando}>
                  {salvando ? <><Loader2 size={16} className="adm-spin" /> Salvando…</> : <><Save size={16} /> Salvar</>}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
