import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, CalendarPlus, CalendarCheck, CalendarClock, Hourglass, Wallet, Pencil, Trash2, Ban,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  fmtDataBr, podeCancelar, resumoSaldo, rotuloPeriodo,
} from '../../config/ausenciaProgramada';
import {
  cancelar, excluirRascunho, fetchMeuAprovador, gerarAlertas, gerarPeriodos, listarPeriodos,
  listarSolicitacoes, salvarPedido,
} from '../../services/ausenciaProgramada';
import {
  Alerta, ModalMotivo, ModalPedido, SituacaoPeriodo, StatCard, StatusBadge,
} from './componentes';
import { useRecarregarAoMudar } from './useRecarregarAoMudar';
import '../../components/UI/Components.css';
import '../Admin/Admin.css';
import './AusenciaProgramada.css';

// Tela do colaborador: saldo, períodos e os próprios pedidos. Aberta a todos
// os logados — cada um vê só o que é seu (RPCs com escopo 'meus').
export default function MinhaAusencia() {
  const { user } = useAuth();
  const [periodos, setPeriodos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [aprovador, setAprovador] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [editando, setEditando] = useState(null); // null | 'novo' | rascunho
  const [aCancelar, setACancelar] = useState(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const [ps, ss] = await Promise.all([listarPeriodos('meus'), listarSolicitacoes('meus')]);
      setPeriodos(ps);
      setPedidos(ss);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar sua ausência programada.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Ao abrir: completa os períodos que faltam (colaborador novo, período que
  // virou) e roda os alertas de vencimento. Os dois são best-effort.
  useEffect(() => {
    (async () => {
      await gerarPeriodos().catch(() => {});
      gerarAlertas();
      fetchMeuAprovador().then(setAprovador).catch(() => {});
      carregar();
    })();
  }, [carregar]);

  useRecarregarAoMudar(carregar);

  const resumo = useMemo(() => resumoSaldo(periodos), [periodos]);

  async function onSalvar(payload) {
    const r = await salvarPedido(payload);
    setEditando(null);
    if (!payload.enviar) setOkMsg('Rascunho guardado.');
    else if (r?.fora_do_prazo) setOkMsg(`Pedido #${r.numero} enviado fora do prazo. Seu gestor vai decidir.`);
    else setOkMsg(`Pedido #${r?.numero ?? ''} enviado para aprovação.`);
    await carregar();
  }

  async function onExcluir(s) {
    if (!window.confirm(`Excluir o rascunho #${s.numero}?`)) return;
    try {
      await excluirRascunho(s.id);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao excluir.');
    }
  }

  if (loading) {
    return (
      <div className="admin-page animate-fade-in-up">
        <h1 className="page-title"><CalendarDays size={28} /> Ausência Programada</h1>
        <div className="ap-vazio">Carregando...</div>
      </div>
    );
  }

  const semPeriodo = periodos.length === 0;

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><CalendarDays size={28} /> Ausência Programada</h1>
      <p className="page-subtitle">
        Seu saldo por período, a data limite para usar e os pedidos enviados ao seu gestor.
      </p>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      {okMsg && <Alerta tipo="ok">{okMsg}</Alerta>}

      {semPeriodo && (
        <Alerta tipo="info">
          Seu saldo de ausência ainda não foi cadastrado. Fale com o RH para liberar seus períodos.
        </Alerta>
      )}
      {resumo.bloqueado && (
        <Alerta tipo="info">
          Você poderá usar sua ausência programada a partir de {fmtDataBr(resumo.dataInicial)}, quando
          completar o período.
        </Alerta>
      )}
      {resumo.vencendo.map((p) => (
        <Alerta key={p.id} tipo="aviso">
          Você tem {p.saldo} dia(s) do período {rotuloPeriodo(p)} para usar até {fmtDataBr(p.data_limite)}.
        </Alerta>
      ))}

      <div className="cards-grid cards-grid--3 ap-secao">
        <StatCard tom="success" icone={<Wallet size={22} />} valor={resumo.saldo} rotulo="Saldo disponível (dias)" />
        <StatCard tom="accent" icone={<CalendarCheck size={22} />} data
          valor={resumo.dataInicial ? fmtDataBr(resumo.dataInicial) : '—'} rotulo="Data inicial" />
        <StatCard tom="warning" icone={<CalendarClock size={22} />} data
          valor={resumo.dataLimite ? fmtDataBr(resumo.dataLimite) : '—'} rotulo="Data limite" />
        <StatCard tom="accent" icone={<CalendarDays size={22} />} valor={resumo.agendados} rotulo="Dias agendados" />
        <StatCard tom="warning" icone={<Hourglass size={22} />} valor={resumo.pendentes} rotulo="Dias aguardando aprovação" />
        <StatCard tom="secondary" icone={<CalendarCheck size={22} />} valor={resumo.tirados} rotulo="Dias já tirados" />
      </div>

      <div className="table-container ap-secao">
        <div className="table-header">
          <div className="table-header-title">Meus pedidos</div>
          <div className="ap-toolbar">
            <button className="btn btn-primary" onClick={() => { setOkMsg(''); setEditando('novo'); }}
              disabled={semPeriodo}>
              <CalendarPlus size={18} /> Nova ausência
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Dias</th>
                <th>Período</th>
                <th>Status</th>
                <th>Gestor</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((s) => (
                <tr key={s.id}>
                  <td>#{s.numero}</td>
                  <td>{fmtDataBr(s.data_inicio)}</td>
                  <td>{fmtDataBr(s.data_fim)}</td>
                  <td className="ap-num">{s.dias}</td>
                  <td>
                    {fmtDataBr(s.inicio_periodo)} a {fmtDataBr(s.fim_periodo)}
                    <div className="ap-sub">Data limite {fmtDataBr(s.data_limite)}</div>
                  </td>
                  <td>
                    <StatusBadge s={s} />
                    {s.motivo_reprovacao && <div className="ap-sub">{s.motivo_reprovacao}</div>}
                    {s.status === 'cancelada' && s.motivo_cancelamento && <div className="ap-sub">{s.motivo_cancelamento}</div>}
                  </td>
                  <td>{s.aprovador_nome || (s.status === 'rascunho' ? '—' : 'RH')}</td>
                  <td>
                    <div className="table-actions">
                      {s.status === 'rascunho' && (
                        <>
                          <button className="btn-icon" title="Editar e enviar" onClick={() => setEditando(s)}>
                            <Pencil size={16} />
                          </button>
                          <button className="btn-icon" title="Excluir rascunho" onClick={() => onExcluir(s)}>
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                      {podeCancelar(s, { userId: user?.id }) && (
                        <button className="btn-icon" title="Cancelar pedido" onClick={() => setACancelar(s)}>
                          <Ban size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {pedidos.length === 0 && (
                <tr><td colSpan={8} className="table-empty">Nenhum pedido ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Meus períodos</div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Período</th>
                <th>Data inicial</th>
                <th>Data limite</th>
                <th>Direito</th>
                <th>Tirados</th>
                <th>Agendados</th>
                <th>Pendentes</th>
                <th>Saldo</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {[...periodos].reverse().map((p) => (
                <tr key={p.id}>
                  <td>{rotuloPeriodo(p)}</td>
                  <td>{fmtDataBr(p.data_inicial)}</td>
                  <td>{fmtDataBr(p.data_limite)}</td>
                  <td className="ap-num">
                    {p.dias_direito + p.dias_ajuste}
                    {p.dias_ajuste !== 0 && <div className="ap-sub" title={p.ajuste_motivo || ''}>ajuste {p.dias_ajuste > 0 ? '+' : ''}{p.dias_ajuste}</div>}
                  </td>
                  <td className="ap-num">{p.dias_tirados}</td>
                  <td className="ap-num">{p.dias_agendados}</td>
                  <td className="ap-num">{p.dias_pendentes}</td>
                  <td className="ap-num"><strong>{p.saldo}</strong></td>
                  <td><SituacaoPeriodo periodo={p} /></td>
                </tr>
              ))}
              {periodos.length === 0 && (
                <tr><td colSpan={9} className="table-empty">Nenhum período cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <ModalPedido
          periodos={periodos}
          minhas={pedidos}
          rascunho={editando === 'novo' ? null : editando}
          aprovador={aprovador}
          onClose={() => setEditando(null)}
          onSalvar={onSalvar}
        />
      )}

      {aCancelar && (
        <ModalMotivo
          titulo={`Cancelar pedido #${aCancelar.numero}`}
          descricao={`${fmtDataBr(aCancelar.data_inicio)} a ${fmtDataBr(aCancelar.data_fim)} · ${aCancelar.dias} dia(s). Os dias voltam para o saldo.`}
          rotulo="Motivo"
          obrigatorio={false}
          confirmar="Cancelar pedido"
          onClose={() => setACancelar(null)}
          onConfirm={async (motivo) => {
            await cancelar(aCancelar.id, { motivo: motivo || null });
            setACancelar(null);
            setOkMsg(`Pedido #${aCancelar.numero} cancelado.`);
            await carregar();
          }}
        />
      )}
    </div>
  );
}
