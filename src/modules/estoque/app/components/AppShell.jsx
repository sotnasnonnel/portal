import { Outlet } from 'react-router-dom';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import Sidebar from './Sidebar';
import { useDrawerMobile } from '../../../../hooks/useDrawerMobile';
import '../../estoque.css';

export default function AppShell() {
  const { aberto, alternar, fechar } = useDrawerMobile();

  return (
    <div className="estRoot">
      <Sidebar aberto={aberto} onFechar={fechar} />
      <div className="estCol">
        {/* `modulo` (e não o nome do usuário): o topo da sidebar é a marca da
            PHD, então é a barra superior que diz onde a pessoa está. */}
        <PortalHeader modulo="Estoque" onMenuToggle={alternar} />
        <main className="estMain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
