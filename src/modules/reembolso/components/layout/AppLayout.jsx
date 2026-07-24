import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { preloadReembolsoData } from "../../services/dataPreload.js";
// Reembolsos são solicitações do Financeiro: a sidebar (com o grupo "Reembolsos")
// e o shell vêm de lá — daí o .finRoot, que carrega os tokens --f-* que ela usa.
// As telas continuam sob .reembolso-root, mantendo os estilos próprios.
import Sidebar from "../../../financeiro/app/components/Sidebar";
import PortalHeader from "../../../../components/PortalHeader/PortalHeader";
import GuiaModal from "../../../../components/Guia/GuiaModal";
import { REEMBOLSO_GUIA } from "../../../../components/Guia/guides";
import "../../../financeiro/financeiro.css";
import "./AppLayout.css";
// Tokens e estilos globais do módulo reembolso (mesmos valores do PHD design-system).
import "../../styles/tokens.css";
import "../../styles/global.css";

export default function AppLayout() {
  const { profile } = useAuth();

  // Aquece o cache do Supabase assim que o usuário autenticado entra no app.
  useEffect(() => {
    if (profile) preloadReembolsoData();
  }, [profile]);

  const userName = profile?.display_name || profile?.full_name || profile?.email || "";

  return (
    <div className="finRoot">
      <Sidebar />
      <div className="finCol">
        <PortalHeader userName={userName} />
        <main className="app-content reembolso-root">
          <Outlet />
        </main>
      </div>
      <GuiaModal {...REEMBOLSO_GUIA} role={profile?.role} userName={userName} />
    </div>
  );
}
