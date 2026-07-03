import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Asset } from "@/lib/types";

export function AssetPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (asset: Asset) => void;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    if (!open) return;

    const run = async () => {
      setLoading(true);
      setError(null);

      const base = supabase.from("solic_assets").select("id, code, title").order("id", { ascending: false }).limit(50);

      const { data, error } =
        query.length === 0
          ? await base
          : await supabase
              .from("solic_assets")
              .select("id, code, title")
              .or(`code.ilike.%${query}%,title.ilike.%${query}%`)
              .order("id", { ascending: false })
              .limit(50);

      if (error) setError(error.message);
      setAssets((data as Asset[]) || []);
      setLoading(false);
    };

    run();
  }, [open, query]);

  if (!open) return null;

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 800 }}>Selecionar Contrato</div>
          <button onClick={onClose}>Fechar</button>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="label">Buscar por Código do Projeto ou Nome da empresa</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex: ADMB-CT01-GERE, ADM Brasil"
          />
          <div className="small" style={{ marginTop: 8 }}>
            Mostrando até 50 resultados.
          </div>
        </div>

        <hr />

        {loading && <div className="small">Carregando...</div>}
        {error && (
          <div className="small" style={{ color: "var(--danger)" }}>
            {error}
          </div>
        )}

        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Código da Empresa</th>
              <th>Nome da Empresa</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td>{a.code}</td>
                <td>{a.title}</td>
                <td style={{ width: 140 }}>
                  <button className="primary" onClick={() => onPick(a)}>
                    Selecionar
                  </button>
                </td>
              </tr>
            ))}

            {assets.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="small">
                  Nenhum contrato encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="small" style={{ marginTop: 10 }}>
          Se não aparecer nada, crie um contrato na tabela <b>assets</b> no Supabase.
        </div>
      </div>
    </div>
  );
}
