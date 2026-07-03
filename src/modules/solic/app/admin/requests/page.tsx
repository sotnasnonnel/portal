import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { invalidateCache } from "@/lib/supabaseCache";
import { fetchMyProfile } from "@/lib/data";
import { StatusBadge } from "@/app/components/StatusBadge";
import { formatDateBR } from "@/lib/date";

type Row = {
  id: number;
  requester: string | null;
  needed_date: string | null;
  admin_deadline: string | null;
  status: string;
  urgent: boolean;
  created_at: string;
  assets: { code: string; title: string } | null;
};

export default function AdminRequestsPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [savingId, setSavingId] = useState<number | null>(null);
  const [deadlineById, setDeadlineById] = useState<Record<number, string>>({});

  const load = async () => {
    setErr(null);

    // A rota já é protegida pelo SolicAdminRoute no shell; este check é só defensivo.
    const me = await fetchMyProfile();
    const ok = me.role === "admin";
    setIsAdmin(ok);
    setChecking(false);

    if (!ok) return;

    const { data, error } = await supabase
      .from("solic_surveys")
      .select("id, requester, needed_date, admin_deadline, status, urgent, created_at, assets:solic_assets(code,title)")
      .order("created_at", { ascending: false });

    if (error) return setErr(error.message);

    const list = (data as any[]) as Row[];
    setRows(list);

    // preencher inputs com o valor atual
    const map: Record<number, string> = {};
    for (const r of list) {
      if (r.admin_deadline) map[r.id] = r.admin_deadline;
    }
    setDeadlineById(map);
  };

  useEffect(() => {
    load();
  }, []);

  const pending = useMemo(() => rows.filter(r => !r.admin_deadline), [rows]);
  const withDeadline = useMemo(() => rows.filter(r => !!r.admin_deadline), [rows]);

  const saveDeadline = async (id: number) => {
    setErr(null);
    const value = deadlineById[id];
    if (!value) return setErr("Selecione uma data de prazo.");

    setSavingId(id);

    // quando admin define prazo, vira SCHEDULED (padrão)
    const { error } = await supabase
      .from("solic_surveys")
      .update({ admin_deadline: value, status: "SCHEDULED" })
      .eq("id", id);

    setSavingId(null);

    if (error) return setErr(error.message);

    invalidateCache(["surveys:"]);
    await load();
  };

  if (checking) {
    return (
      <div className="card">
        <div className="loadingRow"><span className="spinner" /> Carregando...</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="pageHeader">
        <h1 className="pageTitle">Definir prazos das solicitações</h1>
        <div className="pageSubtitle">Sem prazo: <b>{pending.length}</b> • Com prazo: <b>{withDeadline.length}</b></div>
      </div>

      {err && (
        <div className="card">
          <div className="small" style={{ color: "var(--danger)", fontWeight: 800 }}>{err}</div>
        </div>
      )}

      <div className="card">
        <div className="cardTitle" style={{ marginBottom: 14 }}>Sem prazo (definir agora)</div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Código</th>
              <th>Empresa</th>
              <th>Solicitante</th>
              <th>Necessidade</th>
              <th>Prazo (Admin)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pending.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.assets?.code ?? "-"}</td>
                <td>{r.assets?.title ?? "-"}</td>
                <td>{r.requester ?? "-"}</td>
                <td>{formatDateBR(r.needed_date)}</td>
                <td>
                  <input
                    type="date"
                    value={deadlineById[r.id] ?? ""}
                    onChange={(e) => setDeadlineById((m) => ({ ...m, [r.id]: e.target.value }))}
                  />
                </td>
                <td style={{ width: 150 }}>
                  <button
                    className="primary"
                    disabled={savingId === r.id}
                    onClick={() => saveDeadline(r.id)}
                    style={{ height: 36, padding: "0 14px", width: "100%", fontSize: 13 }}
                  >
                    {savingId === r.id ? "Salvando..." : "Salvar prazo"}
                  </button>
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr>
                <td colSpan={7} className="small">Nenhuma pendente.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="cardTitle" style={{ marginBottom: 14 }}>Com prazo</div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Código</th>
              <th>Empresa</th>
              <th>Solicitante</th>
              <th>Necessidade</th>
              <th>Prazo (Admin)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {withDeadline.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.assets?.code ?? "-"}</td>
                <td>{r.assets?.title ?? "-"}</td>
                <td>{r.requester ?? "-"}</td>
                <td>{formatDateBR(r.needed_date)}</td>
                <td><b>{formatDateBR(r.admin_deadline)}</b></td>
                <td><StatusBadge status={r.status} urgent={r.urgent} /></td>
              </tr>
            ))}
            {withDeadline.length === 0 && (
              <tr>
                <td colSpan={7} className="small">Nenhuma com prazo ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
