import { useLocation } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import ModuleSidebar from '../../../../components/Layout/ModuleSidebar';
import { ROLE_LABEL } from '../../lib/roles';
import { areaDaRota, navSections } from './nav';

// Sidebar da Gestão de Horas — estrutura no componente compartilhado
// ModuleSidebar (mesmo padrão de grupos do Financeiro).
// aberto/onFechar controlam o drawer no mobile; ver useDrawerMobile.js.
//
// O menu segue a ROTA, como no Financeiro: dentro do Apontamento aparece só o
// apontamento; dentro das Horas Extras, só as horas extras. A troca entre as
// duas é feita no card "Gestão de Horas" da Home (ver AREAS_HORAS).
export default function Sidebar({ aberto = false, onFechar }) {
  const { logout, modules, user } = useAuth();
  const role = modules?.horas || 'usuario';
  const pathname = useLocation().pathname || '';

  return (
    <ModuleSidebar
      moduloKey="horas"
      titulo="Gestão de Horas"
      Icon={Clock}
      secoes={navSections(role, user, areaDaRota(pathname))}
      papelLabel={ROLE_LABEL[role]}
      aberto={aberto}
      onFechar={onFechar}
      onLogout={logout}
    />
  );
}
