import { Ban } from "lucide-react";
import { detectForbiddenItems } from "../lib/reimbursementPolicy.js";
import { formatCurrency } from "../lib/format.js";
import "./ForbiddenItemsNotice.css";

// Alerta quando há itens proibidos (bebida alcoólica, cigarro, vestuário,
// brinquedo) detectados nas descrições. Não renderiza nada quando não há.
// Mostrado ao solicitante no formulário e ao gestor na aprovação.
export default function ForbiddenItemsNotice({ items }) {
  const check = detectForbiddenItems(items);
  if (!check.hasForbidden) return null;

  return (
    <div className="forbidden-notice" role="alert">
      <div className="forbidden-notice-head">
        <Ban size={16} aria-hidden="true" />
        <strong>Itens não permitidos detectados</strong>
      </div>

      <ul className="forbidden-list">
        {check.items.map((it, i) => (
          <li key={`${it.description}-${i}`}>
            <span className="forbidden-item">{it.description}</span>
            <span className="forbidden-reason">
              {it.label}
              {it.value > 0 ? ` · ${formatCurrency(it.value)}` : ""}
            </span>
          </li>
        ))}
      </ul>

      <p className="forbidden-hint">
        Estes itens não podem ser reembolsados. Remova-os do pedido ou eles devem ser
        reprovados/descontados pelo gestor.
      </p>
    </div>
  );
}
