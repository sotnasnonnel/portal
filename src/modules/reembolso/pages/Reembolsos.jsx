import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CalendarCheck, Clock, FileText, Loader2, Plus, RefreshCw } from "lucide-react";
import { listReimbursements, paidAmount, STATUS, STATUS_LABEL } from "../services/reimbursements.js";
import { formatCurrency, formatDate, relativeDays } from "../lib/format.js";
import { kindMeta } from "../lib/kind.js";
import { useAuth } from "../context/AuthContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import "./Reembolsos.css";

const FILTERS = [
  { value: "", label: "Todos" },
  { value: STATUS.EM_ANALISE, label: STATUS_LABEL.em_analise },
  { value: STATUS.APROVADO, label: STATUS_LABEL.aprovado },
  { value: STATUS.REPROVADO, label: STATUS_LABEL.reprovado },
  { value: STATUS.CANCELADO, label: STATUS_LABEL.cancelado },
];

// Filtro especial (não é um status): aprovados que ainda não têm pagamento agendado.
const A_PAGAR = "a_pagar";

// Rótulos da prestação de contas (só adiantamento)
const ACC_LABEL = {
  pendente: "Pendente",
  em_analise: "Em análise",
  acertado: "Acertado",
};

// Adiantamento aprovado cuja prestação de contas ainda não foi acertada
// (pendente ou em análise). Conta também como "Aguardando Aprovação", sem sair
// de "Aprovados" (o admin continua pagando o adiantamento normalmente).
function isAwaitingAccountability(r) {
  return (
    r.kind === "adiantamento" &&
    r.status === STATUS.APROVADO &&
    (r.accountability_status === "pendente" || r.accountability_status === "em_analise")
  );
}

