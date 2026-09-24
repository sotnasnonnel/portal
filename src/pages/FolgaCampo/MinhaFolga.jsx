import { useCallback, useEffect, useState } from 'react';
import { HardHat, CalendarPlus, Ban } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fmtDataBr, podeCancelar } from '../../config/folgaCampo';
import { cancelar, fetchMeuAprovador, listar, registrar } from '../../services/folgaCampo';
import { Alerta, ModalMotivo, ModalRegistro, StatusBadge } from './componentes';
import { useRecarregarAoMudar } from './useRecarregarAoMudar';
import '../../components/UI/Components.css';
import '../Admin/Admin.css';
import './FolgaCampo.css';

// Tela do colaborador: registra a ausência de obra e acompanha o que já pediu.
// Cada um vê só o que é seu (RPC com escopo 'meus').
export default function MinhaFolga() {
  const { user } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [aprovador, setAprovador] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [aCancelar, setACancelar] = useState(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      setRegistros(await listar('meus'));
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar suas folgas de campo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeuAprovador().then(setAprovador).catch(() => {});
    carregar();
  }, [carregar]);

  useRecarregarAoMudar(carregar);

  async function onSalvar(dados) {
    const r = await registrar(dados);
    setRegistrando(false);
    setOkMsg(`Folga #${r?.numero ?? ''} enviada para aprovação.`);
    await carregar();
  }

  if (loading) {
    return (
      <div className="admin-page animate-fade-in-up">
        <h1 className="page-title"><HardHat size={28} /> Folga de Campo</h1>
        <div className="fc-vazio">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><HardHat size={28} /> Folga de Campo</h1>
      <p className="page-subtitle">
        Avise quando for ficar ausente da obra. Seu responsável aprova e o registro fica aqui.
      </p>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      {okMsg && <Alerta tipo="ok">{okMsg}</Alerta>}

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Minhas folgas</div>
          <div className="fc-toolbar">
            <button className="btn btn-primary" onClick={() => { setOkMsg(''); setRegistrando(true); }}>
              <CalendarPlus size={18} /> Nova folga
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
                <th>Obra</th>
                <th>Motivo</th>
                <th>Status</th>
                <th>Responsável</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id}>
                  <td>#{r.numero}</td>
                  <td>{fmtDataBr(r.data_inicio)}</td>
                  <td>{fmtDataBr(r.data_fim)}</td>
                  <td className="fc-num">{r.dias}</td>
                  <td>{r.obra || '—'}</td>
                  <td className="fc-motivo">{r.motivo}</td>
                  <td>
                    <StatusBadge r={r} />
                    {r.motivo_reprovacao && <div className="fc-sub">{r.motivo_reprovacao}</div>}
                    {r.status === 'cancelada' && r.motivo_cancelamento && (
                      <div className="fc-sub">{r.motivo_cancelamento}</div>
                    )}
                  </td>
                  <td>{r.aprovador_nome || 'RH'}</td>
                  <td>
                    <div className="table-actions">
                      {podeCancelar(r, { userId: user?.id }) && (
                        <button className="btn-icon" title="Cancelar folga" onClick={() => setACancelar(r)}>
                          <Ban size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {registros.length === 0 && (
                <tr><td colSpan={9} className="table-empty">Nenhuma folga registrada ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {registrando && (
        <ModalRegistro
          meus={registros}
          aprovador={aprovador}
          onClose={() => setRegistrando(false)}
          onSalvar={onSalvar}
        />
      )}

      {aCancelar && (
        <ModalMotivo
          titulo={`Cancelar folga #${aCancelar.numero}`}
          descricao={`${fmtDataBr(aCancelar.data_inicio)} a ${fmtDataBr(aCancelar.data_fim)} · ${aCancelar.dias} dia(s).`}
          rotulo="Motivo"
          obrigatorio={false}
          confirmar="Cancelar folga"
          onClose={() => setACancelar(null)}
          onConfirm={async (motivo) => {
            await cancelar(aCancelar.id, { motivo: motivo || null });
            setACancelar(null);
            setOkMsg(`Folga #${aCancelar.numero} cancelada.`);
            await carregar();
          }}
        />
      )}
    </div>
  );
}
