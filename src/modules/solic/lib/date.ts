// src/lib/date.ts

/** Converte DATE do Postgres ("YYYY-MM-DD") para "dd/mm/aaaa" sem fuso (não usa Date) */
export function formatDateBR(dateStr?: string | null) {
  if (!dateStr) return "—";

  // DATE puro (sem hora): evita bug do -1 dia por UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }

  // Se vier ISO/timestamp (created_at etc)
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}

/** Converte timestamp (ISO) para "dd/mm/aaaa HH:mm" no padrão BR */
export function formatDateTimeBR(dateStr?: string | null) {
  if (!dateStr) return "—";
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return "—";

  const date = dt.toLocaleDateString("pt-BR");
  const time = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

/** Utilitário: retorna true se uma DATE ("YYYY-MM-DD") já passou de N dias */
export function isOlderThanDays(dateStr?: string | null, days = 7) {
  if (!dateStr) return false;

  // se for DATE puro, converte para data local sem UTC:
  let dt: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    dt = new Date(y, m - 1, d, 12, 0, 0); // meio-dia local, seguro
  } else {
    dt = new Date(dateStr);
  }

  if (Number.isNaN(dt.getTime())) return false;

  const diffMs = Date.now() - dt.getTime();
  return diffMs > days * 24 * 60 * 60 * 1000;
}

/** True se a solicitação está CONCLUÍDA há mais de N dias (esconder do frontend). */
export function isOldCompleted(status?: string | null, completedAt?: string | null, days = 7) {
  if (status !== "COMPLETED" || !completedAt) return false;
  const t = new Date(completedAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > days * 24 * 60 * 60 * 1000;
}
