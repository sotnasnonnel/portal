import { Receipt } from "lucide-react";
import "./LogoReembolso.css";

// Marca do app: tile terracotta com ícone de nota + wordmark "PHD Reembolso".
// É um componente (não um PNG) para herdar a fonte da página, ficar nítido em
// qualquer densidade de tela e poder ser reaproveitado (login, sidebar, etc.).
export default function LogoReembolso({ className = "", size = "md" }) {
  const iconSize = size === "sm" ? 20 : 26;
  return (
    <div
      className={`logo-reembolso logo-reembolso--${size} ${className}`.trim()}
      role="img"
      aria-label="PHD Reembolso"
    >
      <span className="logo-reembolso-mark" aria-hidden="true">
        <Receipt size={iconSize} strokeWidth={2.2} />
      </span>
      <span className="logo-reembolso-word">
        <strong>PHD</strong>
        <span>Reembolso</span>
      </span>
    </div>
  );
}
