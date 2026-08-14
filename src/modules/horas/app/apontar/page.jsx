import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Play, Square, Plus } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchProjetosVisiveis,
  fetchGerencias,
  fetchCamposEquipe,
  fetchApontamentos,
  createApontamento,
  deleteApontamento,
  fetchTimer,
  startTimer,
  stopTimer,
} from '../../lib/data';
import { fmtData, fmtDur, startOfDay } from '../../lib/format';
import { isGestao, podeApontar, podeConfigurarApontamento } from '../../lib/roles';
import { lookupProjetos } from '../../lib/lookups';
import { faltando, paraPersistencia, valoresIniciais } from '../../lib/camposEquipe';
import ApontamentosTable from '../components/ApontamentosTable';
import CamposApontamento from '../components/CamposApontamento';
import ConfirmModal from '../components/ConfirmModal';
import ManualModal from '../components/ManualModal';
import SearchableSelect from '../components/SearchableSelect';

export default function ApontarPage() {
  const { user, modules } = useAuth();
  const role = modules?.horas || 'usuario';
  const colaboradorId = user?.id;
  const gerenciaId = user?.horasGerenciaId || null;

  const [projetos, setProjetos] = useState([]);
  const [campos, setCampos] = useState([]); // os que a EQUIPE configurou
  const [gerenciaNome, setGerenciaNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [running, setRunning] = useState(null); // timer em andamento (do banco)
  const [busy, setBusy] = useState(false); // evita duplo clique em iniciar/encerrar
  const [hoje, setHoje] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const [aExcluir, setAExcluir] = useState(null);

  // Projeto e descrição são fixos do módulo; o miolo do formulário são os
  // campos da equipe, guardados por id do campo em `valores`.
  const [form, setForm] = useState({ projetoId: '', descricao: '' });
  const [valores, setValores] = useState({});

  const proj = useMemo(() => lookupProjetos(projetos), [projetos]);
  const setValor = (campoId, valor) => setValores((v) => ({ ...v, [campoId]: valor }));
  const pendentes = faltando(campos, valores);

  // O apontamento é atribuído à área DONA do projeto (que pode ser a de um gestor
  // acima, por herança). Fallback: a própria área, se o projeto não for encontrado.
  const gerenciaDoProjeto = (projetoId) =>
    projetos.find((p) => p.id === projetoId)?.gerencia_id || gerenciaId;

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
        const [ps, gers, cps, timer] = await Promise.all([
          fetchProjetosVisiveis(),
          fetchGerencias(),
          fetchCamposEquipe(gerenciaId),
          fetchTimer(colaboradorId),
        ]);
        if (cancel) return;
        setProjetos(ps);
        setCampos(cps);
        setGerenciaNome(gers.find((g) => g.id === gerenciaId)?.nome || '');
        setRunning(timer);
        // Único default é o projeto: os campos da equipe são escolha consciente
        // de quem aponta, não têm um "primeiro" que faça sentido.
        setForm((f) => ({ ...f, projetoId: f.projetoId || ps[0]?.id || '' }));
        setValores((v) => (Object.keys(v).length ? v : valoresIniciais(cps)));
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
  // O timer guarda o que foi preenchido com rótulo e id; reidratamos pelo id.
  useEffect(() => {
    if (running) {
      setForm({ projetoId: running.projetoId || '', descricao: running.descricao || '' });
      setValores(valoresIniciais(campos, running.campos));
    }
  }, [running, campos]);

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
            gerenciaId: gerenciaDoProjeto(run.projetoId),
            projetoId: run.projetoId,
            // O que foi preenchido ao dar play, como estava naquele momento —
            // se a equipe mexeu na configuração no meio, o registro não muda.
            campos: run.campos,
            descricao: run.descricao,
            inicioTs: run.inicio,
            fimTs: Date.now(),
          });
          await carregarHoje();
        }
      } else {
        const run = await startTimer(colaboradorId, {
          projetoId: form.projetoId,
          campos: paraPersistencia(campos, valores),
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
      await createApontamento({ colaboradorId, gerenciaId: gerenciaDoProjeto(payload.projetoId), ...payload });
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

  // Sem projetos na área ainda: a tela aparece normal, mas não dá para apontar
  // até o gestor cadastrar os projetos em "Configuração".
  const semProjetos = !projetos.length;
  // Além do projeto, só falta o que a EQUIPE marcou como obrigatório.
  const podeIniciar = !!form.projetoId && !semProjetos && !pendentes.length;

  return (
    <>
      <h1>Apontar Horas</h1>
      <p className="horas-sub">
        Área: <b>{gerenciaNome}</b> — preencha os campos abaixo e inicie o cronômetro.
      </p>

      {erro ? <div className="horas-hint">⚠️ {erro}</div> : null}

      {semProjetos ? (
        <div className="horas-hint">
          ⚠️ A sua área (<b>{gerenciaNome}</b>) ainda não tem projetos cadastrados, então não é
          possível apontar por enquanto. O <b>gestor</b> da sua equipe precisa cadastrá-los em
          "Configuração".
        </div>
      ) : null}

      {/* Equipe sem campos configurados não fica travada: aponta com projeto e
          descrição. O aviso só vai para quem pode fazer algo a respeito — quem
          configura resolve na hora; a liderança sabe a quem pedir. */}
      {!campos.length && podeConfigurarApontamento(user) ? (
        <div className="horas-hint">
          A sua equipe ainda não tem campos de apontamento configurados. Defina-os em{' '}
          <b>Config. do Apontamento</b> para pedir sigla, tarefa, frente de serviço — o que fizer
          sentido aqui — antes do cronômetro.
        </div>
      ) : null}
      {!campos.length && isGestao(role) && !podeConfigurarApontamento(user) ? (
        <div className="horas-hint">
          A sua equipe ainda não tem campos de apontamento configurados — dá para apontar só com
          projeto e descrição. Peça a configuração ao administrador do Controle de Horas.
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
          <CamposApontamento
            campos={campos}
            valores={valores}
            disabled={!!running}
            onChange={setValor}
          />
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

        {/* Botão desabilitado sem dizer por quê é o tipo de coisa que gera
            chamado: dizemos qual campo falta, e o aviso some sozinho. */}
        {!running && !semProjetos && !!form.projetoId && pendentes.length ? (
          <div className="horas-hint" style={{ marginTop: 12 }}>
            Preencha {pendentes.join(', ')} para iniciar o cronômetro.
          </div>
        ) : null}

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
          campos={campos}
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
