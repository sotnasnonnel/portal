import { Boxes } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import ModuleSidebar from '../../../../components/Layout/ModuleSidebar';
import { ehOperadorEstoque } from '../../../../config/estoque';
import { navSections } from './nav';

// Sidebar do Estoque — a estrutura (grupos colapsáveis + seções) vive no
// componente compartilhado ModuleSidebar, usado por todos os módulos.
// aberto/onFechar controlam o drawer no mobile; ver useDrawerMobile.js.
export default function Sidebar({ aberto = false, onFechar }) {
  const { modules } = useAuth();
  const operador = ehOperadorEstoque(modules);

  return (
    <ModuleSidebar
      moduloKey="estoque"
      titulo="Estoque"
      Icon={Boxes}
      secoes={navSections({ operador })}
      // Quem só consulta não é do almoxarifado — o rótulo diz o papel real.
      papelLabel={operador ? 'Almoxarifado' : 'Estoque (consulta)'}
      aberto={aberto}
      onFechar={onFechar}
    />
  );
}
