import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMyProfile, fetchSurveysDashboard } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { AdminKanbanBoard, type SurveyLite, type SurveyStatus } from "../components/AdminKanbanBoard";
import { StatusBadge } from "../components/StatusBadge";
import { formatDateBR, isOldCompleted } from "@/lib/date";

// Ícone de lixeira (SVG inline, no padrão do módulo — sem dependência externa).
function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

const OPEN_STATUSES: SurveyStatus[] = ["DRAFT", "SUBMITTED", "URGENT_REVIEW"];
const INPROG_STATUSES: SurveyStatus[] = ["SCHEDULING", "SCHEDULED", "IN_PROGRESS"];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [surveys, setSurveys] = useState<SurveyLite[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  async function handleDelete(id: string | number) {
    if (!window.confirm(`Excluir a solicitação ${id}? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(id);
    const { error } = await supabase.from("solic_surveys").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      window.alert("Não foi possível excluir a solicitação: " + error.message);
      return;
    }
    setSurveys((prev) => prev.filter((s) => s.id !== id));
  }

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);

      // O shell já garante usuário autenticado com perfil do módulo (ModuleRoute).
      const me = await fetchMyProfile();
      if (!me.userId) {
        setLoading(false);
        return;
      }

      setUserId(me.userId);
      setIsAdmin(me.role === "admin");

      // ✅ SEM FILTRO por asset_id => mostra tudo
      const { data, error } = await fetchSurveysDashboard();

      if (error) {
        setErr(error.message);
        setSurveys([]);
        setLoading(false);
        return;
      }

      // ✅ esconde concluídas há mais de 7 dias (continuam no banco)
      const visiveis = ((data as any[]) || []).filter(
        (s) => !isOldCompleted(s.status, s.completed_at)
      );
      setSurveys(visiveis as SurveyLite[]);
      setLoading(false);
    })();
  }, []);

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
        <h1 className="pageTitle">Dashboard Geral</h1>
        <div className="pageSubtitle">
          {isAdmin
            ? "Acompanhe e gerencie todas as solicitações."
            : "Você pode acompanhar todas as solicitações. A sua fica destacada."}
        </div>
        {err ? (
          <div className="small" style={{ color: "var(--danger)", fontWeight: 800, marginTop: 8 }}>
            {err}
          </div>
        ) : null}
      </div>

      {/* contadores */}
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
        {!isAdmin ? (
          <div className="statCard" style={{ ["--accent" as any]: "#00a49a" }}>
            <div className="statLabel">Minhas</div>
            <div className="statValue">{myCount}</div>
          </div>
        ) : null}
      </div>

      <div>
        <div className="cardTitle" style={{ marginBottom: 12 }}>Kanban</div>
        <AdminKanbanBoard surveys={surveys} setSurveys={setSurveys} userId={userId} isAdmin={isAdmin} />
      </div>

      {/* tabela */}
      <div className="card">
        <div className="cardTitle">Solicitações</div>
        <div className="cardSubtitle">Todas as solicitações (todas as empresas). As suas ficam destacadas.</div>

        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Código da Empresa</th>
                <th>Nome da Empresa</th>
                <th>Solicitante</th>
                <th>Necessidade</th>
                <th>Entrega</th>
                <th>Status</th>
                {isAdmin ? <th style={{ width: 48, textAlign: "center" }}>Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {surveys.map((s) => {
                const mine = userId && s.created_by === userId;
                const a = (s as any).assets;
                return (
                  <tr key={s.id} style={mine ? { background: "rgba(0,164,154,0.07)" } : undefined}>
                    <td><Link to={`/solic/survey?id=${s.id}`}>{s.id}</Link></td>
                    <td>{a?.code ?? "—"}</td>
                    <td>{a?.title ?? "—"}</td>
                    <td>{s.requester ?? "—"}</td>
                    <td>{formatDateBR(s.needed_date)}</td>
                    <td>{formatDateBR(s.admin_deadline)}</td>
                    <td><StatusBadge status={s.status} urgent={s.urgent} /></td>
                    {isAdmin ? (
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id)}
                          disabled={deletingId === s.id}
                          title="Excluir solicitação"
                          aria-label={`Excluir solicitação ${s.id}`}
                          style={{
                            display: "inline-grid",
                            placeItems: "center",
                            width: 32,
                            height: 32,
                            border: "none",
                            borderRadius: 8,
                            background: "transparent",
                            color: "var(--danger, #b85236)",
                            cursor: deletingId === s.id ? "default" : "pointer",
                            opacity: deletingId === s.id ? 0.5 : 1,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(184,82,54,0.12)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <IconTrash />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {surveys.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="small">Nenhuma solicitação.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
