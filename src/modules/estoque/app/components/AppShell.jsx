import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import Sidebar from './Sidebar';
import { useDrawerMobile } from '../../../../hooks/useDrawerMobile';
import '../../estoque.css';

export default function AppShell() {
  const { user } = useAuth();
  const userName = user?.nome || (user?.email ? user.email.split('@')[0] : '');
  const { aberto, alternar, fechar } = useDrawerMobile();

  return (
    <div className="estRoot">
      <Sidebar aberto={aberto} onFechar={fechar} />
      <div className="estCol">
        <PortalHeader userName={userName} onMenuToggle={alternar} />
        <main className="estMain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
