import { Target } from 'lucide-react';
import ModuleSidebar from '../../../../components/Layout/ModuleSidebar';
import { useAuth } from '../../../../contexts/AuthContext';
import { podeEditarPlr, PAPEL_PLR_LABEL } from '../../../../config/plr';
import { navSections } from './nav';

// Sidebar do PLR — a estrutura vive no ModuleSidebar compartilhado, como nos
// demais módulos. aberto/onFechar controlam o drawer no mobile.
export default function Sidebar({ aberto = false, onFechar }) {
  const { modules } = useAuth();
  return (
    <ModuleSidebar
      moduloKey="plr"
      titulo="PLR"
      Icon={Target}
      secoes={navSections({ podeEditar: podeEditarPlr(modules) })}
      papelLabel={PAPEL_PLR_LABEL[modules?.plr] || ''}
      aberto={aberto}
      onFechar={onFechar}
    />
  );
}
