import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { preloadReembolsoData } from "../../services/dataPreload.js";
import Sidebar from "./Sidebar.jsx";
import PortalHeader from "../../../../components/PortalHeader/PortalHeader";
import GuiaModal from "../../../../components/Guia/GuiaModal";
import { REEMBOLSO_GUIA } from "../../../../components/Guia/guides";
import "./AppLayout.css";
// Tokens e estilos globais do módulo reembolso (mesmos valores do PHD design-system).
import "../../styles/tokens.css";
import "../../styles/global.css";

export default function AppLayout() {
  const { profile } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("reem-sidebar-collapsed") === "1"; } catch { return false; }
  });

  // Aquece o cache do Supabase assim que o usuário autenticado entra no app.
  useEffect(() => {
    if (profile) preloadReembolsoData();
  }, [profile]);

  useEffect(() => {
    try { localStorage.setItem("reem-sidebar-collapsed", collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);

  const userName = profile?.display_name || profile?.full_name || profile?.email || "";

  return (
    <div className={`app-layout reembolso-root ${collapsed ? "is-collapsed" : ""}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className="app-col">
        <PortalHeader userName={userName} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
      <GuiaModal {...REEMBOLSO_GUIA} role={profile?.role} userName={userName} />
    </div>
  );
}
