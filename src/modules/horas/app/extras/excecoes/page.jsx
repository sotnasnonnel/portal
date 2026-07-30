import { useCallback, useEffect, useState } from 'react';
import { Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import { fetchGerencias, fetchProjetos } from '../../../lib/data';
import {
  fetchExcecoes,
  criarExcecao,
  setExcecaoAtiva,
  fetchColaboradoresDp,
} from '../../../lib/dataHorasExtras';
import { EXC_TIPO_LABEL, LIMITE_PADRAO, diaISO, fmtDataBr, fmtHora } from '../../../lib/horasExtras';
import SearchableSelect from '../../components/SearchableSelect';

// Central de Exceções de Prazo (DP).
// A regra padrão é: pedido só até 12:00 do próprio dia e nada retroativo. Uma
// exceção ativa troca o horário-limite E libera o lançamento retroativo dentro
// do seu período — é o que resolve o caso descrito no próprio motivo
// ("colaborador em campo sem acesso ao sistema", "queda de energia").
// Escopos: solicitação específica (colaborador + 1 dia), colaborador por
// período, equipe/projeto por período e horário global do dia.
export default function ExcecoesHEPage() {
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

  useEffect(() => {
    carregar();
  }, [carregar]);

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
    if (!form.motivo.trim()) {
      setErro('Informe o motivo da exceção.');
      return;
    }
    if (pedeColaborador && !form.colaboradorId) {
      setErro('Selecione o colaborador.');
      return;
    }
    if (pedeEquipe && !form.gerenciaId && !form.projetoId) {
      setErro('Selecione a equipe ou o projeto.');
      return;
    }
    const dataFinal = ehDiaUnico ? form.dataInicial : form.dataFinal;
    if (dataFinal < form.dataInicial) {
      setErro('A data final não pode ser anterior à inicial.');
      return;
    }
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
    <>
      <h1>Central de Exceções de Prazo</h1>
      <p className="horas-sub">
        Regra padrão: solicitações até <b>{LIMITE_PADRAO}</b> do próprio dia, sem retroativo. Uma
        exceção troca o horário-limite e libera o retroativo dentro do seu período.
      </p>

      <div className="horas-hint">
        Toda exceção exige <b>motivo</b> e fica registrada na auditoria com quem a criou. Desativar
        não apaga o histórico: as solicitações já abertas por ela continuam marcadas.
      </div>

      {erro ? <div className="horas-hint is-erro">⚠️ {erro}</div> : null}
      {ok ? <div className="horas-hint is-ok">✅ {ok}</div> : null}

      <div className="horas-card">
        <div className="horas-sec">Nova exceção</div>
        <div className="horas-timer-grid">
          <div className="horas-fld">
            <label>Escopo da liberação</label>
            <select value={form.tipo} onChange={(e) => set({ tipo: e.target.value })}>
              {Object.entries(EXC_TIPO_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="horas-fld">
            <label>Novo horário limite</label>
            <input
              type="time"
              value={form.novoHorario}
              onChange={(e) => set({ novoHorario: e.target.value })}
            />
          </div>
          <div className="horas-fld">
            <label>{ehDiaUnico ? 'Data' : 'Data inicial'}</label>
            <input
              type="date"
              value={form.dataInicial}
              onChange={(e) => set({ dataInicial: e.target.value })}
            />
          </div>
          {!ehDiaUnico ? (
            <div className="horas-fld">
              <label>Data final</label>
              <input
                type="date"
                value={form.dataFinal}
                onChange={(e) => set({ dataFinal: e.target.value })}
              />
            </div>
          ) : null}

          {pedeColaborador ? (
            <div className="horas-fld">
              <label>Colaborador</label>
              <SearchableSelect
                value={form.colaboradorId}
                placeholder="Selecione o colaborador…"
                onChange={(v) => set({ colaboradorId: v })}
                options={colabs.map((c) => ({ value: c.id, label: c.nome }))}
              />
            </div>
          ) : null}

          {pedeEquipe ? (
            <>
              <div className="horas-fld">
                <label>Equipe (opcional)</label>
                <SearchableSelect
                  value={form.gerenciaId}
                  placeholder="Todas"
                  onChange={(v) => set({ gerenciaId: v })}
                  options={[
                    { value: '', label: 'Todas' },
                    ...gerencias.map((g) => ({ value: g.id, label: g.nome })),
                  ]}
                />
              </div>
              <div className="horas-fld">
                <label>Projeto (opcional)</label>
                <SearchableSelect
                  value={form.projetoId}
                  placeholder="Todos"
                  onChange={(v) => set({ projetoId: v })}
                  options={[
                    { value: '', label: 'Todos' },
                    ...projetos.map((p) => ({ value: p.id, label: p.nome })),
                  ]}
                />
              </div>
            </>
          ) : null}

          <div className="horas-fld" style={{ gridColumn: '1 / -1' }}>
            <label>Motivo da exceção</label>
            <textarea
              rows={2}
              placeholder="Ex.: colaborador em campo sem acesso ao sistema, indisponibilidade do sistema, queda de energia…"
              value={form.motivo}
              onChange={(e) => set({ motivo: e.target.value })}
            />
          </div>
        </div>

        <div className="horas-timer-actions">
          <button className="horas-btn" type="button" onClick={salvar} disabled={salvando}>
            <Plus size={16} /> {salvando ? 'Salvando…' : 'Salvar exceção'}
          </button>
        </div>
      </div>

      <div className="horas-sec" style={{ marginTop: 22 }}>
        Exceções registradas
      </div>
      <div className="horas-card horas-table-wrap">
        {loading ? (
          <div className="horas-empty">Carregando…</div>
        ) : (
          <table className="horas-tbl-resp">
            <thead>
              <tr>
                <th>Escopo</th>
                <th>Período</th>
                <th>Limite</th>
                <th>Alvo</th>
                <th>Motivo</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} style={e.ativa ? undefined : { opacity: 0.55 }}>
                  <td data-label="Escopo">{EXC_TIPO_LABEL[e.tipo] || e.tipo}</td>
                  <td className="horas-muted" data-label="Período">
                    {fmtDataBr(e.data_inicial)} a {fmtDataBr(e.data_final)}
                  </td>
                  <td data-label="Limite">{fmtHora(e.novo_horario)}</td>
                  <td data-label="Alvo">{nomeAlvo(e)}</td>
                  <td className="horas-muted" data-label="Motivo" style={{ maxWidth: 280 }}>
                    {e.motivo}
                  </td>
                  <td data-label="Status">
                    <span className={`horas-he-badge ${e.ativa ? 'aprovada' : 'cancelada'}`}>
                      {e.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="horas-right horas-td-acao">
                    <button
                      className="horas-btn-icon"
                      type="button"
                      title={e.ativa ? 'Desativar' : 'Reativar'}
                      onClick={() => alternar(e)}
                    >
                      {e.ativa ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="horas-empty">
                    Nenhuma exceção registrada.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
