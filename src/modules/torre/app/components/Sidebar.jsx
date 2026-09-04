import { Radar } from 'lucide-react';
import ModuleSidebar from '../../../../components/Layout/ModuleSidebar';
import { navSections } from './nav';

// Sidebar da Torre — a estrutura vive no ModuleSidebar compartilhado, como nos
// demais módulos. aberto/onFechar controlam o drawer no mobile.
export default function Sidebar({ aberto = false, onFechar }) {
  return (
    <ModuleSidebar
      moduloKey="torre"
      titulo="Torre de Controle"
      Icon={Radar}
      secoes={navSections()}
      // Todo mundo aqui só consulta — não há papel a distinguir.
      papelLabel="Consulta"
      aberto={aberto}
      onFechar={onFechar}
    />
  );
}
