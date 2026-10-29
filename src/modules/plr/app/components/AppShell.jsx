import { Outlet } from 'react-router-dom';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import Sidebar from './Sidebar';
import { useDrawerMobile } from '../../../../hooks/useDrawerMobile';
import '../../plr.css';

export default function AppShell() {
  const { aberto, alternar, fechar } = useDrawerMobile();

  return (
    <div className="plrRoot">
      <Sidebar aberto={aberto} onFechar={fechar} />
      <div className="plrCol">
        <PortalHeader modulo="PLR" onMenuToggle={alternar} />
        <main className="plrMain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
