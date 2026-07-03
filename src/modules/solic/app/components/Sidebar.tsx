import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
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

// ÍCONES (SVG inline) — não depende de biblioteca
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
      <path
        d="M4 19V5a1 1 0 0 1 2 0v14h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z"
        fill="currentColor"
      />
      <path
        d="M9 17V11a1 1 0 1 1 2 0v6H9Zm4 0V8a1 1 0 1 1 2 0v9h-2Zm4 0v-4a1 1 0 1 1 2 0v4h-2Z"
        fill="currentColor"
      />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
      <path
        d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16h3a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h1Zm4-14h2V5H8v2Zm0 4h2V9H8v2Zm0 4h2v-2H8v2Zm4-8h2V5h-2v2Zm0 4h2V9h-2v2Zm0 4h2v-2h-2v2Z"
        fill="currentColor"
      />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
      <path
        d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm14 8H3v9a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-9Z"
        fill="currentColor"
      />
    </svg>
  );
}
function IconPlusDoc() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
      <path
        d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V7h3.5L14 3.5Z"
        fill="currentColor"
      />
      <path
        d="M12 10a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2H9a1 1 0 1 1 0-2h2v-2a1 1 0 0 1 1-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function Sidebar({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  const pathname = useLocation().pathname || "";
  const [openMobile, setOpenMobile] = useState(false);
  // Perfil vem do shell (já resolvido antes da rota abrir): síncrono, sem flicker
  // de menu usuário→admin nem consulta repetida ao banco.
  const { logout, solicProfile, user } = useAuth();

  const isAdmin = solicProfile?.role === "admin";
  const userEmail = solicProfile?.email || user?.email || "";
  const userName =
    (solicProfile?.name || "").trim() || user?.nome || (userEmail ? userEmail.split("@")[0] : "");

  const nav: NavItem[] = isAdmin
    ? [
        { label: "Dashboard", href: "/solic/dashboard", icon: <IconChart /> },
        { label: "Empresas", href: "/solic/admin/cadastros", icon: <IconBuilding /> },
        { label: "Prazos", href: "/solic/admin/prazos", icon: <IconCalendar /> },
      ]
    : [
        { label: "Dashboard", href: "/solic/dashboard", icon: <IconChart /> },
        { label: "Nova Solicitação", href: "/solic/surveys/new", icon: <IconPlusDoc /> },
      ];

  const onLogout = async () => {
    clearSupabaseCache();
    clearSolicIdentity();
    await logout();
  };

  return (
    <>
      {/* topo mobile */}
      <div className={styles.mobileTop}>
        <button className={styles.iconBtn} onClick={() => setOpenMobile(true)} aria-label="Abrir menu">
          ☰
        </button>
        <div className={styles.mobileTitle}>Menu</div>
      </div>

      {openMobile ? <div className={styles.overlay} onClick={() => setOpenMobile(false)} /> : null}

      <aside className={`${styles.sb} ${openMobile ? styles.open : ""} ${collapsed ? styles.collapsed : ""}`}>
        <div className={styles.header}>
          <Link to="/home" className={styles.brand} aria-label="Voltar ao início" onClick={() => setOpenMobile(false)}>
            <LogoSolicitacoes size="sm" />
          </Link>

          <button
            type="button"
            className={styles.collapseBtn}
            onClick={onToggle}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            <IconChevron />
          </button>

          <button className={styles.closeMobile} onClick={() => setOpenMobile(false)} aria-label="Fechar menu">
            ✕
          </button>
        </div>

        <nav className={styles.nav}>
          <AppSwitcher currentKey="solic" onNavigate={() => setOpenMobile(false)} />
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                title={item.label}
                className={`${styles.link} ${active ? styles.active : ""}`}
                onClick={() => setOpenMobile(false)}
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
            <IconLogout />
          </button>
        </div>
      </aside>
    </>
  );
}
