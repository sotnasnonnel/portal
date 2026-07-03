import { NavLink, Link } from "react-router-dom";
import { FileText, HelpCircle, Wallet, LogOut, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { openOnboarding } from "../../lib/onboarding.js";
import LogoReembolso from "../LogoReembolso.jsx";
import AppSwitcher from "../../../../components/AppSwitcher/AppSwitcher";
import "./Sidebar.css";

const NAV = [
  { to: "/reembolsos", label: "Reembolsos", icon: FileText },
  { to: "/adiantamentos", label: "Adiantamentos", icon: Wallet },
];

const ROLE_LABEL = {
  solicitante: "Solicitante",
  gestor: "Gestor",
  admin: "Administrador",
};

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0];
  return chars.toUpperCase();
}

export default function Sidebar({ collapsed = false, onToggle }) {
  const { profile, signOut } = useAuth();
  const name = profile?.display_name || profile?.full_name || profile?.email || "Usuário";
  const role = ROLE_LABEL[profile?.role] ?? "—";

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <Link to="/" className="sidebar-logo" aria-label="Ir para a tela inicial">
          <LogoReembolso size="sm" />
        </Link>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggle}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <AppSwitcher currentKey="reembolso" />
        {NAV.map(({ to, label, icon: Icon, end, disabled }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}${disabled ? " is-disabled" : ""}`
            }
            onClick={(e) => disabled && e.preventDefault()}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
            {disabled && <em>em breve</em>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-avatar">{initials(name)}</div>
        <div className="sidebar-user">
          <strong>{name}</strong>
          <small>{role}</small>
        </div>
        <button
          type="button"
          className="sidebar-help"
          onClick={openOnboarding}
          title="Ver tutorial"
          aria-label="Ver tutorial"
        >
          <HelpCircle size={16} />
        </button>
        <button
          type="button"
          className="sidebar-logout"
          onClick={signOut}
          title="Sair"
          aria-label="Sair"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
