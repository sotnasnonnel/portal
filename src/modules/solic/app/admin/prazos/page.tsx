import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/app/components/StatusBadge";
import { formatDateBR } from "@/lib/date";

type Row = {
  id: number;
  requester: string | null;
  needed_date: string | null;
  admin_deadline: string | null;
  status: string;
  assets?: { code?: string | null; title?: string | null } | null;
};

// Grupos de status (mesmos rótulos e cores do StatusBadge / dashboard) p/ os cards-filtro.
const GROUPS: { key: string; label: string; statuses: string[]; color: string }[] = [
  { key: "aberta", label: "Aberta", statuses: ["SUBMITTED", "URGENT_REVIEW"], color: "#26405d" },
  { key: "andamento", label: "Em andamento", statuses: ["SCHEDULING", "SCHEDULED", "IN_PROGRESS"], color: "#c35e1e" },
  { key: "concluida", label: "Concluída", statuses: ["COMPLETED"], color: "#00a49a" },
  { key: "cancelada", label: "Cancelada", statuses: ["CANCELLED"], color: "#b85236" },
];

const groupOf = (status: string) => GROUPS.find((g) => g.statuses.includes(status))?.key ?? null;

export default function AdminPrazosPage() {
  // Acesso admin garantido pelo SolicAdminRoute no shell.
  return <Inner />;
}

function Inner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // Filtro por grupo de status (multi-seleção). Padrão: Abertas + Em andamento.
  const [active, setActive] = useState<Set<string>>(() => new Set(["aberta", "andamento"]));

  const toggleGroup = (key: string) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);

      const { data, error } = await supabase
        .from("solic_surveys")
        .select("id, requester, needed_date, admin_deadline, status, assets:solic_assets(code,title)")
        .order("needed_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      setLoading(false);

      if (error) {
        setErr(error.message);
        setRows([]);
        return;
      }

      setRows((data as any) || []);
    })();
  }, []);

  const updateDeadline = async (id: number, date: string) => {
    const { data: updatedRows, error } = await supabase
      .from("solic_surveys")
      .update({ admin_deadline: date || null })
      .eq("id", id)
      .select("id, admin_deadline");

    const updated = updatedRows?.[0];
    if (error || !updated) {
      alert("Erro ao salvar prazo: " + (error?.message || "Sem permissão (RLS)"));
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, admin_deadline: updated.admin_deadline } : r)));
  };

  const countByGroup = (key: string) => rows.filter((r) => groupOf(r.status) === key).length;
  const filtered = active.size === 0 ? rows : rows.filter((r) => active.has(groupOf(r.status) ?? ""));

  if (loading) return <div className="card"><div className="loadingRow"><span className="spinner" /> Carregando...</div></div>;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="pageHeader">
        <h1 className="pageTitle">Prazos (Admin)</h1>
        <div className="pageSubtitle">Defina o prazo de entrega de cada solicitação.</div>
      </div>

      {err ? (
        <div className="card">
          <div className="small" style={{ color: "var(--danger)", fontWeight: 800 }}>
            {err}
          </div>
        </div>
      ) : null}

      <div className="statGrid">
        <div
          className="statCard"
          onClick={() => setActive(new Set())}
          style={{ cursor: "pointer", ...(active.size === 0 ? { outline: "2px solid var(--primary)" } : {}) }}
        >
          <div className="statLabel">Todas</div>
          <div className="statValue">{rows.length}</div>
        </div>
        {GROUPS.map((g) => (
          <div
            key={g.key}
            className="statCard"
            onClick={() => toggleGroup(g.key)}
            style={{ cursor: "pointer", ["--accent" as any]: g.color, ...(active.has(g.key) ? { outline: `2px solid ${g.color}` } : {}) }}
          >
            <div className="statLabel">{g.label}</div>
            <div className="statValue">{countByGroup(g.key)}</div>
          </div>
        ))}
      </div>

      <div className="card">
      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Código</th>
              <th>Empresa</th>
              <th>Solicitante</th>
              <th>Necessidade</th>
              <th>Entrega (Admin)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>#{r.id}</td>
                <td>{r.assets?.code ?? "—"}</td>
                <td>{r.assets?.title ?? "—"}</td>
                <td>{r.requester ?? "—"}</td>
                <td>{formatDateBR(r.needed_date)}</td>
                <td>
                  <input
                    type="date"
                    defaultValue={r.admin_deadline ?? ""}
                    onBlur={(e) => updateDeadline(r.id, e.target.value)}
                  />
                </td>
                <td><StatusBadge status={r.status} /></td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="small">Nenhuma solicitação.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
