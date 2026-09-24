import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Check, X, Ban } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  fmtDataBr, isFolgaCampoRh, podeCancelar, podeDecidir, statusExibido,
} from '../../config/folgaCampo';
import { cancelar, decidir, listar } from '../../services/folgaCampo';
import { Alerta, ModalMotivo, StatusBadge } from './componentes';
import { useRecarregarAoMudar } from './useRecarregarAoMudar';
import '../../components/UI/Components.css';
import '../Admin/Admin.css';
import './FolgaCampo.css';

const FILTROS = [
  ['pendente', 'Aguardando'],
  ['aprovada', 'Aprovadas'],
  ['concluida', 'Concluídas'],
  ['reprovada', 'Reprovadas'],
  ['cancelada', 'Canceladas'],
  ['todos', 'Todas'],
];

// Fila do responsável direto: os registros em que ele é o aprovador. O RH
// também vê aqui os registros sem aprovador (quem não tem superior no cadastro).
export default function AprovacoesFolga() {
  const { user } = useAuth();
  const ehRh = isFolgaCampoRh(user);
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
      setLista(await listar('aprovar'));
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar as aprovações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useRecarregarAoMudar(carregar);

  const contagem = useMemo(() => {
    const c = {};
    lista.forEach((r) => { const st = statusExibido(r); c[st] = (c[st] || 0) + 1; });
    return c;
  }, [lista]);

  const filtrada = useMemo(
    () => (filtro === 'todos' ? lista : lista.filter((r) => statusExibido(r) === filtro)),
    [lista, filtro],
  );

  async function aprovar(r) {
    setSalvandoId(r.id);
    setErro('');
    try {
      await decidir(r.id, { aprovar: true });
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
        <h1 className="page-title"><ClipboardCheck size={28} /> Aprovações de Folga de Campo</h1>
        <div className="fc-vazio">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><ClipboardCheck size={28} /> Aprovações de Folga de Campo</h1>
      <p className="page-subtitle">
        Quem da sua equipe vai ficar fora da obra, e por quê. A decisão é sua.
      </p>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      {(contagem.pendente || 0) > 0 && (
        <Alerta tipo="aviso">
          {contagem.pendente} registro(s) aguardando sua aprovação.
        </Alerta>
      )}

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Registros</div>
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
                <th>Período fora</th>
                <th>Dias</th>
                <th>Obra</th>
                <th>Motivo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map((r) => {
                const decide = podeDecidir(r, { userId: user?.id, ehRh });
                const cancela = !decide && podeCancelar(r, {
                  userId: user?.id, ehAprovador: r.aprovador_id === user?.id, ehRh,
                });
                return (
                  <tr key={r.id}>
                    <td>#{r.numero}</td>
                    <td>
                      {r.colaborador_nome}
                      <div className="fc-sub">{r.colaborador_funcao || '—'}</div>
                    </td>
                    <td>{fmtDataBr(r.data_inicio)} a {fmtDataBr(r.data_fim)}</td>
                    <td className="fc-num">{r.dias}</td>
                    <td>{r.obra || '—'}</td>
                    <td className="fc-motivo">{r.motivo}</td>
                    <td>
                      <StatusBadge r={r} />
                      {r.decidido_por_nome && r.status !== 'pendente' && (
                        <div className="fc-sub">{r.decidido_por_nome} · {fmtDataBr(r.decidido_em)}</div>
                      )}
                      {r.motivo_reprovacao && <div className="fc-sub">{r.motivo_reprovacao}</div>}
                    </td>
                    <td>
                      <div className="table-actions">
                        {decide && (
                          <>
                            <button className="btn btn-success btn-sm" disabled={salvandoId === r.id}
                              onClick={() => aprovar(r)}>
                              <Check size={16} /> Aprovar
                            </button>
                            <button className="btn btn-outline btn-sm" disabled={salvandoId === r.id}
                              onClick={() => setAReprovar(r)}>
                              <X size={16} /> Reprovar
                            </button>
                          </>
                        )}
                        {cancela && (
                          <button className="btn-icon" title="Cancelar folga" onClick={() => setACancelar(r)}>
                            <Ban size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtrada.length === 0 && (
                <tr><td colSpan={8} className="table-empty">Nenhum registro aqui.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {aReprovar && (
        <ModalMotivo
          titulo={`Reprovar folga #${aReprovar.numero}`}
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
          titulo={`Cancelar folga #${aCancelar.numero}`}
          descricao={`${aCancelar.colaborador_nome} · ${fmtDataBr(aCancelar.data_inicio)} a ${fmtDataBr(aCancelar.data_fim)}.`}
          rotulo="Motivo do cancelamento"
          confirmar="Cancelar folga"
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
