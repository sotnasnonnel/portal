import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { LayoutDashboard, Loader2, Inbox, ArrowRight } from "lucide-react";
import { listReimbursements, paidAmount, STATUS } from "../services/reimbursements.js";
import { formatCurrency, formatDate } from "../lib/format.js";
import { useAuth } from "../context/AuthContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import "./Reembolsos.css";

/**
 * Dashboard dos Reembolsos — separado do de Cartões porque as perguntas são
 * outras: quanto já foi aprovado, o que espera decisão e, para o Financeiro, o
 * que está aprovado e ainda sem data de pagamento.
 *
 * A visibilidade é a da RLS, igual à da lista: solicitante vê os seus, gestor
 * os da equipe, admin (do reembolso ou do Financeiro) vê todos.
 */

// Aprovado sem data de pagamento: é o que sobra para o Financeiro agendar.
const aPagar = (r) => r.status === STATUS.APROVADO && !r.payment_date;
const rota = (r) => `${r.kind === "adiantamento" ? "/adiantamentos" : "/reembolsos"}/${r.id}`;

export default function DashboardReembolso() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(() => {
    listReimbursements()
      .then(({ data }) => setRows(data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const m = useMemo(() => {
    const porStatus = (st) => rows.filter((r) => r.status === st);
    const emAnalise = porStatus(STATUS.EM_ANALISE);
    const aprovados = porStatus(STATUS.APROVADO);
    return {
      emAnalise,
      aprovados,
      reprovados: porStatus(STATUS.REPROVADO),
      reembolsos: rows.filter((r) => (r.kind ?? "reembolso") === "reembolso"),
      adiantamentos: rows.filter((r) => r.kind === "adiantamento"),
      aguardandoPagamento: aprovados.filter(aPagar),
      // No aprovado conta o que será pago (já com desconto); no resto, o total.
      valorAprovado: aprovados.reduce((t, r) => t + paidAmount(r), 0),
      valorEmAnalise: emAnalise.reduce((t, r) => t + Number(r.total || 0), 0),
    };
  }, [rows]);

  const recentes = rows.slice(0, 8);
  const isAdmin = !!profile?.isAdmin;
  // Solicitante não tem painel: a lista dele já é o painel. Barrado aqui também
  // porque esconder do menu não impede digitar a rota.
  const vePainel = isAdmin || profile?.role === "gestor";
  if (profile && !vePainel) return <Navigate to="/reembolsos" replace />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h2>Dashboard de Reembolsos</h2>
          <p className="page-sub">
            {isAdmin
              ? "Reembolsos e adiantamentos da empresa, com o que ainda falta pagar."
              : "Seus reembolsos e adiantamentos, e o que está esperando decisão."}
          </p>
        </div>
        <div className="page-actions">
          <LayoutDashboard size={20} aria-hidden="true" />
        </div>
      </header>

      {loading ? (
        <div className="list-empty" role="status" aria-live="polite">
          <Loader2 size={28} className="spin" aria-hidden="true" />
          <p>Carregando…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="list-empty">
          <Inbox size={28} aria-hidden="true" />
          <p>Nenhum pedido ainda. Os indicadores aparecem quando o primeiro for aberto.</p>
          <button className="btn btn-primary" onClick={() => navigate("/reembolsos/novo")}>
            Criar reembolso
          </button>
        </div>
      ) : (
        <>
          <section className="kpi-grid">
            <Kpi label="Total de pedidos" value={rows.length} />
            <Kpi label="Aguardando aprovação" value={m.emAnalise.length} accent="warning" />
            <Kpi label="Aprovados" value={m.aprovados.length} accent="success" />
            <Kpi label="Reprovados" value={m.reprovados.length} />
          </section>

          <section className="kpi-grid" style={{ marginTop: 12 }}>
            <Kpi label="Valor aprovado" value={formatCurrency(m.valorAprovado)} accent="success" />
            <Kpi label="Valor em análise" value={formatCurrency(m.valorEmAnalise)} accent="warning" />
            <Kpi label="A pagar (sem data)" value={m.aguardandoPagamento.length} accent="warning" />
          </section>

          <section className="kpi-grid" style={{ marginTop: 12 }}>
            <Kpi label="Reembolsos" value={m.reembolsos.length} />
            <Kpi label="Adiantamentos" value={m.adiantamentos.length} />
          </section>

          <section className="list-card" style={{ marginTop: 16 }}>
            <div className="list-card-head">
              <h3>Últimos pedidos</h3>
              <Link to="/reembolsos" className="list-see-all">
                Ver todos <ArrowRight size={14} />
              </Link>
            </div>
            <table className="table table-responsive">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Solicitante</th>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th className="num">Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((r) => (
                  <tr
                    key={r.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`Abrir pedido ${r.code ?? ""}`}
                    onClick={() => navigate(rota(r))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(rota(r));
                      }
                    }}
                  >
                    <td data-label="Código">{r.code ?? "—"}</td>
                    <td data-label="Solicitante">{r.requester_name}</td>
                    <td data-label="Tipo">{r.kind === "adiantamento" ? "Adiantamento" : "Reembolso"}</td>
                    <td data-label="Data">{formatDate(r.request_date)}</td>
                    <td className="num" data-label="Valor">
                      {formatCurrency(r.status === STATUS.APROVADO ? paidAmount(r) : Number(r.total || 0))}
                    </td>
                    <td data-label="Status"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

// Mesmo cartão de indicador da lista de reembolsos (Reembolsos.css), na versão
// sem clique: aqui o número é informação, não filtro.
function Kpi({ label, value, accent }) {
  return (
    <div className={`kpi${accent ? ` kpi-${accent}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
