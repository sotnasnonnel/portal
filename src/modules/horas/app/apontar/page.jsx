import { useCallback, useEffect, useMemo, useState } from 'react';
import { Play, Square, Plus } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchProjetos,
  fetchApontamentos,
  createApontamento,
  deleteApontamento,
  fetchTimer,
  startTimer,
  stopTimer,
} from '../../lib/data';
import { fmtData, fmtDur, startOfDay, toDatetimeLocal } from '../../lib/format';
import ApontamentosTable from '../components/ApontamentosTable';
import ConfirmModal from '../components/ConfirmModal';

export default function ApontarPage() {
  const { user } = useAuth();
  const colaboradorId = user?.id;

  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [running, setRunning] = useState(null); // timer em andamento (do banco)
  const [busy, setBusy] = useState(false); // evita duplo clique em iniciar/encerrar
  const [hoje, setHoje] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const [aExcluir, setAExcluir] = useState(null);

  const [form, setForm] = useState({ projetoId: '', descricao: '' });

  const projetoMap = useMemo(() => new Map(projetos.map((p) => [p.id, p])), [projetos]);
  const projetoNome = (id) => projetoMap.get(id)?.nome || '—';
  const projetoCor = (id) => projetoMap.get(id)?.cor || '#C44A28';

  const carregarHoje = useCallback(async () => {
    if (!colaboradorId) return;
    try {
      setHoje(await fetchApontamentos({ role: 'membro', colaboradorId, sinceTs: startOfDay(Date.now()) }));
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar apontamentos.');
    }
  }, [colaboradorId]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErro('');
      try {
        const [ps, timer] = await Promise.all([
          fetchProjetos(),
          colaboradorId ? fetchTimer(colaboradorId) : Promise.resolve(null),
        ]);
        if (cancel) return;
        setProjetos(ps);
        setRunning(timer);
        setForm((f) => ({ ...f, projetoId: f.projetoId || ps[0]?.id || '' }));
        await carregarHoje();
      } catch (e) {
        if (!cancel) setErro(e?.message || 'Falha ao carregar os projetos.');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [colaboradorId, carregarHoje]);

  // Cronômetro: atualiza os ms decorridos a cada segundo (Date.now só no effect).
  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return undefined;
    }
    const compute = () => setElapsed(Date.now() - running.inicio);
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Ao iniciar/parar, reflete no form os valores em andamento (selects desabilitados).
  useEffect(() => {
    if (running) setForm({ projetoId: running.projetoId || '', descricao: running.descricao || '' });
  }, [running]);

  async function toggleTimer() {
    if (!colaboradorId || busy) return;
    setBusy(true);
    setErro('');
    try {
      if (running) {
        const run = await stopTimer(colaboradorId);
        setRunning(null);
        if (run) {
          await createApontamento({
            colaboradorId,
            projetoId: run.projetoId,
            descricao: run.descricao,
            inicioTs: run.inicio,
            fimTs: Date.now(),
          });
          await carregarHoje();
        }
      } else {
        const run = await startTimer(colaboradorId, { projetoId: form.projetoId, descricao: form.descricao });
        setRunning(run);
      }
    } catch (e) {
      setErro(e?.message || 'Falha ao atualizar o cronômetro.');
    } finally {
      setBusy(false);
    }
  }

  async function salvarManual(payload) {
    try {
      await createApontamento({ colaboradorId, ...payload });
      setShowManual(false);
      await carregarHoje();
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar o lançamento.');
    }
  }

  async function confirmarExclusao() {
    const a = aExcluir;
    setAExcluir(null);
    if (!a) return;
    try {
      await deleteApontamento(a.id);
      await carregarHoje();
    } catch (e) {
      setErro(e?.message || 'Falha ao excluir.');
    }
  }

  if (loading) {
    return (
      <>
        <h1>Apontar Horas</h1>
        <div className="horas-hint">Carregando…</div>
      </>
    );
  }

  if (!projetos.length) {
    return (
      <>
        <h1>Apontar Horas</h1>
        <div className="horas-hint">
          Ainda não há projetos cadastrados. Um administrador precisa criar projetos em "Projetos"
          para que seja possível apontar horas.
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Apontar Horas</h1>
      <p className="horas-sub">Escolha o projeto, descreva a atividade e inicie o cronômetro.</p>

      {erro ? <div className="horas-hint">⚠️ {erro}</div> : null}

      <div className="horas-card">
        <div className="horas-sec">Registro de tempo</div>
        <div className="horas-timer-grid">
          <div className="horas-fld">
            <label>Projeto</label>
            <select
              value={form.projetoId}
              disabled={!!running}
              onChange={(e) => setForm((f) => ({ ...f, projetoId: e.target.value }))}
            >
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {p.cliente ? ` — ${p.cliente}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="horas-fld" style={{ gridColumn: '1 / -1' }}>
            <label>Descrição (opcional)</label>
            <input
              type="text"
              placeholder="No que você está trabalhando?"
              value={form.descricao}
              disabled={!!running}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </div>
        </div>

        <div className={`horas-timer-display ${running ? 'running' : ''}`}>{fmtDur(elapsed)}</div>

        <div className="horas-timer-actions">
          <button
            className={`horas-btn ${running ? 'red' : 'grn'}`}
            type="button"
            onClick={toggleTimer}
            disabled={busy}
          >
            {running ? <Square size={16} /> : <Play size={16} />}
            {running ? 'Encerrar' : 'Iniciar'}
          </button>
          <button className="horas-btn2" type="button" onClick={() => setShowManual(true)} disabled={!!running}>
            <Plus size={16} /> Lançamento manual
          </button>
        </div>

        {running ? (
          <div className="horas-live">
            <span className="horas-live-dot" />
            Em andamento desde {fmtData(running.inicio)} · {projetoNome(running.projetoId)}
          </div>
        ) : null}
      </div>

      <div className="horas-sec" style={{ marginTop: 22 }}>
        Apontamentos de hoje
      </div>
      <div className="horas-card horas-table-wrap">
        <ApontamentosTable list={hoje} projetoNome={projetoNome} projetoCor={projetoCor} onDelete={setAExcluir} />
      </div>

      {showManual ? (
        <ManualModal projetos={projetos} onClose={() => setShowManual(false)} onSave={salvarManual} />
      ) : null}

      <ConfirmModal
        open={!!aExcluir}
        title="Excluir apontamento"
        message="Tem certeza que deseja excluir este apontamento? Esta ação não pode ser desfeita."
        onConfirm={confirmarExclusao}
        onCancel={() => setAExcluir(null)}
      />
    </>
  );
}

// --- Modal de lançamento manual -------------------------------------------
function ManualModal({ projetos, onClose, onSave }) {
  const [projetoId, setProjetoId] = useState(projetos[0]?.id || '');
  const [descricao, setDescricao] = useState('');
  const [ini, setIni] = useState(() => toDatetimeLocal(Date.now() - 3600000));
  const [fim, setFim] = useState(() => toDatetimeLocal(Date.now()));
  const [erro, setErro] = useState('');

  function submit() {
    const inicioTs = new Date(ini).getTime();
    const fimTs = new Date(fim).getTime();
    if (!(fimTs > inicioTs)) {
      setErro('O horário de fim deve ser maior que o de início.');
      return;
    }
    onSave({ projetoId, descricao, inicioTs, fimTs });
  }

  return (
    <div className="horas-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="horas-modal">
        <h3>Lançamento manual</h3>
        <div className="horas-fld">
          <label>Projeto</label>
          <select value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
            {projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.cliente ? ` — ${p.cliente}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="horas-fld">
          <label>Descrição</label>
          <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div className="horas-fld">
          <label>Início</label>
          <input type="datetime-local" value={ini} onChange={(e) => setIni(e.target.value)} />
        </div>
        <div className="horas-fld">
          <label>Fim</label>
          <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        {erro ? <div className="horas-hint" style={{ marginBottom: 8 }}>⚠️ {erro}</div> : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="horas-btn2" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="horas-btn" type="button" onClick={submit}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
