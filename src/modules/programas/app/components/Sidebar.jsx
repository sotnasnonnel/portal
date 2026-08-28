import { useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import ModuleSidebar from '../../../../components/Layout/ModuleSidebar';
import { ehAdminProgramas, ehComercial } from '../../../../config/programas';
import { navSections, programaDaRota } from './nav';

// Sidebar dos Programas — estrutura no componente compartilhado ModuleSidebar
// (mesmo padrão de grupos do Financeiro).
// aberto/onFechar controlam o drawer no mobile; ver useDrawerMobile.js.
//
// O menu segue a ROTA: dentro do Campo de Ideias só aparece o Campo de Ideias,
// dentro da Alavanca só a Alavanca. Trocar de programa é decisão que se toma
// no card "Programas" da Home, não no meio do menu.
export default function Sidebar({ aberto = false, onFechar }) {
  const { modules } = useAuth();
  const pathname = useLocation().pathname || '';

  return (
    <ModuleSidebar
      moduloKey="programas"
      titulo="Programas"
      Icon={Sparkles}
      secoes={navSections({
        ehComercial: ehComercial(modules),
        ehAdmin: ehAdminProgramas(modules),
        programa: programaDaRota(pathname),
      })}
      papelLabel="Programas"
      aberto={aberto}
      onFechar={onFechar}
    />
  );
}
