import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import Sidebar from './Sidebar';
import '../../horas.css';

export default function AppShell() {
  const { user } = useAuth();
  const userName = user?.nome || (user?.email ? user.email.split('@')[0] : '');

  return (
    <div className="horasRoot">
      <Sidebar />
      <div className="horasCol">
        <PortalHeader userName={userName} />
        <main className="horasMain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
