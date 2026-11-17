import { Outlet } from 'react-router-dom';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import { useDrawerMobile } from '../../../../hooks/useDrawerMobile';
import TiProvider from './TiProvider';
import DrawerTi from './DrawerTi';
import Sidebar from './Sidebar';
import '../../ti.css';

export default function AppShell() {
  const { aberto, alternar, fechar } = useDrawerMobile();

  return (
    <div className="tiRoot">
      <TiProvider>
        <Sidebar aberto={aberto} onFechar={fechar} />
        <div className="tiCol">
          <PortalHeader modulo="TI" onMenuToggle={alternar} />
          <main className="tiMain">
            <Outlet />
          </main>
        </div>
        {/* A ficha do ativo abre de qualquer tela (lista, pendências, termos). */}
        <DrawerTi />
      </TiProvider>
    </div>
  );
}
