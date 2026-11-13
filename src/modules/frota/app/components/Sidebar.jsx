import { useMemo } from 'react';
import { Car } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import ModuleSidebar from '../../../../components/Layout/ModuleSidebar';
import { ehAdminSetorAdm, ehTimeSetorAdm } from '../../../../config/setorAdm';
import { contagensNav } from '../../lib/regras';
import { fatVencida } from '../../lib/faturas';
import { useFrota } from './FrotaContext';
import { navSections } from './nav';

// Sidebar da Frota — a estrutura vive no componente compartilhado ModuleSidebar.
export default function Sidebar({ aberto = false, onFechar }) {
  const { user, modules } = useAuth();
  const { dados, cfg } = useFrota();
  const isAdmin = ehAdminSetorAdm(modules, user);
  const contagens = useMemo(() => ({
    ...contagensNav(dados, cfg),
    faturas: dados.faturas.filter(fatVencida).length,
  }), [dados, cfg]);

  return (
    <ModuleSidebar
      moduloKey="frota"
      titulo="Frota"
      Icon={Car}
      secoes={navSections({ isAdmin, contagens })}
      papelLabel={ehTimeSetorAdm(user) ? 'Gestão da frota' : 'Sem acesso aos dados'}
      aberto={aberto}
      onFechar={onFechar}
    />
  );
}
