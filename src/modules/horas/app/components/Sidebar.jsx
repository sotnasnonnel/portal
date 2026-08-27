import { Clock } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import ModuleSidebar from '../../../../components/Layout/ModuleSidebar';
import { ROLE_LABEL } from '../../lib/roles';
import { navSections } from './nav';

// Sidebar do Controle de Horas — estrutura no componente compartilhado
// ModuleSidebar (mesmo padrão de grupos do Financeiro).
// aberto/onFechar controlam o drawer no mobile; ver useDrawerMobile.js.
export default function Sidebar({ aberto = false, onFechar }) {
  const { logout, modules, user } = useAuth();
  const role = modules?.horas || 'usuario';

  return (
    <ModuleSidebar
      moduloKey="horas"
      titulo="Controle de Horas"
      Icon={Clock}
      secoes={navSections(role, user)}
      papelLabel={ROLE_LABEL[role]}
      aberto={aberto}
      onFechar={onFechar}
      onLogout={logout}
    />
  );
}
