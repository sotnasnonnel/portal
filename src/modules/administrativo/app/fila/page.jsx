import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Inbox, Loader2, AlertCircle, UserX, Clock } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { listarFila } from '../../lib/chamados';
import { STATUS_LABEL as ROTULO_STATUS } from '../../lib/statusChamado';



const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : '—');

export default function FilaAdm() {
  const { user, modules } = useAuth();
  const [apenasMeus, setApenasMeus] = useState(false);
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const souAdm = modules?.administrativo === 'admin' || modules?.administrativo === 'atendente';

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    setCarregando(true);
    setErro('');
    try {
      setLinhas(await listarFila(user.id, { apenasMeus }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [user?.id, apenasMeus]);

  useEffect(() => { carregar(); }, [carregar]);

  // Gate de UI — a RLS é quem realmente restringe os dados.
  if (!souAdm) return <Navigate to="/administrativo/novo" replace />;

  const agora = Date.now();
  const semDono = linhas.filter((c) => !c.atendente_id).length;

  return (
    <div className="adm-page adm-page-wide">
      <h1 className="adm-title"><Inbox size={24} /> Fila de atendimento</h1>
      <p className="adm-sub">Chamados em aberto do setor Administrativo.</p>

      {/* Chamado sem técnico é o que ninguém está olhando — merece destaque. */}
      {semDono > 0 && !apenasMeus && (
        <div className="adm-aviso tom-info">
          <UserX size={16} />
          {semDono === 1 ? '1 chamado sem responsável.' : `${semDono} chamados sem responsável.`}
          {' '}Abra e clique em "Assumir chamado" para colocá-lo no seu nome.
        </div>
      )}

      <div className="adm-tabs">
        <button type="button" className={`adm-tab ${!apenasMeus ? 'is-active' : ''}`}
          onClick={() => setApenasMeus(false)}>
          <Inbox size={15} /> Todos
        </button>
        <button type="button" className={`adm-tab ${apenasMeus ? 'is-active' : ''}`}
          onClick={() => setApenasMeus(true)}>
          <Clock size={15} /> Atribuídos a mim
        </button>
      </div>

      {erro && <div className="adm-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="adm-vazio"><Loader2 size={20} className="adm-spin" /> Carregando…</div>
      ) : linhas.length === 0 ? (
        <div className="adm-vazio">
          {apenasMeus
            ? 'Nenhum chamado atribuído a você. Em "Todos", os sem responsável podem ser assumidos.'
            : 'Nenhum chamado em aberto.'}
        </div>
      ) : (
        <div className="adm-tabela-scroll">
          <table className="adm-tabela">
            <thead>
              <tr>
                <th>ID</th><th>Assunto</th><th>Status</th><th>Solicitante</th>
                <th>Técnico</th><th>Criação</th><th>Vencimento SLA</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((c) => {
                // Vencido pinta a data; sem prazo não há o que comparar.
                const vencido = c.sla_vence_em && new Date(c.sla_vence_em).getTime() < agora;
                return (
                  <tr key={c.id}>
                    <td className="num">
                      <Link className="adm-link" to={`/administrativo/chamado/${c.id}`}>#{c.numero}</Link>
                    </td>
                    <td>
                      <Link className="adm-link" to={`/administrativo/chamado/${c.id}`}>{c.assunto}</Link>
                    {c.naoLidas > 0 && (
                      <span className="adm-nao-lidas" title={`${c.naoLidas} mensagem(ns) não lida(s)`}>
                        {c.naoLidas}
                      </span>
                    )}
                    </td>
                    <td>
                      <span className={`adm-badge tom-${c.status}`}>
                        {ROTULO_STATUS[c.status] || c.status}
                      </span>
                    </td>
                    <td>{c.solicitanteNome || '—'}</td>
                    <td>{c.atendenteNome || <span className="adm-sem-dono">sem responsável</span>}</td>
                    <td className="num">{dataCurta(c.criado_em)}</td>
                    <td className={`num ${vencido ? 'is-vencido' : ''}`}>{dataHora(c.sla_vence_em)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
