import { Headset } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import ModuleSidebar from '../../../../components/Layout/ModuleSidebar';
import { podeVerTorre } from '../../../../config/torre';
import { navSections } from './nav';

// Sidebar do Administrativo — estrutura no componente compartilhado
// ModuleSidebar (mesmo padrão de grupos do Financeiro).
// aberto/onFechar controlam o drawer no mobile; ver useDrawerMobile.js.
export default function Sidebar({ aberto = false, onFechar }) {
  const { user, modules } = useAuth();

  return (
    <ModuleSidebar
      moduloKey="administrativo"
      titulo="Administrativo"
      Icon={Headset}
      secoes={navSections({
        isAdmin: modules?.administrativo === 'admin',
        podeTorre: podeVerTorre(user, modules),
      })}
      papelLabel="Administrativo"
      aberto={aberto}
      onFechar={onFechar}
    />
  );
}
