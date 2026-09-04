import { Route } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import ModuleSidebar from '../../../../components/Layout/ModuleSidebar';
import { ehTimeMobilizacao, ehAdminMobilizacao } from '../../../../config/mobilizacao';
import { navSections } from './nav';

// Sidebar da Mobilização — a estrutura (grupos colapsáveis + seções) vive no
// componente compartilhado ModuleSidebar, usado por todos os módulos.
// aberto/onFechar controlam o drawer no mobile; ver useDrawerMobile.js.
export default function Sidebar({ aberto = false, onFechar }) {
  const { modules } = useAuth();
  const isTime = ehTimeMobilizacao(modules);
  const isAdmin = ehAdminMobilizacao(modules);

  return (
    <ModuleSidebar
      moduloKey="mobilizacao"
      titulo="Mobilização"
      Icon={Route}
      secoes={navSections({ isTime, isAdmin })}
      // Quem não é do time entra para atualizar a própria etapa — o rótulo diz
      // o papel real em vez de prometer um controle que a RLS não dá.
      papelLabel={isTime ? 'Controle de mobilização' : 'Minhas etapas'}
      aberto={aberto}
      onFechar={onFechar}
    />
  );
}
