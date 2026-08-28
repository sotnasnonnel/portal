import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard, Inbox, Loader2, TrendingUp, Clock, CalendarX, Wallet, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { formatarMoeda } from '../../../../utils/formatters';
import { modalidadeCartaoLabel } from '../../../../config/financeiro';
import { listarMeusCartoes } from '../solicitacoes/cartoes';
import '../../../../components/UI/Components.css';

/**
 * Meus Cartões — o cartão visto como COISA, não como solicitação.
 *
 * O módulo já mostrava as solicitações em "Acompanhar", mas quem tem cartão
 * pergunta outra coisa: qual é o meu limite hoje, até quando ele vale e o
 * aumento que pedi já entrou. Isso não se lê numa lista de solicitações, porque
 * o limite vigente é o cartão MAIS os aumentos concluídos.
 */

const SITUACAO = {
  ativo: { label: 'Ativo', cls: 'concluida' },
  em_aprovacao: { label: 'Em aprovação', cls: 'pendente' },
  vencido: { label: 'Vencido', cls: 'reprovada' },
  reprovado: { label: 'Reprovado', cls: 'reprovada' },
};

const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—');

const vigencia = (c) => {
  if (c.vitalicio) return 'Vitalício';
  if (c.periodo_inicio || c.periodo_fim) return `${fmtData(c.periodo_inicio)} até ${fmtData(c.periodo_fim)}`;
  return '—';
};

export default function FinanceiroCartoes() {
  const { user } = useAuth();
  const [cartoes, setCartoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    try {
      setCartoes(await listarMeusCartoes(user.id));
      setErro('');
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar seus cartões.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    carregar();
    // Aprovar/executar uma solicitação dispara este evento: o limite muda aqui
    // sem a pessoa precisar recarregar a página.
    const h = () => carregar();
    window.addEventListener('solicitacoes_financeiro_atualizadas', h);
    return () => window.removeEventListener('solicitacoes_financeiro_atualizadas', h);
  }, [carregar]);

  const ativos = cartoes.filter((c) => c.situacao === 'ativo');
  const emAprovacao = cartoes.filter((c) => c.situacao === 'em_aprovacao');
  const vencidos = cartoes.filter((c) => c.situacao === 'vencido');
  const limiteTotal = ativos.reduce((s, c) => s + (Number(c.limite) || 0), 0);

  return (
    <div className="fin-page">
      <h1 className="fin-title"><CreditCard size={26} /> Meus Cartões</h1>
      <p className="fin-sub">
        Os cartões que você solicitou, com o limite que vale hoje (já com os aumentos aprovados),
        a vigência e o que ainda está em aprovação.
      </p>

      {loading ? (
        <div className="fin-empty"><Loader2 size={16} className="animate-spin" /> Carregando seus cartões...</div>
      ) : erro ? (
        <div className="fin-aviso">{erro}</div>
      ) : cartoes.length === 0 ? (
        <div className="fin-construcao">
          <Inbox size={28} />
          <strong>Você ainda não tem cartões</strong>
          <span>
            Abra uma <Link to="/financeiro/solicitacoes/nova/cartao-virtual">Solicitação de Cartão</Link>{' '}
            — assim que ela for executada pelo Financeiro, o cartão aparece aqui.
          </span>
        </div>
      ) : (
        <>
          <div className="fin-tiles" style={{ marginBottom: 18 }}>
            <div className="fin-tile">
              <span className="fin-tile-ico"><CreditCard size={16} /></span>
              <span className="fin-tile-label">Cartões ativos</span>
              <span className="fin-tile-value">{ativos.length}</span>
            </div>
            <div className="fin-tile">
              <span className="fin-tile-ico"><Wallet size={16} /></span>
              <span className="fin-tile-label">Limite ativo</span>
              <span className="fin-tile-value">{formatarMoeda(limiteTotal)}</span>
              <span className="fin-tile-foot">Soma dos cartões dentro da vigência</span>
            </div>
            <div className="fin-tile">
              <span className="fin-tile-ico"><Clock size={16} /></span>
              <span className="fin-tile-label">Em aprovação</span>
              <span className="fin-tile-value">{emAprovacao.length}</span>
            </div>
            <div className="fin-tile">
              <span className="fin-tile-ico"><CalendarX size={16} /></span>
              <span className="fin-tile-label">Vencidos</span>
              <span className="fin-tile-value">{vencidos.length}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cartoes.map((c) => {
              const sit = SITUACAO[c.situacao] || SITUACAO.em_aprovacao;
              const teveAumento = Number(c.limite) !== Number(c.valor);
              return (
                <div key={c.id} className="fin-card">
                  <div className="fin-cartao-topo">
                    <strong>
                      {c.numero != null && `#${c.numero} · `}{c.nome_despesa || 'Cartão'}
                    </strong>
                    <span className="fin-cartao-tipo">{modalidadeCartaoLabel(c.modalidade_cartao)}</span>
                    <span className={`fin-badge tom-${sit.cls}`}>{sit.label}</span>
                  </div>

                  <div className="fin-sol-grid">
                    <div>
                      <span>Limite atual</span>
                      <strong>{formatarMoeda(c.limite)}</strong>
                    </div>
                    {teveAumento && (
                      <div>
                        <span>Limite original</span>
                        <strong>{formatarMoeda(c.valor)}</strong>
                      </div>
                    )}
                    <div><span>Centro de custo</span><strong>{c.centro_custo || '—'}</strong></div>
                    <div><span>Vigência</span><strong>{vigencia(c)}</strong></div>
                    <div>
                      <span>Aplicação</span>
                      <strong>{Array.isArray(c.aplicacao) && c.aplicacao.length ? c.aplicacao.join(', ') : '—'}</strong>
                    </div>
                    <div>
                      <span>{c.situacao === 'em_aprovacao' ? 'Solicitado em' : 'Liberado em'}</span>
                      <strong>{fmtData(c.concluida_em || c.created_at)}</strong>
                    </div>
                  </div>

                  {c.aumentosEmAprovacao.length > 0 && (
                    <div className="alc-modificador">
                      <Clock size={13} />
                      <span>
                        Aumento em aprovação:{' '}
                        {c.aumentosEmAprovacao
                          .map((a) => `${a.numero != null ? `#${a.numero} ` : ''}${formatarMoeda(a.valor)}`)
                          .join(', ')}
                        {' '}— o limite acima só muda quando o Financeiro executar.
                      </span>
                    </div>
                  )}

                  {c.situacao === 'ativo' && (
                    <Link to="/financeiro/solicitacoes/nova/aumento-limite" className="fin-card-foot">
                      <TrendingUp size={14} /> Pedir aumento de limite
                    </Link>
                  )}
                  {c.situacao === 'em_aprovacao' && (
                    <Link to="/financeiro/solicitacoes/acompanhar" className="fin-card-foot">
                      Ver a aprovação <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
