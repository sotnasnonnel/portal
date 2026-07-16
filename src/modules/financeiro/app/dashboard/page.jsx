import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, ArrowRight, Inbox } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../services/supabase';
import { formatarMoeda } from '../../../../utils/formatters';
import { SOLICITACOES_FIN } from '../../../../config/financeiro';
import { acaoDisponivelFin, TIPO_LABEL_FIN } from '../../../../config/aprovacaoFinanceiro';

const SELECT = `
  id, numero, tipo, status, valor, cnae, nome_despesa, created_at, solicitante_id,
  etapas:solicitacoes_financeiro_etapas ( id, ordem, aprovador_id, tipo_etapa, status )
`;

const BADGE = {
  pendente: { label: 'Em andamento', cls: 'pendente' },
  concluida: { label: 'Concluída', cls: 'concluida' },
  reprovada: { label: 'Reprovada', cls: 'reprovada' },
};

const fmtData = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');
const soma = (arr) => arr.reduce((t, s) => t + (Number(s.valor) || 0), 0);
const TOP_CNAE = 8;

export default function FinanceiroDashboard() {
  const { user } = useAuth();
  const isFinAdmin = user?.financeiroRole === 'admin';
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carrega e mantém sincronizado. Sem setLoading(true) no refetch: a render
  // anterior se mantém (evita piscar esqueleto a cada atualização).
  useEffect(() => {
    if (!user?.id) return undefined;
    let vivo = true;
    const carregar = async () => {
      // A RLS limita ao que o usuário pode ver: próprias + onde aprova; admin vê tudo.
      const { data } = await supabase
        .from('solicitacoes_financeiro')
        .select(SELECT)
        .order('created_at', { ascending: false });
      if (!vivo) return;
      setLista(data || []);
      setLoading(false);
    };
    carregar();
    const h = () => carregar();
    window.addEventListener('solicitacoes_financeiro_atualizadas', h);
    return () => {
      vivo = false;
      window.removeEventListener('solicitacoes_financeiro_atualizadas', h);
    };
  }, [user]);

  const porStatus = (st) => lista.filter((s) => s.status === st);
  const emAndamento = porStatus('pendente');
  const concluidas = porStatus('concluida');
  const reprovadas = porStatus('reprovada');
  const aguardandoVoce = lista.filter((s) => acaoDisponivelFin(user?.id, s.etapas, isFinAdmin) !== null);

  // Top CNAE por valor: série única (uma cor), cauda agrupada em "Outros".
  const porCnaeTodos = Object.values(
    lista.reduce((acc, s) => {
      const k = s.cnae || 'Não informado';
      acc[k] = acc[k] || { cnae: k, valor: 0, qtd: 0 };
      acc[k].valor += Number(s.valor) || 0;
      acc[k].qtd += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.valor - a.valor);

  const porCnae = porCnaeTodos.length > TOP_CNAE
    ? [
        ...porCnaeTodos.slice(0, TOP_CNAE),
        porCnaeTodos.slice(TOP_CNAE).reduce(
          (t, c) => ({ cnae: 'Outros', valor: t.valor + c.valor, qtd: t.qtd + c.qtd }),
          { cnae: 'Outros', valor: 0, qtd: 0 },
        ),
      ]
    : porCnaeTodos;
  const maxCnae = Math.max(1, ...porCnae.map((c) => c.valor));

  const recentes = lista.slice(0, 8);

  const tiles = [
    { key: 'total', label: 'Total', valor: lista.length, tom: 'neutro' },
    { key: 'andamento', label: 'Em andamento', valor: emAndamento.length, tom: 'warning' },
    { key: 'concluidas', label: 'Concluídas', valor: concluidas.length, tom: 'good' },
    { key: 'reprovadas', label: 'Reprovadas', valor: reprovadas.length, tom: 'critical' },
    { key: 'aguardando', label: 'Aguardando você', valor: aguardandoVoce.length, tom: 'acao' },
  ];

  return (
    <div className="fin-page">
      <h1 className="fin-title"><LayoutDashboard size={26} /> Dashboard Financeiro</h1>
      <p className="fin-sub">
        {isFinAdmin
          ? 'Visão geral de todas as solicitações do Financeiro.'
          : 'Visão das solicitações que você abriu ou nas quais participa da aprovação.'}
      </p>

      {loading ? (
        <div className="fin-empty">Carregando...</div>
      ) : lista.length === 0 ? (
        <div className="fin-empty">
          <Inbox size={26} style={{ marginBottom: 8, opacity: 0.6 }} />
          <div>Nenhuma solicitação ainda. Os indicadores aparecem aqui assim que a primeira for aberta.</div>
        </div>
      ) : (
        <>
          {/* KPIs — o número é o gráfico; a cor vive no marcador, não no texto */}
          <div className="fin-tiles">
            {tiles.map((t) => (
              <div key={t.key} className={`fin-tile ${t.tom === 'acao' ? 'is-acao' : ''}`}>
                <span className={`fin-tile-mark tom-${t.tom}`} aria-hidden="true" />
                <span className="fin-tile-label">{t.label}</span>
                <span className="fin-tile-value">{t.valor}</span>
              </div>
            ))}
          </div>

          {/* Valores */}
          <div className="fin-tiles" style={{ marginTop: 14 }}>
            <div className="fin-tile">
              <span className="fin-tile-mark tom-neutro" aria-hidden="true" />
              <span className="fin-tile-label">Valor total solicitado</span>
              <span className="fin-tile-value">{formatarMoeda(soma(lista))}</span>
            </div>
            <div className="fin-tile">
              <span className="fin-tile-mark tom-warning" aria-hidden="true" />
              <span className="fin-tile-label">Em andamento</span>
              <span className="fin-tile-value">{formatarMoeda(soma(emAndamento))}</span>
            </div>
            <div className="fin-tile">
              <span className="fin-tile-mark tom-good" aria-hidden="true" />
              <span className="fin-tile-label">Concluído / liberado</span>
              <span className="fin-tile-value">{formatarMoeda(soma(concluidas))}</span>
            </div>
          </div>

          {/* Por tipo — 2 categorias: tiles, não gráfico */}
          <h2 className="fin-sec">Por tipo</h2>
          <div className="fin-tiles">
            {SOLICITACOES_FIN.map((cfg) => {
              const doTipo = lista.filter((s) => s.tipo === cfg.tipoDb);
              const Icon = cfg.icon;
              return (
                <Link key={cfg.slug} to="/financeiro/solicitacoes/acompanhar" className="fin-tile fin-tile-link">
                  <span className="fin-tile-ico"><Icon size={16} /></span>
                  <span className="fin-tile-label">{TIPO_LABEL_FIN[cfg.tipoDb]}</span>
                  <span className="fin-tile-value">{doTipo.length}</span>
                  <span className="fin-tile-foot">{formatarMoeda(soma(doTipo))}</span>
                </Link>
              );
            })}
          </div>

          {/* Top CNAE por valor — série única, valores rotulados direto */}
          <h2 className="fin-sec">Valor por CNAE</h2>
          <div className="fin-card">
            {porCnae.length === 0 ? (
              <div className="fin-empty" style={{ border: 'none', padding: 20 }}>Sem dados de CNAE.</div>
            ) : (
              <div className="fin-bars">
                {porCnae.map((c) => (
                  <div key={c.cnae} className="fin-bar-row" title={`${c.cnae}: ${formatarMoeda(c.valor)} · ${c.qtd} solicitação(ões)`}>
                    <span className="fin-bar-label">{c.cnae}</span>
                    <span className="fin-bar-track">
                      <span className="fin-bar-fill" style={{ width: `${Math.max(2, (c.valor / maxCnae) * 100)}%` }} />
                    </span>
                    <span className="fin-bar-value">{formatarMoeda(c.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Últimas solicitações — também serve de table view */}
          <h2 className="fin-sec">Últimas solicitações</h2>
          <div className="fin-card">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>#</th><th>Tipo</th><th>Despesa</th><th>CNAE</th>
                  <th className="num">Valor</th><th>Aberta</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((s) => {
                  const b = BADGE[s.status] || BADGE.pendente;
                  return (
                    <tr key={s.id}>
                      <td className="num">{s.numero ?? '—'}</td>
                      <td>{TIPO_LABEL_FIN[s.tipo] || s.tipo}</td>
                      <td>{s.nome_despesa || '—'}</td>
                      <td>{s.cnae || '—'}</td>
                      <td className="num">{s.valor != null ? formatarMoeda(s.valor) : '—'}</td>
                      <td className="num">{fmtData(s.created_at)}</td>
                      <td><span className={`fin-badge tom-${b.cls}`}>{b.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Link to="/financeiro/solicitacoes/acompanhar" className="fin-card-foot">
              Ver todas <ArrowRight size={14} />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
