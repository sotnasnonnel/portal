import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import GuiaModal from '../../../../components/Guia/GuiaModal';
import { FINANCEIRO_GUIA } from '../../../../components/Guia/guides';
import Sidebar from './Sidebar';
import '../../financeiro.css';

export default function AppShell() {
  const { user, modules } = useAuth();
  const userName = user?.nome || (user?.email ? user.email.split('@')[0] : '');

  return (
    <div className="finRoot">
      <Sidebar />
      <div className="finCol">
        <PortalHeader userName={userName} />
        <main className="finMain">
          <Outlet />
        </main>
      </div>
      <GuiaModal {...FINANCEIRO_GUIA} role={modules?.financeiro} userName={userName} />
    </div>
  );
}
