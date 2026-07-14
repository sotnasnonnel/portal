import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import Sidebar from './Sidebar';
import '../../horas.css';

export default function AppShell() {
  const { user, refreshHorasIdentity } = useAuth();
  const userName = user?.nome || (user?.email ? user.email.split('@')[0] : '');

  // O papel do módulo é editado em /portal-admin. Revalida ao abrir o módulo e
  // sempre que a aba volta ao foco, para uma promoção a gerente/diretoria valer
  // sem exigir logout.
  useEffect(() => {
    refreshHorasIdentity();
    const onFocus = () => refreshHorasIdentity();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshHorasIdentity]);

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
