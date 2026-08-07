import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import GuiaModal from '../../../../components/Guia/GuiaModal';
import { ADMINISTRATIVO_GUIA } from '../../../../components/Guia/guides';
import Sidebar from './Sidebar';
import { useDrawerMobile } from '../../../../hooks/useDrawerMobile';
import '../../administrativo.css';

export default function AppShell() {
  const { user, modules } = useAuth();
  const userName = user?.nome || (user?.email ? user.email.split('@')[0] : '');
  const { aberto, alternar, fechar } = useDrawerMobile();

  return (
    <div className="admRoot">
      <Sidebar aberto={aberto} onFechar={fechar} />
      <div className="admCol">
        <PortalHeader userName={userName} onMenuToggle={alternar} />
        <main className="admMain">
          <Outlet />
        </main>
      </div>
      {/* Guia do módulo: abre pelo "?" da barra superior. O conteúdo muda com o
          papel — solicitante, atendente ou admin do Adm. */}
      <GuiaModal {...ADMINISTRATIVO_GUIA} role={modules?.administrativo} userName={userName} />
    </div>
  );
}
