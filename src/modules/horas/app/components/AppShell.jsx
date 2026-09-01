import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import GuiaModal from '../../../../components/Guia/GuiaModal';
import { HORAS_GUIA } from '../../../../components/Guia/guides';
import Sidebar from './Sidebar';
import { useDrawerMobile } from '../../../../hooks/useDrawerMobile';
import '../../horas.css';

export default function AppShell() {
  const { user, modules, refreshHorasIdentity } = useAuth();
  const userName = user?.nome || (user?.email ? user.email.split('@')[0] : '');
  const { aberto, alternar, fechar } = useDrawerMobile();

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
      <Sidebar aberto={aberto} onFechar={fechar} />
      <div className="horasCol">
        <PortalHeader modulo="Gestão de Horas" onMenuToggle={alternar} />
        <main className="horasMain">
          <Outlet />
        </main>
      </div>
      <GuiaModal {...HORAS_GUIA} role={modules?.horas} userName={userName} />
    </div>
  );
}
