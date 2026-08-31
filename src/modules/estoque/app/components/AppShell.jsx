import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import GuiaModal from '../../../../components/Guia/GuiaModal';
import { ESTOQUE_GUIA } from '../../../../components/Guia/guides';
import Sidebar from './Sidebar';
import { useDrawerMobile } from '../../../../hooks/useDrawerMobile';
import '../../estoque.css';

export default function AppShell() {
  const { user, modules } = useAuth();
  const userName = user?.nome || (user?.email ? user.email.split('@')[0] : '');
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
      {/* Guia do módulo: abre pelo "?" da barra superior. O papel vem do
          Administrativo — quem atende o chamado de EPI é quem entrega o EPI. */}
      <GuiaModal {...ESTOQUE_GUIA} role={modules?.administrativo} userName={userName} />
    </div>
  );
}
