import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import GuiaModal from '../../../../components/Guia/GuiaModal';
import { ALOJAMENTOS_GUIA } from '../../../../components/Guia/guides';
import Sidebar from './Sidebar';
import { useDrawerMobile } from '../../../../hooks/useDrawerMobile';
import '../../alojamentos.css';

export default function AppShell() {
  const { user, modules } = useAuth();
  const userName = user?.nome || (user?.email ? user.email.split('@')[0] : '');
  const { aberto, alternar, fechar } = useDrawerMobile();

  return (
    <div className="alojRoot">
      <Sidebar aberto={aberto} onFechar={fechar} />
      <div className="alojCol">
        <PortalHeader modulo="Alojamentos" onMenuToggle={alternar} />
        <main className="alojMain">
          <Outlet />
        </main>
      </div>
      <GuiaModal {...ALOJAMENTOS_GUIA} role={modules?.administrativo} userName={userName} />
    </div>
  );
}
