import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Building2, CalendarDays, FilePlus2, LogOut, ChevronLeft } from "lucide-react";
import { useAuth } from "../../../../contexts/AuthContext";
import { clearSupabaseCache } from "@/lib/supabaseCache";
import { clearSolicIdentity } from "@/lib/identity";
import LogoSolicitacoes from "./LogoSolicitacoes";
import AppSwitcher from "../../../../components/AppSwitcher/AppSwitcher";
import styles from "./Sidebar.module.css";

type NavItem = { label: string; href: string; icon: React.ReactNode };

function isActive(pathname: string, href: string) {
  if (href === "/solic") return pathname === "/solic";
  return pathname.startsWith(href);
}

function initialsFrom(name: string, email: string) {
  const base = (name || email || "").trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

// Ícones no padrão do portal (lucide-react, traço fino) — mesmo conjunto usado
// nos módulos Financeiro/Horas.

// aberto/onFechar controlam o drawer no mobile. O botão que abre é o ☰ do
// PortalHeader (ver src/hooks/useDrawerMobile.js) — este módulo tinha uma barra
// de topo própria que ficava SOB a saudação do PortalHeader, escondendo o botão.
export function Sidebar({
  collapsed = false,
  onToggle,
  aberto = false,
  onFechar,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  aberto?: boolean;
  onFechar?: () => void;
}) {
  const pathname = useLocation().pathname || "";
  // Perfil vem do shell (já resolvido antes da rota abrir): síncrono, sem flicker
  // de menu usuário→admin nem consulta repetida ao banco.
  const { logout, solicProfile, user } = useAuth();

  const isAdmin = solicProfile?.role === "admin";
  const userEmail = solicProfile?.email || user?.email || "";
  const userName =
    (solicProfile?.name || "").trim() || user?.nome || (userEmail ? userEmail.split("@")[0] : "");

  const nav: NavItem[] = isAdmin
    ? [
        { label: "Dashboard", href: "/solic/dashboard", icon: <LayoutDashboard className={styles.icon} /> },
        { label: "Empresas", href: "/solic/admin/cadastros", icon: <Building2 className={styles.icon} /> },
        { label: "Prazos", href: "/solic/admin/prazos", icon: <CalendarDays className={styles.icon} /> },
      ]
    : [
        { label: "Dashboard", href: "/solic/dashboard", icon: <LayoutDashboard className={styles.icon} /> },
        { label: "Nova Solicitação", href: "/solic/surveys/new", icon: <FilePlus2 className={styles.icon} /> },
      ];

  const onLogout = async () => {
    clearSupabaseCache();
    clearSolicIdentity();
    await logout();
  };

  return (
    <>
      <div
        className={`${styles.overlay} ${aberto ? styles.overlayOpen : ""}`}
        onClick={onFechar}
        aria-hidden="true"
      />

      <aside className={`${styles.sb} ${aberto ? styles.open : ""} ${collapsed ? styles.collapsed : ""}`}>
        <div className={styles.header}>
          <Link to="/home" className={styles.brand} aria-label="Voltar ao início" onClick={onFechar}>
            <LogoSolicitacoes size="sm" />
          </Link>

          <button
            type="button"
            className={styles.collapseBtn}
            onClick={onToggle}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            <ChevronLeft />
          </button>

          <button className={styles.closeMobile} onClick={onFechar} aria-label="Fechar menu">
            ✕
          </button>
        </div>

        <nav className={styles.nav}>
          <AppSwitcher currentKey="solic" onNavigate={onFechar} />
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                title={item.label}
                className={`${styles.link} ${active ? styles.active : ""}`}
                onClick={onFechar}
              >
                <span className={styles.iconWrap} aria-hidden="true">
                  {item.icon}
                </span>
                <span className={styles.label}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.spacer} />

        <div className={styles.footer}>
          <div className={styles.avatar} aria-hidden="true">
            {initialsFrom(userName, userEmail)}
          </div>
          <div className={styles.userInfo}>
            <strong title={userName || userEmail || ""}>{userName || "Usuário"}</strong>
            <small>{isAdmin ? "Administrador" : "Usuário"}</small>
          </div>
          <button className={styles.logout} onClick={onLogout} title="Sair" aria-label="Sair" type="button">
            <LogOut />
          </button>
        </div>
      </aside>
    </>
  );
}
