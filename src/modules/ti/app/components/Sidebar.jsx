import { useMemo } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import ModuleSidebar from '../../../../components/Layout/ModuleSidebar';
import {
  diasAtras, emailChave, pendenteTermo, pessoasSemEquipamento,
} from '../../lib/regras';
import { useTi } from './TiContext';
import { navSections } from './nav';

// Sidebar da TI — a estrutura vive no componente compartilhado ModuleSidebar.
export default function Sidebar({ aberto = false, onFechar }) {
  const { dados, podeEscrever } = useTi();
  const contagens = useMemo(() => ({
    termos: new Set(dados.ativos.filter(pendenteTermo).map((a) => emailChave(a.responsavel))).size,
    // Admitidos nos últimos 60 dias ainda sem equipamento (tela Alocar).
    alocar: podeEscrever ? pessoasSemEquipamento(dados.ativos, dados.pessoas, { desde: diasAtras(60) }).length : 0,
  }), [dados.ativos, dados.pessoas, podeEscrever]);

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
