import { useAuth } from '../../contexts/AuthContext';
import logoCal from '../../assets/logo-cal.png';
import ModuleSidebar from './ModuleSidebar';
import { navSections } from './nav';

const PERFIL_LABEL = {
  admin: 'Administrador',
  gestor: 'Gestor',
  coordenador: 'Coordenador',
  usuario: 'Colaborador',
  rh: 'RH / DP',
};

// Sidebar de Gestão de Pessoas — mesma estrutura dos demais módulos, no
// componente compartilhado ModuleSidebar. O que é só daqui (contadores de
// pendência, itens em construção) vem por props/nav.js.
export default function Sidebar({
  isOpen,
  onClose,
  collapsed = false,
  onToggleCollapse,
  pendingCount = 0,
  solicitacaoCount = 0,
}) {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <ModuleSidebar
      moduloKey="dp"
      titulo="Gestão de Pessoas"
      logo={<img src={logoCal} alt="" />}
      secoes={navSections({
        perfil: user.perfil,
        user,
        pendencias: pendingCount,
        requisicoes: solicitacaoCount,
      })}
      papelLabel={PERFIL_LABEL[user.perfil]}
      aberto={isOpen}
      onFechar={onClose}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    />
  );
}
