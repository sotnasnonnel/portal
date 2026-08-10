import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Plus, ToggleLeft, ToggleRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchGerencias, fetchProjetos } from '../../../modules/horas/lib/data';
import {
  fetchExcecoes, criarExcecao, setExcecaoAtiva, fetchColaboradoresDp,
} from '../../../services/horasExtras';
import { EXC_TIPO_LABEL, LIMITE_PADRAO, diaISO, fmtDataBr, fmtHora } from '../../../config/horasExtras';
import '../../../components/UI/Components.css';
import '../Admin.css';
import './HorasExtras.css';

// Central de Exceções de Prazo (módulo Gestão de Pessoas).
// A regra padrão é: pedido só até 12:00 do próprio dia e nada retroativo. Uma
// exceção ativa troca o horário-limite E libera o lançamento retroativo dentro
// do seu período — é o que resolve o caso descrito no próprio motivo
// ("colaborador em campo sem acesso ao sistema", "queda de energia").
// Escopos: solicitação específica (colaborador + 1 dia), colaborador por
// período, equipe/projeto por período e horário global do dia.
export default function ExcecoesPrazo() {
  const { user } = useAuth();

  const [list, setList] = useState([]);
  const [colabs, setColabs] = useState([]);
  const [gerencias, setGerencias] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    tipo: 'colaborador',
    novoHorario: '15:00',
    dataInicial: diaISO(),
    dataFinal: diaISO(),
    colaboradorId: '',
    gerenciaId: '',
    projetoId: '',
    motivo: '',
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const [excs, cs, gs, ps] = await Promise.all([
        fetchExcecoes(),
        fetchColaboradoresDp(),
        fetchGerencias(),
        fetchProjetos({ incluirArquivados: true }),
      ]);
      setList(excs);
      setColabs(cs);
      setGerencias(gs);
      setProjetos(ps);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar as exceções.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Solicitação específica é sempre 1 dia: a data final acompanha a inicial.
  const ehDiaUnico = form.tipo === 'solicitacao';
  const pedeColaborador = form.tipo === 'colaborador' || form.tipo === 'solicitacao';
  const pedeEquipe = form.tipo === 'equipe';

  const nomeAlvo = (e) => {
    if (e.tipo === 'global') return 'Toda a empresa';
    if (e.colaborador_id) return colabs.find((c) => c.id === e.colaborador_id)?.nome || 'Colaborador';
    const partes = [
      e.gerencia_id ? gerencias.find((g) => g.id === e.gerencia_id)?.nome : null,
      e.projeto_id ? projetos.find((p) => p.id === e.projeto_id)?.nome : null,
    ].filter(Boolean);
    return partes.join(' · ') || '—';
  };

  async function salvar() {
    setOk('');
    if (!form.motivo.trim()) return setErro('Informe o motivo da exceção.');
    if (pedeColaborador && !form.colaboradorId) return setErro('Selecione o colaborador.');
    if (pedeEquipe && !form.gerenciaId && !form.projetoId) {
      return setErro('Selecione a equipe ou o projeto.');
    }
    const dataFinal = ehDiaUnico ? form.dataInicial : form.dataFinal;
    if (dataFinal < form.dataInicial) return setErro('A data final não pode ser anterior à inicial.');

    setErro('');
    setSalvando(true);
    try {
      await criarExcecao({
        tipo: form.tipo,
        novoHorario: form.novoHorario,
        dataInicial: form.dataInicial,
        dataFinal,
        colaboradorId: form.colaboradorId || null,
        gerenciaId: form.gerenciaId || null,
        projetoId: form.projetoId || null,
        motivo: form.motivo.trim(),
        criadoPor: user?.id,
      });
      setForm((f) => ({ ...f, motivo: '', colaboradorId: '', gerenciaId: '', projetoId: '' }));
      setOk('Exceção registrada.');
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao registrar a exceção.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(e) {
    try {
      await setExcecaoAtiva(e.id, !e.ativa);
      await carregar();
    } catch (err) {
      setErro(err?.message || 'Falha ao alterar a exceção.');
    }
  }

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><ShieldAlert size={28} /> Exceções de Prazo</h1>
      <p className="page-subtitle">
        Regra padrão: solicitações de hora extra até {LIMITE_PADRAO} do próprio dia, sem retroativo.
        Uma exceção troca o horário-limite e libera o retroativo dentro do seu período.
      </p>

      <div className="he-alerta he-alerta--info">
        Toda exceção exige motivo e fica registrada na auditoria com quem a criou. Desativar não
        apaga o histórico: as solicitações já abertas por ela continuam marcadas.
      </div>

      {erro && <div className="he-alerta he-alerta--erro">{erro}</div>}
      {ok && <div className="he-alerta he-alerta--ok">{ok}</div>}

      <div className="table-container" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="table-header">
          <div className="table-header-title">Nova exceção</div>
          <Link className="btn btn-outline" to="/admin/horas-extras">
            <ArrowLeft size={18} /> Voltar ao painel
          </Link>
        </div>

        <div style={{ padding: '0 var(--space-lg) var(--space-lg)' }}>
          <div className="he-form-grid">
            <div className="form-group">
              <label className="form-label">Escopo da liberação</label>
              <select className="form-select" value={form.tipo} onChange={(e) => set({ tipo: e.target.value })}>
                {Object.entries(EXC_TIPO_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Novo horário limite</label>
              <input className="form-input" type="time" value={form.novoHorario}
                onChange={(e) => set({ novoHorario: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">{ehDiaUnico ? 'Data' : 'Data inicial'}</label>
              <input className="form-input" type="date" value={form.dataInicial}
                onChange={(e) => set({ dataInicial: e.target.value })} />
            </div>

            {!ehDiaUnico && (
              <div className="form-group">
                <label className="form-label">Data final</label>
                <input className="form-input" type="date" value={form.dataFinal}
                  min={form.dataInicial}
                  onChange={(e) => set({ dataFinal: e.target.value })} />
              </div>
            )}

            {pedeColaborador && (
              <div className="form-group">
                <label className="form-label">Colaborador</label>
                <select className="form-select" value={form.colaboradorId}
                  onChange={(e) => set({ colaboradorId: e.target.value })}>
                  <option value="">Selecione…</option>
                  {colabs.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}

            {pedeEquipe && (
              <>
                <div className="form-group">
                  <label className="form-label">Equipe (opcional)</label>
                  <select className="form-select" value={form.gerenciaId}
                    onChange={(e) => set({ gerenciaId: e.target.value })}>
                    <option value="">Todas</option>
                    {gerencias.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Projeto (opcional)</label>
                  <select className="form-select" value={form.projetoId}
                    onChange={(e) => set({ projetoId: e.target.value })}>
                    <option value="">Todos</option>
                    {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              </>
            )}

            <div className="form-group he-col-full">
              <label className="form-label">Motivo da exceção</label>
              <textarea className="form-input" rows={2} value={form.motivo}
                placeholder="Ex.: colaborador em campo sem acesso ao sistema, indisponibilidade do sistema, queda de energia…"
                onChange={(e) => set({ motivo: e.target.value })} />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-md)' }}>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
              <Plus size={18} /> {salvando ? 'Salvando...' : 'Salvar exceção'}
            </button>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Exceções registradas</div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Escopo</th>
                <th>Período</th>
                <th>Limite</th>
                <th>Alvo</th>
                <th>Motivo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-empty">Carregando dados...</td></tr>
              ) : (
                <>
                  {list.map((e) => (
                    <tr key={e.id} style={e.ativa ? undefined : { opacity: 0.55 }}>
                      <td>{EXC_TIPO_LABEL[e.tipo] || e.tipo}</td>
                      <td>{fmtDataBr(e.data_inicial)} a {fmtDataBr(e.data_final)}</td>
                      <td className="he-num">{fmtHora(e.novo_horario)}</td>
                      <td>{nomeAlvo(e)}</td>
                      <td style={{ maxWidth: 320 }}>{e.motivo}</td>
                      <td>
                        <span className={`badge ${e.ativa ? 'ativo' : 'inativo'}`}>
                          {e.ativa ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="btn-icon" title={e.ativa ? 'Desativar' : 'Reativar'}
                            onClick={() => alternar(e)}>
                            {e.ativa ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {list.length === 0 && (
                    <tr><td colSpan={7} className="table-empty">Nenhuma exceção registrada.</td></tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
