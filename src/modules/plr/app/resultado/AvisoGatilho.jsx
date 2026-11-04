import { AlertTriangle } from 'lucide-react';
import { formatarPct } from '../../lib/plr';

/**
 * O gatilho da Margem Operacional zera o fator. Sem este aviso, "0%" de fator
 * parece erro de conta. Só a gerência depende do fator: a parte da empresa na
 * conta do colaborador é fixa, então quem não vê gerência não precisa do aviso.
 */
export default function AvisoGatilho({ dados }) {
  if (!dados.gatilho || dados.gerencia.length === 0) return null;
  return (
    <p className="plr-alerta" role="status">
      <AlertTriangle size={16} aria-hidden="true" />
      <span>
        <b>Gatilho acionado.</b> A Margem Operacional Líquida está em {formatarPct(dados.margemDaMeta)} da
        meta, abaixo do corte de {formatarPct(dados.corteGatilho)}. O Fator PLR corporativo fica em zero: a
        gerência fica sem PLR. A conta dos colaboradores não muda.
      </span>
    </p>
  );
}
