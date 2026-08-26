import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Loader2, AlertCircle, UserX, Clock } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { listarFila } from '../../lib/chamados';
import { STATUS_LABEL as ROTULO_STATUS } from '../../lib/statusChamado';
import { filtrarFila, opcoesDaFila } from '../../lib/painel';

const FILTRO_VAZIO = {
  assunto: '', status: '', solicitanteId: '', atendenteId: '', criadoDe: '', criadoAte: '',
};



const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : '—');

export default function FilaAdm() {
  const { user } = useAuth();
  const [apenasMeus, setApenasMeus] = useState(false);
  const [filtro, setFiltro] = useState(FILTRO_VAZIO);
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

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

  const agora = Date.now();
  // Filtro é no cliente: a fila cabe numa tela e ir ao banco a cada tecla
  // digitada no assunto deixaria a busca travada.
  const visiveis = filtrarFila(linhas, filtro);
  const opcoes = opcoesDaFila(linhas);
  const semDono = linhas.filter((c) => !c.atendente_id).length;
  const filtrando = Object.values(filtro).some(Boolean);
  const mudar = (campo, valor) => setFiltro((f) => ({ ...f, [campo]: valor }));

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

      {/* Filtros por cima do que já veio: a fila cabe numa tela, e ir ao banco a
          cada tecla do assunto deixaria a busca travada. */}
      <div className="adm-fila-filtros">
        <input
          type="search" className="adm-input" placeholder="Buscar no assunto…"
          aria-label="Buscar no assunto"
          value={filtro.assunto} onChange={(e) => mudar('assunto', e.target.value)}
        />
        <select className="adm-select" aria-label="Status"
          value={filtro.status} onChange={(e) => mudar('status', e.target.value)}>
          <option value="">Todos os status</option>
          {opcoes.status.map((st) => (
            <option key={st} value={st}>{ROTULO_STATUS[st] || st}</option>
          ))}
        </select>
        <select className="adm-select" aria-label="Solicitante"
          value={filtro.solicitanteId} onChange={(e) => mudar('solicitanteId', e.target.value)}>
          <option value="">Todos os solicitantes</option>
          {opcoes.solicitantes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="adm-select" aria-label="Responsável"
          value={filtro.atendenteId} onChange={(e) => mudar('atendenteId', e.target.value)}>
          <option value="">Todos os responsáveis</option>
          {opcoes.temSemResponsavel && <option value="sem">— Sem responsável —</option>}
          {opcoes.responsaveis.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="adm-fila-periodo">
          <span>Criação de</span>
          <input type="date" className="adm-input" aria-label="Criado a partir de"
            value={filtro.criadoDe} onChange={(e) => mudar('criadoDe', e.target.value)} />
        </label>
        <label className="adm-fila-periodo">
          <span>até</span>
          <input type="date" className="adm-input" aria-label="Criado até"
            value={filtro.criadoAte} onChange={(e) => mudar('criadoAte', e.target.value)} />
        </label>
        {filtrando && (
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={() => setFiltro(FILTRO_VAZIO)}>Limpar</button>
        )}
      </div>

      {filtrando && (
        <p className="adm-campo-dica">
          Mostrando {visiveis.length} de {linhas.length} chamados.
        </p>
      )}

      {erro && <div className="adm-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="adm-vazio"><Loader2 size={20} className="adm-spin" /> Carregando…</div>
      ) : linhas.length === 0 ? (
        <div className="adm-vazio">
          {apenasMeus
            ? 'Nenhum chamado atribuído a você. Em "Todos", os sem responsável podem ser assumidos.'
            : 'Nenhum chamado em aberto.'}
        </div>
      ) : visiveis.length === 0 ? (
        <div className="adm-vazio">
          Nenhum chamado corresponde aos filtros.
          {' '}
          <button type="button" className="adm-link adm-link-btn" onClick={() => setFiltro(FILTRO_VAZIO)}>
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="adm-tabela-scroll">
          <table className="adm-tabela">
            <thead>
              <tr>
                <th>ID</th><th>Assunto</th><th>Status</th><th>Solicitante</th>
                <th>Responsável</th><th>Criação</th><th>Vencimento SLA</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => {
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
