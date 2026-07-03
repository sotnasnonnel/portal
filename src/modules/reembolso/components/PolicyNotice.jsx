import { AlertTriangle } from "lucide-react";
import { POLICY } from "../lib/reimbursementPolicy.js";
import { formatCurrency } from "../lib/format.js";
import "./PolicyNotice.css";

// Aviso com as regras de reembolso (valores de alimentação/diária e itens
// proibidos). Mostrado ao solicitante no formulário e ao gestor na aprovação.
// `compact` reduz margens para caber dentro de modais.
export default function PolicyNotice({ compact = false }) {
  return (
    <div className={`policy-notice${compact ? " policy-notice--compact" : ""}`}>
      <div className="policy-notice-head">
        <AlertTriangle size={16} aria-hidden="true" />
        <strong>Regras de reembolso</strong>
      </div>

      <div className="policy-notice-grid">
        <div className="policy-block">
          <span className="policy-block-title">Valores de alimentação</span>
          <ul>
            {POLICY.alimentacao.map((it) => (
              <li key={it.label}>
                <span>{it.label}</span>
                <strong>{formatCurrency(it.value)}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="policy-block">
          <span className="policy-block-title">Diária (alimentação + hospedagem)</span>
          <ul>
            <li>
              <span>Valor máximo</span>
              <strong>{formatCurrency(POLICY.diaria)}</strong>
            </li>
          </ul>
        </div>
      </div>

      <div className="policy-block policy-block-forbidden">
        <span className="policy-block-title">Não é permitido</span>
        <p>{POLICY.naoPermitido.join(" • ")}.</p>
      </div>
    </div>
  );
}
