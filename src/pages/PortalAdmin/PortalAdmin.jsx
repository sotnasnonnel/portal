import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Search, Loader2, RefreshCw, CheckCircle2, MinusCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";
import { isSuperAdmin } from "../../config/superAdmin";
import "./PortalAdmin.css";

const DP_ROLES = [
  ["", "Sem acesso"],
  ["usuario", "Usuário"],
  ["gestor", "Gestor"],
  ["admin", "Admin"],
  ["rh", "RH / DP"],
];
const REEMB_ROLES = [
  ["solicitante", "Solicitante"],
  ["gestor", "Gestor"],
  ["admin", "Admin"],
];
const SOLIC_ROLES = [
  ["user", "Usuário"],
  ["admin", "Admin"],
];
// Controle de Horas: todos têm acesso; o papel define quem administra o módulo.
const HORAS_ROLES = [
  ["usuario", "Usuário"],
  ["admin", "Admin"],
];

export default function PortalAdmin() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [savingKey, setSavingKey] = useState(null);

  async function load() {
    setLoading(true);
    setErr("");
    const [colab, reemb, solic] = await Promise.all([
      supabase.from("colaboradores").select("id, nome, email, perfil, rh_dp, horas_role, auth_id, ativo").order("nome"),
      supabase.from("reembolso_profiles").select("id, email, role"),
      supabase.from("solic_profiles").select("id, email, role"),
    ]);
    if (colab.error) {
      setErr(colab.error.message);
      setLoading(false);
      return;
    }
    const reembByEmail = new Map((reemb.data || []).map((r) => [(r.email || "").toLowerCase(), r]));
    const solicByEmail = new Map((solic.data || []).map((r) => [(r.email || "").toLowerCase(), r]));
    const merged = (colab.data || []).map((c) => {
      const key = (c.email || "").toLowerCase();
      const r = reembByEmail.get(key);
      const s = solicByEmail.get(key);
      return {
        colabId: c.id,
        nome: c.nome,
        email: c.email,
        ativo: c.ativo,
        jaLogou: !!c.auth_id,
        dpRole: c.perfil,
        dpRh: c.rh_dp === true,
        horasRole: c.horas_role || "usuario",
        reembId: r?.id ?? null,
        reembRole: r?.role ?? null,
        solicId: s?.id ?? null,
        solicRole: s?.role ?? null,
      };
    });
    setRows(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(row, app, value) {
    const key = `${row.email}:${app}`;
    setSavingKey(key);
    let res;
    let patch;
    if (app === "dp") {
      if (value === "rh") {
        // Novo perfil RH/DP: flag rh_dp (vê tudo) + base 'usuario'. Perfil efetivo vira 'rh'.
        res = await supabase.from("colaboradores").update({ rh_dp: true, perfil: "usuario" }).eq("id", row.colabId);
        patch = { dpRole: "usuario", dpRh: true };
      } else {
        // "" (Sem acesso) vira NULL (modules.dp = perfil ?? null). Sair do RH zera o flag.
        const stored = value === "" ? null : value;
        res = await supabase.from("colaboradores").update({ rh_dp: false, perfil: stored }).eq("id", row.colabId);
        patch = { dpRole: stored, dpRh: false };
      }
    } else if (app === "horas") {
      // Papel próprio do módulo, guardado em colaboradores.horas_role.
      res = await supabase.from("colaboradores").update({ horas_role: value }).eq("id", row.colabId);
      patch = { horasRole: value };
    } else if (app === "reembolso") {
      res = await supabase.from("reembolso_profiles").update({ role: value }).eq("id", row.reembId);
      patch = { reembRole: value };
    } else {
      res = await supabase.from("solic_profiles").update({ role: value }).eq("id", row.solicId);
      patch = { solicRole: value };
    }
    setSavingKey(null);
    if (res?.error) {
      window.alert("Não foi possível salvar a alteração: " + res.error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.email === row.email ? { ...r, ...patch } : r)));
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) => (r.nome || "").toLowerCase().includes(t) || (r.email || "").toLowerCase().includes(t)
    );
  }, [rows, q]);

  const stats = useMemo(() => {
    const total = rows.length;
    const logados = rows.filter((r) => r.jaLogou).length;
    return { total, logados };
  }, [rows]);

  // Gate de UI (a RLS é quem realmente protege as escritas).
  if (!isSuperAdmin(user)) return <Navigate to="/home" replace />;

  function RoleSelect({ row, app, value, options, hasAccess }) {
    const key = `${row.email}:${app}`;
    const saving = savingKey === key;
    if (!hasAccess) {
      return <span className="pa-noaccess">Sem acesso</span>;
    }
    return (
      <div className={`pa-select-wrap${saving ? " is-saving" : ""}`}>
        <select
          className="pa-select"
          value={value ?? ""}
          disabled={saving}
          onChange={(e) => changeRole(row, app, e.target.value)}
        >
          {options.map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        {saving ? <Loader2 size={14} className="pa-spin" /> : null}
      </div>
    );
  }

  return (
    <div className="pa-page">
      <header className="pa-header">
        <Link to="/home" className="pa-back">
          <ArrowLeft size={18} /> Portal
        </Link>
        <div className="pa-header-titles">
          <h1>Gerenciamento de acessos</h1>
          <p>Defina o papel de cada pessoa em cada app e veja quem já entrou no portal.</p>
        </div>
        <button type="button" className="pa-refresh" onClick={load} title="Recarregar">
          <RefreshCw size={16} /> Atualizar
        </button>
      </header>

      <div className="pa-toolbar">
        <div className="pa-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="pa-stats">
          <span>
            <strong>{stats.total}</strong> pessoas
          </span>
          <span>
            <strong>{stats.logados}</strong> já entraram
          </span>
        </div>
      </div>

      {err ? <div className="pa-error">Erro ao carregar: {err}</div> : null}

      <div className="pa-table-wrap">
        {loading ? (
          <div className="pa-empty">
            <Loader2 size={26} className="pa-spin" /> Carregando…
          </div>
        ) : (
          <table className="pa-table">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th className="pa-center">Já entrou?</th>
                <th>Gestão de Pessoas</th>
                <th>Reembolso</th>
                <th>Solicitações</th>
                <th>Controle de Horas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.email} className={row.ativo === false ? "pa-inactive" : ""}>
                  <td>
                    <div className="pa-person">
                      <strong>{row.nome || "—"}</strong>
                      <small>{row.email}</small>
                    </div>
                  </td>
                  <td className="pa-center">
                    {row.jaLogou ? (
                      <span className="pa-badge pa-badge-yes">
                        <CheckCircle2 size={13} /> Sim
                      </span>
                    ) : (
                      <span className="pa-badge pa-badge-no">
                        <MinusCircle size={13} /> Não
                      </span>
                    )}
                  </td>
                  <td>
                    <RoleSelect row={row} app="dp" value={row.dpRh ? "rh" : (row.dpRole ?? "")} options={DP_ROLES} hasAccess />
                  </td>
                  <td>
                    <RoleSelect
                      row={row}
                      app="reembolso"
                      value={row.reembRole}
                      options={REEMB_ROLES}
                      hasAccess={!!row.reembId}
                    />
                  </td>
                  <td>
                    <RoleSelect
                      row={row}
                      app="solic"
                      value={row.solicRole}
                      options={SOLIC_ROLES}
                      hasAccess={!!row.solicId}
                    />
                  </td>
                  <td>
                    {/* Módulo aberto a todos: sempre editável (Usuário/Admin). */}
                    <RoleSelect row={row} app="horas" value={row.horasRole} options={HORAS_ROLES} hasAccess />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="pa-empty-cell">
                    Ninguém encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
