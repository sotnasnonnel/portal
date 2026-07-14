import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Play, Square, Plus } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchProjetos,
  fetchAtividades,
  fetchGerencias,
  fetchApontamentos,
  createApontamento,
  deleteApontamento,
  fetchTimer,
  startTimer,
  stopTimer,
} from '../../lib/data';
import { fmtData, fmtDur, startOfDay } from '../../lib/format';
import { podeApontar } from '../../lib/roles';
import { lookupProjetos } from '../../lib/lookups';
import ApontamentosTable from '../components/ApontamentosTable';
import ConfirmModal from '../components/ConfirmModal';
import ManualModal from '../components/ManualModal';
import SearchableSelect from '../components/SearchableSelect';

export default function ApontarPage() {
  const { user, modules } = useAuth();
  const role = modules?.horas || 'usuario';
  const colaboradorId = user?.id;
  const gerenciaId = user?.horasGerenciaId || null;

  const [projetos, setProjetos] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [gerenciaNome, setGerenciaNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [running, setRunning] = useState(null); // timer em andamento (do banco)
  const [busy, setBusy] = useState(false); // evita duplo clique em iniciar/encerrar
  const [hoje, setHoje] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const [aExcluir, setAExcluir] = useState(null);

  const [form, setForm] = useState({ projetoId: '', ativ: [], descricao: '' });

  const proj = useMemo(() => lookupProjetos(projetos), [projetos]);

  const carregarHoje = useCallback(async () => {
    if (!colaboradorId) return;
    try {
      setHoje(await fetchApontamentos({ role: 'usuario', colaboradorId, sinceTs: startOfDay(Date.now()) }));
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar apontamentos.');
    }
  }, [colaboradorId]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!colaboradorId || !gerenciaId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErro('');
      try {
        const [ps, ats, gers, timer] = await Promise.all([
          fetchProjetos({ gerenciaId }),
          fetchAtividades(gerenciaId),
          fetchGerencias(),
          fetchTimer(colaboradorId),
        ]);
        if (cancel) return;
        setProjetos(ps);
        setAtividades(ats);
        setGerenciaNome(gers.find((g) => g.id === gerenciaId)?.nome || '');
        setRunning(timer);
        // Defaults: primeiro projeto e o primeiro valor de cada atividade.
        // `ativ` é indexado pela ORDEM da atividade (0..2), com '' onde ela
        // ainda não tem opções — assim Ativ1/2/3 não trocam de significado
        // quando o gerente configura uma delas mais tarde.
        setForm((f) => ({
          projetoId: f.projetoId || ps[0]?.id || '',
          ativ: ats.map((a) => f.ativ[a.ordem] || a.valores[0] || ''),
          descricao: f.descricao,
        }));
        await carregarHoje();
      } catch (e) {
        if (!cancel) setErro(e?.message || 'Falha ao carregar a configuração da gerência.');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [colaboradorId, gerenciaId, carregarHoje]);

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

  // Ao iniciar/parar, reflete no form os valores em andamento (campos desabilitados).
  useEffect(() => {
    if (running) {
      setForm({
        projetoId: running.projetoId || '',
        ativ: running.ativ || [],
        descricao: running.descricao || '',
      });
    }
  }, [running]);

  // A diretoria supervisiona; não aponta horas (como no protótipo).
  if (!podeApontar(role)) return <Navigate to="/horas/dashboard" replace />;

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
            gerenciaId,
            projetoId: run.projetoId,
            ativ: run.ativ,
            descricao: run.descricao,
            inicioTs: run.inicio,
            fimTs: Date.now(),
          });
          await carregarHoje();
        }
      } else {
        const run = await startTimer(colaboradorId, {
          projetoId: form.projetoId,
          ativ: form.ativ,
          descricao: form.descricao,
        });
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
      await createApontamento({ colaboradorId, gerenciaId, ...payload });
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

  if (!gerenciaId) {
    return (
      <>
        <h1>Apontar Horas</h1>
        <div className="horas-hint">
          Seu usuário não está vinculado a uma gerência. Peça à gerência ou à diretoria para
          vincular você em "Equipe".
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <h1>Apontar Horas</h1>
        <div className="horas-hint">Carregando…</div>
      </>
    );
  }

  const setAtiv = (i, v) => setForm((f) => ({ ...f, ativ: f.ativ.map((x, j) => (j === i ? v : x)) }));

  // Uma atividade controlada sem opções cadastradas não aparece: até o gestor
  // configurá-la, a tela é só Projeto + Descrição.
  const ativVisiveis = atividades.filter((a) => a.valores.length);

  // Sem projetos na área ainda: a tela aparece normal, mas não dá para apontar
  // até o gestor cadastrar os projetos/atividades em "Configuração".
  const semProjetos = !projetos.length;
  const podeIniciar = !!form.projetoId && !semProjetos;

  return (
    <>
      <h1>Apontar Horas</h1>
      <p className="horas-sub">
        Área: <b>{gerenciaNome}</b> — selecione projeto e atividades e inicie o cronômetro.
      </p>

      {erro ? <div className="horas-hint">⚠️ {erro}</div> : null}

      {semProjetos ? (
        <div className="horas-hint">
          ⚠️ A sua área (<b>{gerenciaNome}</b>) ainda não tem projetos cadastrados, então não é
          possível apontar por enquanto. O <b>gestor</b> da sua equipe precisa cadastrá-los em
          "Configuração".
        </div>
      ) : null}

      <div className="horas-card">
        <div className="horas-sec">Apontamento</div>
        <div className="horas-timer-grid">
          <div className="horas-fld">
            <label>Projeto</label>
            <SearchableSelect
              value={form.projetoId}
              disabled={!!running}
              placeholder="Selecione o projeto…"
              onChange={(v) => setForm((f) => ({ ...f, projetoId: v }))}
              options={projetos.map((p) => ({
                value: p.id,
                label: p.nome + (p.cliente ? ` — ${p.cliente}` : ''),
              }))}
            />
          </div>
          {ativVisiveis.map((a) => (
            <div className="horas-fld" key={a.id}>
              <label>{a.label}</label>
              <SearchableSelect
                value={form.ativ[a.ordem] || ''}
                disabled={!!running}
                placeholder={`Selecione ${a.label.toLowerCase()}…`}
                onChange={(v) => setAtiv(a.ordem, v)}
                options={a.valores.map((v) => ({ value: v, label: v }))}
              />
            </div>
          ))}
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
            disabled={busy || (!running && !podeIniciar)}
          >
            {running ? <Square size={16} /> : <Play size={16} />}
            {running ? 'Encerrar' : 'Iniciar'}
          </button>
          <button
            className="horas-btn2"
            type="button"
            onClick={() => setShowManual(true)}
            disabled={!!running || semProjetos}
          >
            <Plus size={16} /> Lançamento manual
          </button>
        </div>

        {running ? (
          <div className="horas-live">
            <span className="horas-live-dot" />
            Em andamento desde {fmtData(running.inicio)} · {proj.nome(running.projetoId)}
          </div>
        ) : null}
      </div>

      <div className="horas-sec" style={{ marginTop: 22 }}>
        Apontamentos de hoje
      </div>
      <div className="horas-card horas-table-wrap">
        <ApontamentosTable list={hoje} projetoNome={proj.nome} projetoCor={proj.cor} onDelete={setAExcluir} />
      </div>

      {showManual ? (
        <ManualModal
          projetos={projetos}
          atividades={ativVisiveis}
          onClose={() => setShowManual(false)}
          onSave={salvarManual}
        />
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
