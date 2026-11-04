import { AlertTriangle } from 'lucide-react';
import { formatarPct } from '../../lib/plr';

/**
 * O gatilho da Margem Operacional zera o fator. Sem este aviso, "0%" de fator
 * parece erro de conta. A conta segue a regra pedida: o colaborador continua com
 * a parte do setor, e a gerência fica como no HUB.
 */
export default function AvisoGatilho({ dados }) {
  if (!dados.gatilho) return null;
  return (
    <p className="plr-alerta" role="status">
      <AlertTriangle size={16} aria-hidden="true" />
      <span>
        <b>Gatilho acionado.</b> A Margem Operacional Líquida está em {formatarPct(dados.margemDaMeta)} da
        meta, abaixo do corte de {formatarPct(dados.corteGatilho)}. O Fator PLR corporativo fica em zero: a
        gerência fica sem PLR, e o colaborador fica só com a parte do setor.
      </span>
    </p>
  );
}
