import { Suspense, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { invalidateCache } from "@/lib/supabaseCache";
import { Survey, Asset } from "@/lib/types";
import { StatusBadge } from "@/app/components/StatusBadge";
import { formatDateTimeBR } from "@/lib/date";

export default function SurveyDetailPage() {
  return (
    <Suspense fallback={<div className="card"><div className="loadingRow"><span className="spinner" /> Carregando...</div></div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const [params] = useSearchParams();
  const surveyId = Number(params.get("id"));

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);

  const [neededDate, setNeededDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    setMsg(null);

    const { data: s, error: e1 } = await supabase.from("solic_surveys").select("*").eq("id", surveyId).single();
    if (e1) return setErr(e1.message);

    const surveyData = s as Survey;
    setSurvey(surveyData);
    setNeededDate(surveyData.needed_date ?? "");

    const { data: a, error: e2 } = await supabase.from("solic_assets").select("*").eq("id", surveyData.asset_id).single();
    if (e2) return setErr(e2.message);
    setAsset(a as Asset);
  };

  useEffect(() => {
    if (!Number.isFinite(surveyId)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  const schedule = async () => {
    if (!survey) return;
    setErr(null);
    setMsg(null);
    if (!neededDate) return setErr("Informe a data de necessidade.");

    setLoading(true);
    const { error } = await supabase.from("solic_surveys").update({ needed_date: neededDate, status: "SCHEDULED" }).eq("id", survey.id);
    setLoading(false);
    if (error) return setErr(error.message);

    invalidateCache(["surveys:"]);
    setMsg("Agendado com sucesso (SCHEDULED).");
    load();
  };

  const setStatus = async (status: Survey["status"]) => {
    if (!survey) return;
    setErr(null);
    setMsg(null);

    setLoading(true);
    const { error } = await supabase.from("solic_surveys").update({ status }).eq("id", survey.id);
    setLoading(false);
    if (error) return setErr(error.message);

    invalidateCache(["surveys:"]);
    setMsg(`Status atualizado para ${status}.`);
    load();
  };

  const miniBtn = { height: 36, padding: "0 14px", fontSize: 13, minWidth: 0 } as const;

  if (!Number.isFinite(surveyId)) {
    return (
      <div className="card">
        <div className="small">ID da solicitação inválido.</div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="card">
        <div className="loadingRow"><span className="spinner" /> Carregando...</div>
        {err && (
          <div className="small" style={{ color: "var(--danger)", fontWeight: 800, marginTop: 8 }}>{err}</div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div className="cardTitle">{survey.name}</div>
          <div className="cardSubtitle">
            Solicitação #{survey.id} • Criada em {formatDateTimeBR(survey.created_at)}
          </div>
        </div>
        <StatusBadge status={survey.status} />
      </div>

      <hr />

      <div className="row">
        <div className="col">
          <div className="label">Ativo</div>
          <div className="small">
            {asset ? (
              <>
                <b>{asset.code}</b> — {asset.title}
                <div className="small" style={{ marginTop: 6 }}>
                  <Link to={`/solic/asset?id=${asset.id}`}>Abrir dashboard do ativo</Link>
                </div>
              </>
            ) : (
              "Carregando ativo..."
            )}
          </div>
        </div>

        <div className="col">
          <div className="label">Tempo estimado</div>
          <div className="small">{survey.estimated_duration_minutes} min</div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="label">Solicitação</div>
        <div className="small" style={{ whiteSpace: "pre-wrap" }}>
          {((survey as any).request_text ?? survey.notes ?? "-") || "-"}
        </div>
      </div>

      <hr />

      {(survey.status === "SCHEDULING" || survey.status === "URGENT_REVIEW") && (
        <div className="card" style={{ background: "var(--primary-tint)", borderColor: "rgba(195,94,30,0.25)", boxShadow: "none" }}>
          <div style={{ fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>
            {survey.status === "URGENT_REVIEW" ? "Urgente: falar com gerente/coordenador" : "Programar (normal)"}
          </div>
          <div className="small" style={{ marginBottom: 10 }}>
            Defina a <b>data de necessidade</b> para entrar como SCHEDULED.
          </div>
          <div className="row">
            <div className="col">
              <div className="label">Data de necessidade</div>
              <input type="date" value={neededDate} onChange={(e) => setNeededDate(e.target.value)} />
            </div>
            <div className="col" style={{ display: "flex", alignItems: "end", gap: 10 }}>
              <button className="primary" onClick={schedule} disabled={loading}>
                {loading ? "Salvando..." : "Confirmar programação"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="primary" style={miniBtn} onClick={() => setStatus("IN_PROGRESS")} disabled={loading}>Em Andamento</button>
        <button className="secondary" style={miniBtn} onClick={() => setStatus("COMPLETED")} disabled={loading}>Concluído</button>
        <button className="danger" style={miniBtn} onClick={() => setStatus("CANCELLED")} disabled={loading}>Cancelar</button>
      </div>

      {err && <div className="small" style={{ color: "var(--danger)", fontWeight: 900, marginTop: 10 }}>{err}</div>}
      {msg && <div className="small" style={{ color: "var(--teal)", fontWeight: 900, marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
