import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import PortalHeader from '../../../../components/PortalHeader/PortalHeader';
import GuiaModal from '../../../../components/Guia/GuiaModal';
import { ADMINISTRATIVO_GUIA } from '../../../../components/Guia/guides';
import Sidebar from './Sidebar';
import AjudaPrazos from './AjudaPrazos';
import { useDrawerMobile } from '../../../../hooks/useDrawerMobile';
import '../../administrativo.css';

export default function AppShell() {
  const { user, modules } = useAuth();
  const userName = user?.nome || (user?.email ? user.email.split('@')[0] : '');
  const { aberto, alternar, fechar } = useDrawerMobile();

  return (
    <div className="admRoot">
      <Sidebar aberto={aberto} onFechar={fechar} />
      <div className="admCol">
        {/* Dois botões na barra: o "?" abre o guia do módulo, o relógio explica
            os prazos. Separados porque são dúvidas diferentes. */}
        <PortalHeader userName={userName} onMenuToggle={alternar} acoes={<AjudaPrazos />} />
        <main className="admMain">
          <Outlet />
        </main>
      </div>
      {/* Guia do módulo: abre pelo "?" da barra superior. O conteúdo muda com o
          papel — solicitante, atendente ou admin do Adm. */}
      <GuiaModal {...ADMINISTRATIVO_GUIA} role={modules?.administrativo} userName={userName} />
    </div>
  );
}
