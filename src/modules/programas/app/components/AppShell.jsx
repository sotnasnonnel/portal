import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import GuiaModal from '../../../../components/Guia/GuiaModal';
import { PROGRAMAS_GUIA } from '../../../../components/Guia/guides';
import Sidebar from './Sidebar';
import { useDrawerMobile } from '../../../../hooks/useDrawerMobile';
import '../../programas.css';

export default function AppShell() {
  const { user, modules } = useAuth();
  const userName = user?.nome || (user?.email ? user.email.split('@')[0] : '');
  const { aberto, alternar, fechar } = useDrawerMobile();

  return (
    <div className="pgRoot">
      <Sidebar aberto={aberto} onFechar={fechar} />
      <div className="pgCol">
        <PortalHeader modulo="Programas" onMenuToggle={alternar} />
        <main className="pgMain">
          <Outlet />
        </main>
      </div>
      {/* Guia do módulo: abre pelo "?" da barra superior. O conteúdo muda com o
          papel — participante ou time comercial. */}
      <GuiaModal {...PROGRAMAS_GUIA} role={modules?.programas} userName={userName} />
    </div>
  );
}
