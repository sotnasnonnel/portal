import { useMemo } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import ModuleSidebar from '../../../../components/Layout/ModuleSidebar';
import { emailChave, pendenteTermo } from '../../lib/regras';
import { useTi } from './TiContext';
import { navSections } from './nav';

// Sidebar da TI — a estrutura vive no componente compartilhado ModuleSidebar.
export default function Sidebar({ aberto = false, onFechar }) {
  const { dados, podeEscrever } = useTi();
  const contagens = useMemo(() => ({
    termos: new Set(dados.ativos.filter(pendenteTermo).map((a) => emailChave(a.responsavel))).size,
  }), [dados.ativos]);

  return (
    <ModuleSidebar
      moduloKey="ti"
      titulo="TI"
      Icon={MonitorSmartphone}
      secoes={navSections({ contagens, podeEscrever })}
      papelLabel={podeEscrever ? 'Time de TI' : 'Você e sua equipe'}
      aberto={aberto}
      onFechar={onFechar}
    />
  );
}
