import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Archive, Loader2, AlertCircle, Star } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { listarMeusChamados, buscarAvaliacaoPendente } from '../../lib/chamados';

const ROTULO_STATUS = {
  aguardando_aprovacao: 'Aguardando aprovação',
  aberto: 'Aberto',
  fechado: 'Fechado',
  reprovado: 'Reprovado',
  cancelado: 'Cancelado',
};

const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : '—');

export default function MeusChamadosAdm() {
  const { user } = useAuth();
  const [aba, setAba] = useState('abertos');
  const [linhas, setLinhas] = useState([]);
  const [pendente, setPendente] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const fechados = aba === 'fechados';

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    setCarregando(true);
    setErro('');
    try {
      const [lista, aval] = await Promise.all([
        listarMeusChamados(user.id, { fechados }),
        buscarAvaliacaoPendente(user.id),
      ]);
      setLinhas(lista);
      setPendente(aval);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [user?.id, fechados]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="adm-page adm-page-wide">
      <h1 className="adm-title">Meus chamados</h1>
      <p className="adm-sub">Acompanhe o andamento e o prazo das suas solicitações.</p>

      {/* A avaliação pendente bloqueia a abertura de novos chamados (POP 9.1),
          então precisa aparecer antes da lista, não escondida no rodapé. */}
      {pendente && (
        <div className="adm-aviso tom-erro">
          <Star size={16} />
          <span>
            O chamado <strong>#{pendente.numero} — {pendente.assunto}</strong> foi fechado e ainda
            não foi avaliado. Enquanto a avaliação não for feita, você não consegue abrir novos chamados.
          </span>
        </div>
      )}

      <div className="adm-tabs">
        <button type="button" className={`adm-tab ${!fechados ? 'is-active' : ''}`}
          onClick={() => setAba('abertos')}>
          <Inbox size={15} /> Em andamento
        </button>
        <button type="button" className={`adm-tab ${fechados ? 'is-active' : ''}`}
          onClick={() => setAba('fechados')}>
          <Archive size={15} /> Fechados
        </button>
      </div>

      {erro && <div className="adm-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="adm-vazio"><Loader2 size={20} className="adm-spin" /> Carregando…</div>
      ) : linhas.length === 0 ? (
        <div className="adm-vazio">
          {fechados
            ? 'Nenhum chamado fechado por aqui ainda.'
            : <>Você não tem chamados em andamento. <Link to="/administrativo/novo">Abrir um chamado</Link>.</>}
        </div>
      ) : (
        <div className="adm-tabela-scroll">
          <table className="adm-tabela">
            <thead>
              <tr>
                <th>ID</th>
                <th>Assunto</th>
                {!fechados && <th>Status</th>}
                <th>Técnico</th>
                <th>Criação</th>
                {fechados ? <th>Fechamento</th> : <><th>Análise</th><th>Vencimento SLA</th></>}
              </tr>
            </thead>
            <tbody>
              {linhas.map((c) => (
                <tr key={c.id}>
                  <td className="num">#{c.numero}</td>
                  <td>{c.assunto}</td>
                  {!fechados && (
                    <td>
                      <span className={`adm-badge tom-${c.status}`}>
                        {ROTULO_STATUS[c.status] || c.status}
                      </span>
                    </td>
                  )}
                  <td>{c.atendenteNome || '—'}</td>
                  <td className="num">{data(c.criado_em)}</td>
                  {fechados ? (
                    <td className="num">{data(c.fechado_em)}</td>
                  ) : (
                    <>
                      <td className="num">{data(c.analise_em)}</td>
                      {/* Sem aprovação decidida o relógio nem começou — mostrar
                          um vencimento aqui seria inventar prazo. */}
                      <td className="num">{dataHora(c.sla_vence_em)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
