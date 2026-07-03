import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { invalidateCache } from "@/lib/supabaseCache";
import { getMySolicProfile } from "@/lib/identity";

type AssetRow = { id: number; code: string; title: string };

export default function NewSurveyPage() {
  const navigate = useNavigate();

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [assetId, setAssetId] = useState<number | null>(null);

  // id do perfil do módulo (solic_profiles.id) — é o valor gravado em created_by
  const [profileId, setProfileId] = useState<string | null>(null);

  const [requester, setRequester] = useState("");
  const [neededDate, setNeededDate] = useState(""); // yyyy-mm-dd
  const [requestText, setRequestText] = useState("");
  const [urgent, setUrgent] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // O shell já garante usuário autenticado com perfil do módulo (ModuleRoute).
      const prof = await getMySolicProfile();
      if (prof) {
        setProfileId(prof.id);
        if (prof.name) setRequester(prof.name);
      }

      // contratos/empresas visíveis para todos
      const { data, error } = await supabase
        .from("solic_assets")
        .select("id, code, title")
        .order("code", { ascending: true });

      if (error) {
        setErr(error.message);
        setAssets([]);
      } else {
        setAssets((data as AssetRow[]) || []);
      }

      setLoading(false);
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!assetId) return setErr("Selecione um Código da Empresa.");
    if (!requester.trim()) return setErr("Informe o Solicitante.");
    if (!requestText.trim()) return setErr("Descreva a Solicitação.");
    if (!neededDate) return setErr("Selecione a Data de Necessidade.");

    setSaving(true);

    const payload = {
      asset_id: assetId,
      requester: requester.trim(),
      needed_date: neededDate,      // coluna no banco
      request_text: requestText.trim(), // coluna no banco
      status: urgent ? "URGENT_REVIEW" : "SUBMITTED",
      urgent: Boolean(urgent),      // ✅ novo campo
      // created_by referencia solic_profiles.id (uuid antigo) — explícito para
      // não depender de default auth.uid(), que não bate com o banco compartilhado.
      created_by: profileId,
    };

    // ✅ "as any" para evitar travas de tipos do Supabase/TS
    const { error } = await supabase.from("solic_surveys").insert(payload as any);

    setSaving(false);

    if (error) {
      setErr(error.message);
      return;
    }

    invalidateCache(["surveys:"]);

    // Depois de criar, volta para o Dashboard do módulo
    navigate("/solic/dashboard");
  };

  if (loading)
    return (
      <div className="card">
        <div className="loadingRow"><span className="spinner" /> Carregando...</div>
      </div>
    );

  return (
    <div className="card">
      <div className="cardTitle">Nova Solicitação</div>
      <div className="cardSubtitle">Preencha os dados abaixo para registrar uma nova solicitação.</div>

      {err ? (
        <div className="small" style={{ color: "var(--danger)", fontWeight: 800, marginTop: 12 }}>
          {err}
        </div>
      ) : null}

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 18, marginTop: 20 }}>
        <div style={{ display: "grid" }}>
          <label className="label">Contrato (Código da Empresa)</label>
          <select value={assetId ?? ""} onChange={(e) => setAssetId(Number(e.target.value) || null)}>
            <option value="">Selecione...</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.title}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid" }}>
          <label className="label">Solicitante</label>
          <input value={requester} onChange={(e) => setRequester(e.target.value)} />
        </div>

        <div style={{ display: "grid" }}>
          <label className="label">Data de Necessidade</label>
          <input type="date" value={neededDate} onChange={(e) => setNeededDate(e.target.value)} />
        </div>
        <div style={{ display: "grid" }}>
          <label className="label">Solicitação</label>
          <textarea
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            placeholder="Descreva detalhadamente o que você precisa..."
            rows={5}
            style={{ resize: "vertical" }}
          />
        </div>

        <button className="btnOrange" type="submit" disabled={saving} style={{ width: "100%", minWidth: 0 }}>
          {saving ? "Salvando..." : "Enviar Solicitação"}
        </button>
      </form>
    </div>
  );
}
