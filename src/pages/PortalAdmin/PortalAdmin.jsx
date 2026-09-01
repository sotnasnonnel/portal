import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Search, Loader2, RefreshCw, CheckCircle2, MinusCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";
import { isSuperAdmin } from "../../config/superAdmin";
import { horasRoleFromPerfil, perfilEfetivoDp, HORAS_PAPEL_LABEL } from "../../config/horasPapel";
import "./PortalAdmin.css";

const DP_ROLES = [
  ["", "Sem acesso"],
  ["usuario", "Usuário"],
  ["coordenador", "Coordenador"],
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
// Financeiro: mesma lógica do Administrativo e do Programas — o módulo é aberto
// a todos (qualquer um pede cartão), então aqui só se define quem é do TIME do
// Financeiro, que executa e configura os fluxos. "Solicitante" é a ausência de
// papel; não existe mais "sem acesso" para escolher, porque marcar isso não
// tirava o acesso de ninguém.
const FIN_ROLES = [
  ["", "Solicitante"],
  ["admin", "Admin"],
];
// Administrativo: o módulo é aberto a todos (qualquer um abre chamado), então
// aqui só se define quem é do TIME do Adm — "Solicitante" é a ausência de papel.
const ADM_ROLES = [
  ["", "Solicitante"],
  ["atendente", "Atendente"],
  ["admin", "Admin"],
];
// Programas: mesma lógica do Administrativo — o módulo é aberto a todos
// (qualquer um registra ideia e indica oportunidade), então aqui só se define
// quem AVALIA a Alavanca. "Participante" é a ausência de papel.
const PROGRAMAS_ROLES = [
  ["", "Participante"],
  ["comercial", "Time comercial"],
  ["admin", "Admin"],
];
// Controle de Horas: o papel BASE deriva da hierarquia da Gestão de Pessoas
// (perfil + superior_id) — gestor/coordenador enxergam a própria equipe, o
// resto vê só o próprio tempo. O que se edita aqui é a ELEVAÇÃO (horas_role),
// que só vale neste módulo e nunca rebaixa: "Pela hierarquia" (= sem elevação)
// é o padrão, e "Admin do módulo" é o único jeito de ver/administrar TODAS as
// equipes sem virar admin do portal.
const HORAS_ROLES = [
  ["", "Pela hierarquia"],
  ["coordenador", "Coordenador"],
  ["gestor", "Gestor"],
  ["admin", "Admin do módulo"],
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
      supabase.from("colaboradores").select("id, nome, email, perfil, rh_dp, horas_role, financeiro_role, administrativo_role, programas_role, auth_id, ativo").order("nome"),
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
        // 'usuario' e NULL são a mesma coisa (sem elevação) — o select mostra
        // ambos como "Pela hierarquia".
        horasRole: c.horas_role && c.horas_role !== "usuario" ? c.horas_role : "",
        finRole: c.financeiro_role ?? null,
        admRole: c.administrativo_role ?? null,
        progRole: c.programas_role ?? null,
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
    } else if (app === "reembolso") {
      res = await supabase.from("reembolso_profiles").update({ role: value }).eq("id", row.reembId);
      patch = { reembRole: value };
    } else if (app === "horas") {
      // Elevação só-do-Horas. "" (Pela hierarquia) grava 'usuario' — o papel
      // volta a ser só o derivado do perfil, já que o efetivo é o maior dos dois.
      const stored = value === "" ? "usuario" : value;
      res = await supabase.from("colaboradores").update({ horas_role: stored }).eq("id", row.colabId);
      patch = { horasRole: value };
    } else if (app === "financeiro") {
      // Papel na própria colaboradores (como o DP). "" (Sem acesso) vira NULL.
      const stored = value === "" ? null : value;
      res = await supabase.from("colaboradores").update({ financeiro_role: stored }).eq("id", row.colabId);
      patch = { finRole: stored };
    } else if (app === "administrativo") {
      // "" (Solicitante) vira NULL — quem não é do time continua abrindo chamado.
      const stored = value === "" ? null : value;
      res = await supabase.from("colaboradores").update({ administrativo_role: stored }).eq("id", row.colabId);
      patch = { admRole: stored };
    } else if (app === "programas") {
      // "" (Participante) vira NULL — quem não é do comercial continua
      // registrando ideia e indicando oportunidade.
      const stored = value === "" ? null : value;
      res = await supabase.from("colaboradores").update({ programas_role: stored }).eq("id", row.colabId);
      patch = { progRole: stored };
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
    // Reembolso e PMO guardam o papel numa tabela propria, cuja linha nasce no
    // PRIMEIRO login da pessoa (a chave e o id de autenticacao, que so existe
    // depois que ela entra). Antes disso nao ha papel para editar — e dizer
    // "sem acesso" fazia parecer decisao de quem administra, quando e so
    // ninguem ter entrado ainda.
    if (!hasAccess) {
      return (
        <span
          className="pa-noaccess"
          title={
            row.jaLogou
              ? "Perfil ainda nao criado neste app."
              : "O papel neste app e criado no primeiro acesso da pessoa ao portal."
          }
        >
          {row.jaLogou ? "Sem perfil" : "Aguardando 1º acesso"}
        </span>
      );
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
                <th>Controle de Horas</th>
                <th>Reembolso</th>
                <th>PMO</th>
                <th>Financeiro</th>
                <th>Administrativo</th>
                <th>Programas</th>
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
                    <RoleSelect row={row} app="horas" value={row.horasRole} options={HORAS_ROLES} hasAccess />
                    {/* O select mostra a ELEVACAO; o papel que a pessoa tem de
                        fato e o maior entre ela e o que vem da hierarquia.
                        Sem esta linha, "Pela hierarquia" nao dizia qual. */}
                    <small className="pa-efetivo">
                      Hoje: {HORAS_PAPEL_LABEL[horasRoleFromPerfil(perfilEfetivoDp(row.dpRole, row.dpRh), row.horasRole)]}
                    </small>
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
                    <RoleSelect
                      row={row}
                      app="financeiro"
                      /* 'user' e NULL passaram a significar a mesma coisa (o
                         módulo é aberto a todos), então quem estiver gravado
                         como 'user' aparece como Solicitante. */
                      value={row.finRole === "admin" ? "admin" : ""}
                      options={FIN_ROLES}
                      hasAccess
                    />
                  </td>
                  <td>
                    <RoleSelect row={row} app="administrativo" value={row.admRole ?? ""} options={ADM_ROLES} hasAccess />
                  </td>
                  <td>
                    <RoleSelect row={row} app="programas" value={row.progRole ?? ""} options={PROGRAMAS_ROLES} hasAccess />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="pa-empty-cell">
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
