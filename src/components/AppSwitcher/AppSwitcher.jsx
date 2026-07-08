import { useState } from "react";
import { Link } from "react-router-dom";
import { Home, Users, Wallet, BarChart3, Clock, ChevronDown } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import "./AppSwitcher.css";

// Seletor de app compartilhado pelas 3 sidebars (DP, Reembolso, Solicitações).
// Ocupa o lugar do antigo botão "Início" e troca entre os módulos do portal
// que o usuário tem acesso, lido de `modules` no AuthContext unificado.
//
// Props:
//  - currentKey: 'dp' | 'reembolso' | 'solic'  (qual app está aberto)
//  - onNavigate: callback opcional ao escolher um app (ex.: fechar drawer mobile)
export default function AppSwitcher({ currentKey, onNavigate }) {
  const { modules, user } = useAuth();
  const [open, setOpen] = useState(false);

  const dpEntry =
    user?.perfil === "admin" ? "/admin/cadastro" : user?.perfil === "gestor" ? "/gestor" : "/usuario";

  const apps = [
    { key: "dp", label: "Gestão de Pessoas", to: dpEntry, Icon: Users, show: !!modules?.dp },
    { key: "reembolso", label: "Reembolsos", to: "/reembolsos", Icon: Wallet, show: !!modules?.reembolso },
    { key: "solic", label: "Solicitações", to: "/solic/dashboard", Icon: BarChart3, show: !!modules?.solic },
    { key: "horas", label: "Controle de Horas", to: "/horas/apontar", Icon: Clock, show: true },
    { key: "home", label: "Portal (início)", to: "/home", Icon: Home, show: true },
  ].filter((a) => a.show);

  const current = apps.find((a) => a.key === currentKey) ?? apps[0];
  const others = apps.filter((a) => a.key !== current.key);
  const CurrentIcon = current.Icon;

  const close = () => {
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div className="app-switcher">
      <button
        type="button"
        className="app-switcher-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Trocar de app"
      >
        <span className="app-switcher-icon" aria-hidden="true">
          <CurrentIcon size={16} />
        </span>
        <span className="app-switcher-text">
          <small>App</small>
          <strong>{current.label}</strong>
        </span>
        <span className={`app-switcher-chevron${open ? " is-open" : ""}`} aria-hidden="true">
          <ChevronDown size={16} />
        </span>
      </button>

      {open ? (
        <>
          <div className="app-switcher-backdrop" onClick={() => setOpen(false)} />
          <div className="app-switcher-menu" role="menu">
            {others.map(({ key, label, to, Icon }) => (
              <Link key={key} to={to} className="app-switcher-item" role="menuitem" onClick={close}>
                <span className="app-switcher-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
