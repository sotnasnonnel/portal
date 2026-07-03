import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Rocket, PartyPopper } from "lucide-react";
import { GUIA_OPEN_EVENT } from "./guides";
import "./Guia.css";

// Guia "o que você pode fazer", compartilhado pelos 3 apps.
// Abre SÓ pelo botão "?" da barra superior (evento GUIA_OPEN_EVENT) — nunca
// sozinho no primeiro acesso. O conteúdo (passos por papel) vem por props.
//   appName, userName, role, roleLabels, contentByRole, fallbackRole
export default function GuiaModal({
  appName,
  userName,
  role,
  roleLabels = {},
  contentByRole = {},
  fallbackRole,
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const reabrir = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(GUIA_OPEN_EVENT, reabrir);
    return () => window.removeEventListener(GUIA_OPEN_EVENT, reabrir);
  }, []);

  const fechar = useCallback(() => setOpen(false), []);

  if (!open) return null;

  const primeiroNome = (userName || "").split(" ")[0];
  const roleSteps = contentByRole[role] || contentByRole[fallbackRole] || [];
  const roleLabel = roleLabels[role] || "Usuário(a)";

  const passos = [
    {
      icon: PartyPopper,
      titulo: `Olá, ${primeiroNome}! Boas-vindas 🚀`,
      texto: `Este é o app de ${appName}. Como ${roleLabel}, aqui vai um guia rápido de tudo o que você pode fazer e como. Leva menos de 1 minuto.`,
    },
    ...roleSteps,
  ];

  const total = passos.length;
  const atual = passos[step];
  const Icon = atual.icon;
  const primeiro = step === 0;
  const ultimo = step === total - 1;

  return (
    <div className="guia-overlay" onClick={fechar}>
      <div className="guia-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="guia-head">
          <span className="guia-eyebrow">Guia rápido</span>
          <button className="guia-close" onClick={fechar} aria-label="Fechar guia">
            <X size={18} />
          </button>
        </div>

        <div className="guia-body">
          <div className="guia-hero-icon">
            <Icon size={32} />
          </div>
          <h3>{atual.titulo}</h3>
          <p>{atual.texto}</p>

          <div className="guia-dots">
            {passos.map((_, i) => (
              <span key={i} className={`guia-dot ${i === step ? "active" : ""}`} />
            ))}
          </div>
        </div>

        <div className="guia-footer">
          <button className="guia-skip" onClick={fechar}>
            Fechar
          </button>
          <div className="guia-nav">
            {!primeiro && (
              <button className="guia-btn guia-btn-ghost" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft size={16} /> Voltar
              </button>
            )}
            {!ultimo ? (
              <button className="guia-btn guia-btn-primary" onClick={() => setStep((s) => s + 1)}>
                Próximo <ChevronRight size={16} />
              </button>
            ) : (
              <button className="guia-btn guia-btn-primary" onClick={fechar}>
                <Rocket size={16} /> Entendi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
