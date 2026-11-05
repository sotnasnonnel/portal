import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import GuiaModal from '../../../../components/Guia/GuiaModal';
import { FROTA_GUIA } from '../../../../components/Guia/guides';
import { ehAdminSetorAdm } from '../../../../config/setorAdm';
import { useDrawerMobile } from '../../../../hooks/useDrawerMobile';
import FrotaProvider from './FrotaProvider';
import DrawerFrota from './DrawerFrota';
import Sidebar from './Sidebar';
import '../../frota.css';

export default function AppShell() {
  const { user, modules } = useAuth();
  const userName = user?.nome || (user?.email ? user.email.split('@')[0] : '');
  const { aberto, alternar, fechar } = useDrawerMobile();

  return (
    <div className="frotaRoot">
      <FrotaProvider>
        <Sidebar aberto={aberto} onFechar={fechar} />
        <div className="frotaCol">
          <PortalHeader modulo="Frota" onMenuToggle={alternar} />
          <main className="frotaMain">
            <Outlet />
          </main>
        </div>
        {/* O detalhe abre de qualquer tela e leva de um registro a outro (veículo
            -> lançamento -> ocorrência), por isso mora na casca e não na página. */}
        <DrawerFrota />
      </FrotaProvider>
      <GuiaModal {...FROTA_GUIA} role={ehAdminSetorAdm(modules, user) ? 'admin' : modules?.administrativo} userName={userName} />
    </div>
  );
}
