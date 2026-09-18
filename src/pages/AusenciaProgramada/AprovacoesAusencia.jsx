import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Check, X, Ban, Timer, CalendarCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  fmtDataBr, isAusenciaRh, podeCancelar, podeDecidir, statusExibido,
} from '../../config/ausenciaProgramada';
import { cancelar, decidir, gerarAlertas, listarSolicitacoes } from '../../services/ausenciaProgramada';
import { Alerta, ModalMotivo, StatCard, StatusBadge } from './componentes';
import { useRecarregarAoMudar } from './useRecarregarAoMudar';
import '../../components/UI/Components.css';
import '../Admin/Admin.css';
import './AusenciaProgramada.css';

const FILTROS = [
  ['pendente', 'Pendentes'],
  ['aprovada', 'Aprovadas'],
  ['concluida', 'Concluídas'],
  ['reprovada', 'Reprovadas'],
  ['cancelada', 'Canceladas'],
  ['todos', 'Todas'],
];

// Fila do gestor direto: os pedidos em que ele é o aprovador. O RH também vê
// aqui os pedidos sem aprovador (colaborador sem gestor no cadastro).
export default function AprovacoesAusencia() {
  const { user } = useAuth();
  const ehRh = isAusenciaRh(user);
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('pendente');
  const [salvandoId, setSalvandoId] = useState(null);
  const [aReprovar, setAReprovar] = useState(null);
  const [aCancelar, setACancelar] = useState(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      setLista(await listarSolicitacoes('aprovar'));
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar as aprovações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { gerarAlertas(); carregar(); }, [carregar]);
  useRecarregarAoMudar(carregar);

  const contagem = useMemo(() => {
    const c = {};
    lista.forEach((s) => { const st = statusExibido(s); c[st] = (c[st] || 0) + 1; });
    return c;
  }, [lista]);

  const filtrada = useMemo(
    () => (filtro === 'todos' ? lista : lista.filter((s) => statusExibido(s) === filtro)),
    [lista, filtro],
  );

  const foraDoPrazo = lista.filter((s) => s.status === 'pendente' && s.fora_do_prazo).length;

  async function aprovar(s) {
    setSalvandoId(s.id);
    setErro('');
    try {
      await decidir(s.id, { aprovar: true });
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao aprovar.');
    } finally {
      setSalvandoId(null);
    }
  }

  if (loading) {
    return (
      <div className="admin-page animate-fade-in-up">
        <h1 className="page-title"><ClipboardCheck size={28} /> Aprovações de Ausência</h1>
        <div className="ap-vazio">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><ClipboardCheck size={28} /> Aprovações de Ausência</h1>
      <p className="page-subtitle">
        Pedidos de ausência programada da sua equipe direta. Pedido fora do prazo chega marcado: a
        decisão é sua.
      </p>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      {foraDoPrazo > 0 && (
        <Alerta tipo="aviso">
          {foraDoPrazo} pedido(s) pendente(s) terminam depois da data limite do período.
        </Alerta>
      )}

      <div className="cards-grid cards-grid--3 ap-secao">
        <StatCard tom="warning" icone={<Timer size={22} />} valor={contagem.pendente || 0}
          rotulo="Pendentes" ativo={filtro === 'pendente'} onClick={() => setFiltro('pendente')} />
        <StatCard tom="success" icone={<CalendarCheck size={22} />} valor={contagem.aprovada || 0}
          rotulo="Aprovadas (a acontecer)" ativo={filtro === 'aprovada'} onClick={() => setFiltro('aprovada')} />
        <StatCard tom="danger" icone={<AlertTriangle size={22} />} valor={foraDoPrazo}
          rotulo="Pendentes fora do prazo" ativo={false} onClick={() => setFiltro('pendente')} />
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Pedidos</div>
        </div>
        <div className="filter-chips" style={{ padding: '0 var(--space-lg) var(--space-md)' }}>
          {FILTROS.map(([v, l]) => (
            <button key={v} className={`filter-chip ${filtro === v ? 'active' : ''}`} onClick={() => setFiltro(v)}>
              {l}{v !== 'todos' && contagem[v] ? ` (${contagem[v]})` : ''}
            </button>
          ))}
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Colaborador</th>
                <th>Ausência</th>
                <th>Dias</th>
                <th>Período / data limite</th>
                <th>Saldo do período</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map((s) => {
                const decide = podeDecidir(s, { userId: user?.id, ehRh });
                const cancela = !decide && podeCancelar(s, {
                  userId: user?.id, ehAprovador: s.aprovador_id === user?.id, ehRh,
                });
                return (
                  <tr key={s.id}>
                    <td>#{s.numero}</td>
                    <td>
                      {s.colaborador_nome}
                      <div className="ap-sub">{s.colaborador_funcao || '—'}</div>
                    </td>
                    <td>
                      {fmtDataBr(s.data_inicio)} a {fmtDataBr(s.data_fim)}
                      {s.observacao && <div className="ap-sub">{s.observacao}</div>}
                    </td>
                    <td className="ap-num">{s.dias}</td>
                    <td>
                      {fmtDataBr(s.inicio_periodo)} a {fmtDataBr(s.fim_periodo)}
                      <div className="ap-sub">Data limite {fmtDataBr(s.data_limite)}</div>
                    </td>
                    <td className="ap-num">
                      {s.saldo_periodo}
                      {s.status === 'pendente' && <div className="ap-sub">já descontado este pedido</div>}
                    </td>
                    <td>
                      <StatusBadge s={s} />
                      {s.decidido_por_nome && s.status !== 'pendente' && (
                        <div className="ap-sub">{s.decidido_por_nome} · {fmtDataBr(s.decidido_em)}</div>
                      )}
                      {s.motivo_reprovacao && <div className="ap-sub">{s.motivo_reprovacao}</div>}
                    </td>
                    <td>
                      <div className="table-actions">
                        {decide && (
                          <>
                            <button className="btn btn-success btn-sm" disabled={salvandoId === s.id}
                              onClick={() => aprovar(s)}>
                              <Check size={16} /> Aprovar
                            </button>
                            <button className="btn btn-outline btn-sm" disabled={salvandoId === s.id}
                              onClick={() => setAReprovar(s)}>
                              <X size={16} /> Reprovar
                            </button>
                          </>
                        )}
                        {cancela && (
                          <button className="btn-icon" title="Cancelar ausência" onClick={() => setACancelar(s)}>
                            <Ban size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtrada.length === 0 && (
                <tr><td colSpan={8} className="table-empty">Nenhum pedido aqui.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {aReprovar && (
        <ModalMotivo
          titulo={`Reprovar pedido #${aReprovar.numero}`}
          descricao={`${aReprovar.colaborador_nome} · ${fmtDataBr(aReprovar.data_inicio)} a ${fmtDataBr(aReprovar.data_fim)} · ${aReprovar.dias} dia(s).`}
          rotulo="Motivo da reprovação"
          confirmar="Reprovar"
          onClose={() => setAReprovar(null)}
          onConfirm={async (motivo) => {
            await decidir(aReprovar.id, { aprovar: false, motivo });
            setAReprovar(null);
            await carregar();
          }}
        />
      )}

      {aCancelar && (
        <ModalMotivo
          titulo={`Cancelar ausência #${aCancelar.numero}`}
          descricao={`${aCancelar.colaborador_nome} · ${fmtDataBr(aCancelar.data_inicio)} a ${fmtDataBr(aCancelar.data_fim)}. Os dias voltam para o saldo.`}
          rotulo="Motivo do cancelamento"
          confirmar="Cancelar ausência"
          onClose={() => setACancelar(null)}
          onConfirm={async (motivo) => {
            await cancelar(aCancelar.id, { motivo });
            setACancelar(null);
            await carregar();
          }}
        />
      )}
    </div>
  );
}
