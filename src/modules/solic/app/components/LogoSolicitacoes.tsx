import { BarChart3 } from "lucide-react";
import "./LogoSolicitacoes.css";

// Marca do módulo: tile teal com ícone de gráfico + wordmark "PHD Solicitações".
// Mesmo padrão do LogoReembolso (componente, não PNG): herda a fonte, fica
// nítido em qualquer densidade e pode ser reusado em outros contextos.
export default function LogoSolicitacoes({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? 20 : 26;
  return (
    <div
      className={`logo-solicitacoes logo-solicitacoes--${size} ${className}`.trim()}
      role="img"
      aria-label="PHD Solicitações"
    >
      <span className="logo-solicitacoes-mark" aria-hidden="true">
        <BarChart3 size={iconSize} strokeWidth={2.2} />
      </span>
      <span className="logo-solicitacoes-word">
        <strong>PHD</strong>
        <span>Solicitações</span>
      </span>
    </div>
  );
}
