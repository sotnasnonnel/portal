import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { invalidateCache } from "@/lib/supabaseCache";

const ICON_BTN: React.CSSProperties = {
  width: 34,
  height: 32,
  padding: 0,
  minWidth: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const svgProps = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconPencil() {
  return (
    <svg {...svgProps} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg {...svgProps} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export default function AdminCadastrosPage() {
  // Acesso admin garantido pelo SolicAdminRoute no shell.
  return (
    <Suspense fallback={<div className="card"><div className="loadingRow"><span className="spinner" /> Carregando...</div></div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="pageHeader">
        <h1 className="pageTitle">Empresas</h1>
        <div className="pageSubtitle">Empresas e contratos cadastrados no sistema.</div>
      </div>

      <EmpresaTab />
    </div>
  );
}

type Asset = { id: number; code: string | null; title: string | null };

function EmpresaTab() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // criar (em modal)
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const openModal = () => {
    setCode("");
    setTitle("");
    setErr(null);
    setShowModal(true);
  };
  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
  };

  // editar (inline)
  const [editId, setEditId] = useState<number | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [rowErr, setRowErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("solic_assets").select("id, code, title").order("code", { ascending: true });
    setAssets((data as Asset[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!code.trim() || !title.trim()) {
      setErr("Preencha Código e Nome da empresa.");
      return;
    }
    setSaving(true);
    const { data: created, error } = await supabase
      .from("solic_assets")
      .insert({ code: code.trim(), title: title.trim() })
      .select("id, code, title")
      .single();
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    invalidateCache(["assets:"]);
    if (created) {
      setAssets((prev) => [...prev, created as Asset].sort((x, y) => (x.code ?? "").localeCompare(y.code ?? "")));
    }
    setCode("");
    setTitle("");
    setShowModal(false);
  };

  const startEdit = (a: Asset) => {
    setEditId(a.id);
    setEditCode(a.code ?? "");
    setEditTitle(a.title ?? "");
    setRowErr(null);
  };

  const saveEdit = async (id: number) => {
    setRowErr(null);
    if (!editCode.trim() || !editTitle.trim()) {
      setRowErr("Preencha código e nome.");
      return;
    }
    const { error } = await supabase.from("solic_assets").update({ code: editCode.trim(), title: editTitle.trim() }).eq("id", id);
    if (error) {
      setRowErr(error.message);
      return;
    }
    invalidateCache(["assets:", "surveys:"]);
    setAssets((prev) => prev.map((x) => (x.id === id ? { ...x, code: editCode.trim(), title: editTitle.trim() } : x)));
    setEditId(null);
  };

  const onDelete = async (a: Asset) => {
    const okDel = window.confirm(
      `Excluir a empresa "${a.code} — ${a.title}"?\nAs solicitações ligadas a ela ficarão sem empresa (não são apagadas).`
    );
    if (!okDel) return;
    const { error } = await supabase.from("solic_assets").delete().eq("id", a.id);
    if (error) {
      window.alert("Erro ao excluir: " + error.message);
      return;
    }
    invalidateCache(["assets:", "surveys:"]);
    setAssets((prev) => prev.filter((x) => x.id !== a.id));
  };

  const smallBtn = { height: 34, padding: "0 12px", fontSize: 13, minWidth: 0 } as const;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* lista + botão de cadastrar (abre modal) */}
      <div className="card" style={{ boxShadow: "none", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="cardTitle">Empresas cadastradas</div>
            <div className="cardSubtitle">{loading ? "Carregando..." : `${assets.length} empresa(s)`}</div>
          </div>
          <button
            className="btnOrange"
            type="button"
            onClick={openModal}
            style={{ minWidth: 0, padding: "0 16px", height: 40, whiteSpace: "nowrap" }}
          >
            + Cadastrar nova empresa
          </button>
        </div>
        {rowErr ? <div className="small" style={{ color: "var(--danger)", fontWeight: 800, marginTop: 10 }}>{rowErr}</div> : null}

        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th style={{ width: 110, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) =>
                editId === a.id ? (
                  <tr key={a.id}>
                    <td><input value={editCode} onChange={(e) => setEditCode(e.target.value)} style={{ height: 38 }} /></td>
                    <td><input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ height: 38 }} /></td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="primary" style={smallBtn} onClick={() => saveEdit(a.id)}>Salvar</button>{" "}
                      <button className="ghost" style={smallBtn} onClick={() => setEditId(null)}>Cancelar</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 800, color: "var(--text)", whiteSpace: "nowrap" }}>{a.code}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{a.title}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="ghost" style={ICON_BTN} title="Editar" aria-label="Editar" onClick={() => startEdit(a)}>
                        <IconPencil />
                      </button>{" "}
                      <button
                        className="ghost"
                        style={{ ...ICON_BTN, color: "var(--danger)", borderColor: "rgba(184,82,54,0.30)" }}
                        title="Excluir"
                        aria-label="Excluir"
                        onClick={() => onDelete(a)}
                      >
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                )
              )}
              {!loading && assets.length === 0 ? (
                <tr><td colSpan={3} className="small">Nenhuma empresa cadastrada ainda.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {showModal ? (
        <div
          onClick={closeModal}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 520 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div className="cardTitle">Nova empresa</div>
              <button className="ghost" type="button" onClick={closeModal} aria-label="Fechar" style={ICON_BTN}>✕</button>
            </div>
            <div className="cardSubtitle">Cadastre uma nova empresa/contrato no sistema.</div>

            {err ? <div className="small" style={{ color: "var(--danger)", fontWeight: 800, marginTop: 12 }}>{err}</div> : null}

            <form onSubmit={onCreate} style={{ display: "grid", gap: 18, marginTop: 20 }}>
              <div style={{ display: "grid" }}>
                <label className="label">Código da Empresa</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: ADMB-CT01-GERE" autoFocus />
              </div>
              <div style={{ display: "grid" }}>
                <label className="label">Nome da Empresa</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: ADM Brasil" />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="ghost" type="button" onClick={closeModal} disabled={saving} style={{ height: 44, padding: "0 16px", minWidth: 0 }}>
                  Cancelar
                </button>
                <button className="btnOrange" type="submit" disabled={saving} style={{ height: 44, padding: "0 20px", minWidth: 0 }}>
                  {saving ? "Salvando..." : "Criar Empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
