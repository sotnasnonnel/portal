import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import GuiaModal from '../../../../components/Guia/GuiaModal';
import { FINANCEIRO_GUIA } from '../../../../components/Guia/guides';
import Sidebar from './Sidebar';
import ConsultaTermos from './ConsultaTermos';
import { useDrawerMobile } from '../../../../hooks/useDrawerMobile';
import '../../financeiro.css';

export default function AppShell() {
  const { user, modules } = useAuth();
  const userName = user?.nome || (user?.email ? user.email.split('@')[0] : '');
  const { aberto, alternar, fechar } = useDrawerMobile();

  return (
    <div className="finRoot">
      <Sidebar aberto={aberto} onFechar={fechar} />
      <div className="finCol">
        <PortalHeader userName={userName} onMenuToggle={alternar} acoes={<ConsultaTermos />} />
        <main className="finMain">
          <Outlet />
        </main>
      </div>
      <GuiaModal {...FINANCEIRO_GUIA} role={modules?.financeiro} userName={userName} />
    </div>
  );
}