export default function Reembolsos({ kind = "reembolso" }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const meta = kindMeta(kind);
  const isAdiantamento = kind === "adiantamento";
  const role = profile?.role;
  const isGestor = role === "gestor";
  const isAdmin = role === "admin";
  const canCreate = !isAdmin; // solicitante e gestor abrem pedidos; admin não
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  // null = ainda não escolhido: cada papel cai na sua fila de trabalho —
  // gestor em "Aguardando Aprovação", admin em "Aprovados" (a pagar/gerar PDF),
  // solicitante em "Todos". "" é uma escolha explícita do usuário.
  const [statusFilter, setStatusFilter] = useState(null);
  const roleDefault = isGestor ? STATUS.EM_ANALISE : isAdmin ? STATUS.APROVADO : "";
  const activeFilter = statusFilter ?? roleDefault;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await listReimbursements({ kind });
    setRows(data ?? []);
    setLoading(false);
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (activeFilter === A_PAGAR) {
      return rows.filter((r) => r.status === STATUS.APROVADO && !r.payment_date);
    }
    if (!activeFilter) return rows;
    // "Aguardando Aprovação" também inclui adiantamentos aprovados com prestação
    // de contas pendente/em análise (até serem acertados).
    if (activeFilter === STATUS.EM_ANALISE) {
      return rows.filter(
        (r) => r.status === STATUS.EM_ANALISE || isAwaitingAccountability(r)
      );
    }
    return rows.filter((r) => r.status === activeFilter);
  }, [rows, activeFilter]);

  const counts = useMemo(() => {
    const c = { "": rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    // soma os adiantamentos aprovados com prestação pendente/em análise na
    // contagem de "Aguardando Aprovação" (eles também aparecem nesse filtro).
    for (const r of rows) {
      if (isAwaitingAccountability(r)) {
        c[STATUS.EM_ANALISE] = (c[STATUS.EM_ANALISE] ?? 0) + 1;
      }
    }
    return c;
  }, [rows]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          acc.count += 1;
          // aprovado conta o valor pago (com desconto); demais, o total cheio
          acc.sum += r.status === STATUS.APROVADO ? paidAmount(r) : Number(r.total || 0);
          if (r.status === STATUS.EM_ANALISE) acc.pending += 1;
          if (r.status === STATUS.APROVADO) {
            acc.approved += 1;
            if (!r.payment_date) acc.toPayCount += 1;
          }
          return acc;
        },
        { count: 0, sum: 0, pending: 0, approved: 0, toPayCount: 0 }
      ),
    [rows]
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h2>{meta.plural}</h2>
          <p className="page-sub">
            {isGestor
              ? `Aprove e acompanhe os ${meta.plural.toLowerCase()} da sua equipe.`
              : isAdmin
                ? `Agende pagamentos e gere os PDFs dos ${meta.plural.toLowerCase()} aprovados.`
                : `Acompanhe e crie seus pedidos de ${meta.singular}.`}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={load} title="Recarregar">
            <RefreshCw size={16} /> Atualizar
          </button>
          {canCreate && (
            <button className="btn btn-primary" onClick={() => navigate(`${meta.base}/novo`)}>
              <Plus size={18} /> {meta.novo}
            </button>
          )}
        </div>
      </header>

      <section className="kpi-grid">
        <KPI
          label="Total de pedidos"
          value={totals.count}
          active={activeFilter === ""}
          onClick={() => setStatusFilter("")}
        />
        {isAdmin ? (
          <KPI
            label="A pagar"
            value={totals.toPayCount}
            accent="warning"
            active={activeFilter === A_PAGAR}
            onClick={() => setStatusFilter(A_PAGAR)}
          />
        ) : (
          <KPI
            label="Aguardando aprovação"
            value={totals.pending}
            accent="warning"
            active={activeFilter === STATUS.EM_ANALISE}
            onClick={() => setStatusFilter(STATUS.EM_ANALISE)}
          />
        )}
        <KPI
          label="Aprovados"
          value={totals.approved}
          accent="success"
          active={activeFilter === STATUS.APROVADO}
          onClick={() => setStatusFilter(STATUS.APROVADO)}
        />
        <KPI label="Valor acumulado" value={formatCurrency(totals.sum)} />
      </section>

      <section className="list-card">
        <div className="filters">
          {FILTERS.map((f) => (
            <button
              type="button"
              key={f.value || "all"}
              onClick={() => setStatusFilter(f.value)}
              className={`chip${activeFilter === f.value ? " is-active" : ""}`}
            >
              {f.label}
              {counts[f.value] > 0 && <span className="chip-count">{counts[f.value]}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="list-empty" role="status" aria-live="polite">
            <Loader2 size={28} className="spin" aria-hidden="true" />
            <p>Carregando {meta.plural.toLowerCase()}…</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            role={role}
            canCreate={canCreate}
            activeFilter={activeFilter}
            meta={meta}
            onCreate={() => navigate(`${meta.base}/novo`)}
          />
        ) : (
          <table className="table table-responsive">
            <thead>
              <tr>
                <th>Solicitante</th>
                <th>Cliente / Obra</th>
                <th>Data</th>
                <th className="num">Total</th>
                <th>Status</th>
                {isAdiantamento && <th>Prestação de contas</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  role="link"
                  aria-label={`Abrir ${meta.singular} de ${row.requester_name}`}
                  onClick={() => navigate(`${meta.base}/${row.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`${meta.base}/${row.id}`);
                    }
                  }}
                >
                  <td data-label="Solicitante">{row.requester_name}</td>
                  <td data-label="Cliente / Obra">{row.client_obra}</td>
                  <td data-label="Data">{formatDate(row.request_date)}</td>
                  <td className="num" data-label="Total">
                    {formatCurrency(
                      row.status === STATUS.APROVADO ? paidAmount(row) : Number(row.total || 0)
                    )}
                    {row.status === STATUS.APROVADO &&
                      row.approved_amount != null &&
                      Number(row.approved_amount) < Number(row.total || 0) && (
                        <span className="total-discounted" title="Valor aprovado com desconto">
                          de {formatCurrency(row.total)}
                        </span>
                      )}
                  </td>
                  <td data-label="Status">
                    <div className="status-cell">
                      <StatusBadge status={row.status} />
                      {row.status === STATUS.EM_ANALISE && (
                        <span className="aging" title="Tempo aguardando aprovação">
                          <Clock size={12} /> {relativeDays(row.created_at)}
                        </span>
                      )}
                      {row.status === STATUS.APROVADO &&
                        (row.payment_date ? (
                          <span className="pay-scheduled" title="Pagamento agendado">
                            <CalendarCheck size={12} /> pagar em {formatDate(row.payment_date)}
                          </span>
                        ) : (
                          <span className="pay-pending" title="Pagamento ainda não agendado">
                            <AlertCircle size={12} /> pagamento não agendado
                          </span>
                        ))}
                    </div>
                  </td>
                  {isAdiantamento && (
                    <td data-label="Prestação de contas">
                      {row.accountability_status ? (
                        <span className={`acc-pill acc-${row.accountability_status}`}>
                          {ACC_LABEL[row.accountability_status] ?? row.accountability_status}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function EmptyState({ role, canCreate, activeFilter, meta, onCreate }) {
  const filtered = activeFilter !== "";
  const s = meta.singular;
  if (role === "gestor") {
    return (
      <div className="list-empty">
        <FileText size={32} />
        <p>
          {filtered
            ? `Tudo em dia! Nenhum ${s} aguardando sua aprovação.`
            : `Nenhum ${s} da sua equipe ainda.`}
        </p>
      </div>
    );
  }
  if (role === "admin") {
    let message = `Nenhum ${s} registrado ainda.`;
    if (activeFilter === A_PAGAR) message = `Tudo em dia! Nenhum ${s} aguardando pagamento.`;
    else if (filtered) message = `Nenhum ${s} neste filtro.`;
    return (
      <div className="list-empty">
        <FileText size={32} />
        <p>{message}</p>
      </div>
    );
  }
  return (
    <div className="list-empty">
      <FileText size={32} />
      <p>{filtered ? `Nenhum ${s} neste filtro.` : `Nenhum ${s} encontrado.`}</p>
      {canCreate && (
        <button className="btn btn-primary" onClick={onCreate}>
          <Plus size={16} /> {filtered ? meta.novo : "Criar o primeiro"}
        </button>
      )}
    </div>
  );
}

function KPI({ label, value, accent, active, onClick }) {
  const clickable = typeof onClick === "function";
  const className = `kpi${accent ? ` kpi-${accent}` : ""}${clickable ? " kpi-clickable" : ""}${
    active ? " is-active" : ""
  }`;
  if (!clickable) {
    return (
      <div className={className}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} aria-pressed={active}>
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}
