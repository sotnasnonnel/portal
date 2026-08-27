import { Sparkles } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import ModuleSidebar from '../../../../components/Layout/ModuleSidebar';
import { ehComercial } from '../../../../config/programas';
import { navSections } from './nav';

// Sidebar dos Programas — estrutura no componente compartilhado ModuleSidebar
// (mesmo padrão de grupos do Financeiro).
// aberto/onFechar controlam o drawer no mobile; ver useDrawerMobile.js.
export default function Sidebar({ aberto = false, onFechar }) {
  const { modules } = useAuth();

  return (
    <ModuleSidebar
      moduloKey="programas"
      titulo="Programas"
      Icon={Sparkles}
      secoes={navSections({ ehComercial: ehComercial(modules) })}
      papelLabel="Programas"
      aberto={aberto}
      onFechar={onFechar}
    />
  );
}
