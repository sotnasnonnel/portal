import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import GuiaModal from '../../../../components/Guia/GuiaModal';
import { MOBILIZACAO_GUIA } from '../../../../components/Guia/guides';
import Sidebar from './Sidebar';
import { useDrawerMobile } from '../../../../hooks/useDrawerMobile';
import '../../mobilizacao.css';

export default function AppShell() {
  const { user, modules } = useAuth();
  const userName = user?.nome || (user?.email ? user.email.split('@')[0] : '');
  const { aberto, alternar, fechar } = useDrawerMobile();

  return (
    <div className="mobRoot">
      <Sidebar aberto={aberto} onFechar={fechar} />
      <div className="mobCol">
        <PortalHeader modulo="Mobilização" onMenuToggle={alternar} />
        <main className="mobMain">
          <Outlet />
        </main>
      </div>
      {/* Guia do módulo: abre pelo "?" da barra superior. O papel vem do
          Administrativo — quem controla a mobilização é o mesmo time que
          atende o chamado que a dispara. */}
      <GuiaModal {...MOBILIZACAO_GUIA} role={modules?.administrativo} userName={userName} />
    </div>
  );
}
