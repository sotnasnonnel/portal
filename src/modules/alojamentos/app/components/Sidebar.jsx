import { BedDouble } from 'lucide-react';
import ModuleSidebar from '../../../../components/Layout/ModuleSidebar';
import { navSections } from './nav';

// aberto/onFechar controlam o drawer no mobile; ver useDrawerMobile.js.
export default function Sidebar({ aberto = false, onFechar }) {
  return (
    <ModuleSidebar
      moduloKey="alojamentos"
      titulo="Alojamentos"
      Icon={BedDouble}
      secoes={navSections()}
      papelLabel="Administrativo"
      aberto={aberto}
      onFechar={onFechar}
    />
  );
}
