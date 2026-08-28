type SurveyStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "URGENT_REVIEW"
  | "SCHEDULING"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

// Tons de status compartilhados com o resto do portal (src/styles/ui.css).
// Antes o badge daqui era pintado com a cor da MARCA e ganhava borda, enquanto
// Administrativo/Financeiro/Programas usam pastel sem borda — era uma das
// coisas que faziam o PMO parecer outro sistema.
const tom = (nome: string, label: string) => ({
  label,
  bg: `var(--tone-${nome}-bg)`,
  color: `var(--tone-${nome}-fg)`,
});

function statusMeta(status: SurveyStatus) {
  switch (status) {
    case "DRAFT":
      return tom("neutro", "Rascunho");
    case "SUBMITTED":
    case "URGENT_REVIEW":
      return tom("aberto", "Aberta");

    case "SCHEDULING":
    case "SCHEDULED":
    case "IN_PROGRESS":
      return tom("andamento", "Em andamento");

    case "COMPLETED":
      return tom("ok", "Concluída");

    case "CANCELLED":
      return tom("erro", "Cancelada");

    default:
      return tom("neutro", status);
  }
}

export function StatusBadge({
  status,
  urgent,
  showUrgentText = true,
}: {
  status: string;
  urgent?: boolean | null;
  showUrgentText?: boolean;
}) {
  const m = statusMeta(status as SurveyStatus);
  const isUrgent = Boolean(urgent) || status === "URGENT_REVIEW";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "3px 9px",
        borderRadius: 999,
        background: m.bg,
        color: m.color,
        fontWeight: 700,
        fontSize: 'var(--font-size-2xs)',
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        maxWidth: "100%",
      }}
      title={isUrgent ? `${m.label} • Urgente` : m.label}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: m.color,
          flex: "0 0 auto",
        }}
      />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</span>

      {isUrgent ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span aria-label="Urgente" title="Urgente" style={{ lineHeight: 1 }}>
            🔥
          </span>

          {showUrgentText ? (
            <span
              style={{
                fontSize: 'var(--font-size-2xs)',
                fontWeight: 700,
                color: "var(--tone-erro-fg)",
                background: "var(--tone-erro-bg)",
                padding: "2px 8px",
                borderRadius: 999,
                letterSpacing: "0.03em",
              }}
            >
              URGENTE
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
