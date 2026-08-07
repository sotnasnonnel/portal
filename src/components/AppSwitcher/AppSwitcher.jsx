import { useState } from "react";
import { Link } from "react-router-dom";
import { Home, Users, BarChart3, Clock, CreditCard, Headset, ChevronDown } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { podeAcessarAdm } from "../../config/administrativo";
import "./AppSwitcher.css";

// Seletor de app compartilhado pelas sidebars do portal.
// Ocupa o lugar do antigo botão "Início" e troca entre os módulos do portal
// que o usuário tem acesso, lido de `modules` no AuthContext unificado.
//
// Props:
//  - currentKey: 'dp' | 'solic' | 'horas' | 'financeiro' | 'administrativo'  (qual app está aberto)
//  - onNavigate: callback opcional ao escolher um app (ex.: fechar drawer mobile)
export default function AppSwitcher({ currentKey, onNavigate }) {
  const { modules, user } = useAuth();
  const [open, setOpen] = useState(false);

  const dpEntry =
    user?.perfil === "admin" ? "/admin/cadastro" : user?.perfil === "gestor" ? "/gestor" : "/usuario";

  const apps = [
    { key: "dp", label: "Gestão de Pessoas", to: dpEntry, Icon: Users, show: !!modules?.dp },
    { key: "solic", label: "PMO", to: "/solic/dashboard", Icon: BarChart3, show: !!modules?.solic },
    { key: "horas", label: "Controle de Horas", to: "/horas/apontar", Icon: Clock, show: true },
    // Reembolsos deixou de ser app próprio: virou um grupo na sidebar do Financeiro.
    // Por isso quem tem só o Reembolso também precisa desta entrada — é a porta de acesso.
    {
      key: "financeiro",
      label: "Financeiro",
      to: modules?.financeiro ? "/financeiro" : "/reembolsos",
      Icon: CreditCard,
      show: !!modules?.financeiro || !!modules?.reembolso,
    },
    // Administrativo é aberto a todos os logados, como o Controle de Horas —
    // mas enquanto está em construção só aparece para quem está testando.
    { key: "administrativo", label: "Administrativo", to: "/administrativo/novo", Icon: Headset, show: podeAcessarAdm(user) },
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
