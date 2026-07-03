import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/app/components/Sidebar";
import { fetchMyProfile, fetchSurveysDashboard } from "@/lib/data";
import { useAuth } from "../../../../contexts/AuthContext";
import PortalHeader from "../../../../components/PortalHeader/PortalHeader";
import GuiaModal from "../../../../components/Guia/GuiaModal";
import { SOLIC_GUIA } from "../../../../components/Guia/guides";
import "../../solic.css";

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const { solicProfile, user } = useAuth();
  const userName =
    (solicProfile?.name || "").trim() || user?.nome || (user?.email ? user.email.split("@")[0] : "");

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("phd_sidebar_collapsed") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  // Kill-switch: o app NÃO usa service worker. Remove qualquer SW "fantasma"
  // registrado por versões antigas (causava "offline sem cache" / 502 ao navegar
  // e ao enviar convite) e limpa os caches dele.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (navigator.serviceWorker) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }, []);

  // Preload: logo após entrar numa tela autenticada, aquece o cache em background
  // (perfil + listas) para que as próximas navegações abram sem spinner.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const run = () => {
      fetchMyProfile();
      fetchSurveysDashboard();
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void };
    if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 1500 });
    else window.setTimeout(run, 300);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("phd_sidebar_collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className={`solicRoot solicShell ${collapsed ? "isCollapsed" : ""}`.trim()}>
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <PortalHeader userName={userName} upper />
        <main className="solicMain">
          <div style={{ width: "100%", minWidth: 0 }}>
            <Outlet />
          </div>
        </main>
      </div>
      <GuiaModal {...SOLIC_GUIA} role={solicProfile?.role} userName={userName} />
    </div>
  );
}
