import { useCallback, useEffect, useState } from 'react';
import { BellRing, Check, CheckCircle2, Loader2, UserMinus, Package } from 'lucide-react';
import { listarMeusAvisos, marcarCiente } from '../../services/desligamentoCiencia';
import '../../components/UI/Components.css';
import '../Admin/Admin.css';

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

// Situação da requisição contada a quem só foi avisado — sem os detalhes do
// fluxo, que ele não pode ver.
const SITUACAO = {
  pendente: { label: 'Em andamento', badge: 'pendente' },
  concluida: { label: 'Confirmado pelo DP', badge: 'aprovada' },
  reprovada: { label: 'Em revisão', badge: 'pendente' },
  cancelada: { label: 'Cancelado: desconsidere', badge: 'inativo' },
};

// Avisos de desligamento que o DP enviou para conhecimento desta pessoa. Aberta a
// todo logado: a RPC devolve só os avisos dela, e só nome, função e data — a
// requisição em si continua fechada.
export default function AvisosConhecimento() {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [marcando, setMarcando] = useState(null);

  const carregar = useCallback(async () => {
    try {
      setAvisos(await listarMeusAvisos());
      setErro('');
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar os avisos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const ciente = async (id) => {
    setMarcando(id);
    try {
      await marcarCiente(id);
      await carregar();
    } catch (e) {
      alert(e?.message || 'Erro ao confirmar. Tente novamente.');
    } finally {
      setMarcando(null);
    }
  };

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><BellRing size={28} /> Para conhecimento</h1>
      <p className="page-subtitle">
        Desligamentos que o DP compartilhou com você para organizar o recolhimento de EPIs, equipamentos e acessos.
        Informação confidencial: não repasse.
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}><Loader2 size={24} className="animate-spin" /></div>
      ) : erro ? (
        <div className="sol-card-resumo tom-reprovada">{erro}</div>
      ) : avisos.length === 0 ? (
        <div className="table-container">
          <div className="table-empty" style={{ padding: 'var(--space-3xl)' }}>Nenhum aviso para você.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {avisos.map((a) => {
            const sit = SITUACAO[a.status] || { label: a.status, badge: 'inativo' };
            const cancelado = a.status === 'cancelada';
            return (
              <div key={a.id} className="sol-card" style={cancelado ? { opacity: 0.7 } : undefined}>
                <div className="sol-card-body">
                  <div className="sol-card-top">
                    <div>
                      <div className="sol-card-colab" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <UserMinus size={17} /> {a.colaborador_nome || '—'}
                      </div>
                      <div className="sol-card-tipo">
                        {a.colaborador_funcao || 'Sem função'}
                        {a.numero != null && <span className="sol-card-iniciativa"> · Desligamento #{a.numero}</span>}
                        <span className="sol-card-iniciativa"> · Enviado por {a.enviado_por_nome || 'DP'} em {fmt(a.enviado_em)}</span>
                      </div>
                    </div>
                    <span className={`badge ${sit.badge}`}>{sit.label}</span>
                  </div>

                  {a.data_prevista && (
                    <div className="sol-card-info">
                      <span>Data prevista do desligamento: <strong style={{ color: 'var(--color-danger)' }}>{a.data_prevista}</strong></span>
                    </div>
                  )}

                  {a.observacao && <div className="sol-card-just"><strong>Observação do DP:</strong> {a.observacao}</div>}

                  {a.itens?.length > 0 && (
                    <div style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, marginBottom: 4 }}>
                        <Package size={15} /> EPIs e uniformes entregues pelo portal
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 22 }}>
                        {a.itens.map((it, i) => (
                          <li key={i}>{it.quantidade}× {it.descricao}{it.tamanho ? ` (${it.tamanho})` : ''}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="sol-card-actions" style={{ marginTop: 'var(--space-md)' }}>
                    {a.ciente_em ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-success)', fontSize: 'var(--font-size-sm)' }}>
                        <CheckCircle2 size={16} /> Ciente em {fmt(a.ciente_em)}
                      </span>
                    ) : !cancelado && (
                      <button className="btn btn-primary btn-sm" disabled={marcando === a.id} onClick={() => ciente(a.id)}>
                        {marcando === a.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Ciente
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
