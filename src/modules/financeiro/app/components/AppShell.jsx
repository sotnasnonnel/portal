import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import Sidebar from './Sidebar';
import '../../financeiro.css';

export default function AppShell() {
  const { user } = useAuth();
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
    </div>
  );
}
