import { Outlet } from 'react-router-dom';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import GuiaModal from '../../../../components/Guia/GuiaModal';
import { TORRE_GUIA } from '../../../../components/Guia/guides';
import { useAuth } from '../../../../contexts/AuthContext';
import Sidebar from './Sidebar';
import { useDrawerMobile } from '../../../../hooks/useDrawerMobile';
// A folha da Mobilização vem primeiro: torre.css só redeclara o acento por
// token, então precisa vir depois para vencer.
import '../../../mobilizacao/mobilizacao.css';
import '../../torre.css';

export default function AppShell() {
  const { user } = useAuth();
  const userName = user?.nome || (user?.email ? user.email.split('@')[0] : '');
  const { aberto, alternar, fechar } = useDrawerMobile();

  return (
    <div className="mobRoot torRoot">
      <Sidebar aberto={aberto} onFechar={fechar} />
      <div className="mobCol">
        <PortalHeader modulo="Torre de Controle" onMenuToggle={alternar} />
        <main className="mobMain">
          <Outlet />
        </main>
      </div>
      <GuiaModal {...TORRE_GUIA} userName={userName} />
    </div>
  );
}
