import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { fetchMyProfile } from "@/lib/data";
import { AdminKanbanBoard, type SurveyLite, type SurveyStatus } from "@/app/components/AdminKanbanBoard";
import { StatusBadge } from "@/app/components/StatusBadge";
import { formatDateBR, isOldCompleted } from "@/lib/date";

const OPEN_STATUSES: SurveyStatus[] = ["DRAFT", "SUBMITTED", "URGENT_REVIEW"];
const INPROG_STATUSES: SurveyStatus[] = ["SCHEDULING", "SCHEDULED", "IN_PROGRESS"];

export default function AssetDashboardPage() {
  return (
    <Suspense fallback={<div className="card"><div className="loadingRow"><span className="spinner" /> Carregando...</div></div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const [params] = useSearchParams();
  const contractId = params.get("id") || "";

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [surveys, setSurveys] = useState<SurveyLite[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);

      // Perfil do módulo: userId = solic_profiles.id (compatível com created_by).
      const me = await fetchMyProfile();
      setUserId(me.userId);
      setIsAdmin(me.role === "admin");

      const { data, error } = await supabase
        .from("solic_surveys")
        .select("id, status, created_by, requester, needed_date, admin_deadline, completed_at, assets:solic_assets(code,title)")
        .eq("asset_id", contractId)
        .order("needed_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) {
        setErr(error.message);
        setSurveys([]);
        setLoading(false);
        return;
      }

      // ✅ esconde concluídas há mais de 7 dias (continuam no banco)
      const visiveis = ((data as any[]) || []).filter((s) => !isOldCompleted(s.status, s.completed_at));
      setSurveys(visiveis as SurveyLite[]);
      setLoading(false);
    })();
  }, [contractId]);

  const counts = useMemo(() => {
    const abertas = surveys.filter((s) => OPEN_STATUSES.includes(s.status as SurveyStatus)).length;
    const andamento = surveys.filter((s) => INPROG_STATUSES.includes(s.status as SurveyStatus)).length;
    const concluidas = surveys.filter((s) => (s.status as SurveyStatus) === "COMPLETED").length;
    const canceladas = surveys.filter((s) => (s.status as SurveyStatus) === "CANCELLED").length;
    return { abertas, andamento, concluidas, canceladas };
  }, [surveys]);

  const myCount = useMemo(() => {
    if (!userId) return 0;
    return surveys.filter((s) => s.created_by === userId).length;
  }, [surveys, userId]);

  if (loading) {
    return (
      <div className="card">
        <div className="loadingRow"><span className="spinner" /> Carregando...</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="pageHeader">
        <h1 className="pageTitle">Dashboard</h1>
        <div className="pageSubtitle">
          {isAdmin
            ? "Admin: você pode arrastar cards no Kanban para mudar o status."
            : "Você pode acompanhar todas as solicitações. A sua fica destacada."}
        </div>
        {err ? <div className="small" style={{ color: "var(--danger)", fontWeight: 800, marginTop: 8 }}>{err}</div> : null}
      </div>

      <div className="statGrid">
        <div className="statCard" style={{ ["--accent" as any]: "#26405d" }}>
          <div className="statLabel">Abertas</div>
          <div className="statValue">{counts.abertas}</div>
        </div>
        <div className="statCard" style={{ ["--accent" as any]: "#c35e1e" }}>
          <div className="statLabel">Em andamento</div>
          <div className="statValue">{counts.andamento}</div>
        </div>
        <div className="statCard" style={{ ["--accent" as any]: "#00a49a" }}>
          <div className="statLabel">Concluídas</div>
          <div className="statValue">{counts.concluidas}</div>
        </div>
        <div className="statCard" style={{ ["--accent" as any]: "#b85236" }}>
          <div className="statLabel">Canceladas</div>
          <div className="statValue">{counts.canceladas}</div>
        </div>
        <div className="statCard" style={{ ["--accent" as any]: "#00a49a" }}>
          <div className="statLabel">Minhas</div>
          <div className="statValue">{myCount}</div>
        </div>
      </div>

      <div>
        <div className="cardTitle" style={{ marginBottom: 4 }}>Kanban</div>
        <div className="cardSubtitle" style={{ marginBottom: 12 }}>{isAdmin ? "Arraste os cards para mudar o status." : "Somente admin pode mover status."}</div>
        <AdminKanbanBoard surveys={surveys} setSurveys={setSurveys} userId={userId} isAdmin={isAdmin} />
      </div>

      <div className="card">
        <div className="cardTitle">Solicitações</div>
        <div className="cardSubtitle">Todas as solicitações do contrato. As suas ficam destacadas.</div>

        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Código da Empresa</th>
                <th>Solicitante</th>
                <th>Necessidade</th>
                <th>Entrega</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {surveys.map((s) => {
                const mine = userId && s.created_by === userId;
                return (
                  <tr key={s.id} style={mine ? { background: "rgba(0,164,154,0.07)" } : undefined}>
                    <td><Link to={`/solic/survey?id=${s.id}`}>{s.id}</Link></td>
                    <td>{(s as any).assets?.code ?? "—"}</td>
                    <td>{s.requester ?? "—"}</td>
                    <td>{formatDateBR(s.needed_date)}</td>
                    <td>{formatDateBR(s.admin_deadline)}</td>
                    <td><StatusBadge status={s.status} /></td>
                  </tr>
                );
              })}
              {surveys.length === 0 ? (
                <tr><td colSpan={6} className="small">Nenhuma solicitação.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
