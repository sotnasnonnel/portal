/**
 * Prazos em DIAS ÚTEIS — regra do portal, não de um módulo só.
 *
 * Contar em horas corridas fazia um chamado aberto na sexta à tarde vencer no
 * domingo, sem ninguém ter trabalhado — o indicador acusava atraso que não
 * existiu. Aqui sábado e domingo não contam.
 *
 * NÃO trata feriados: o portal não tem calendário de feriados. Um prazo que
 * cruze feriado fica mais curto do que deveria — é uma limitação conhecida, não
 * um esquecimento. Quando existir a tabela, é só filtrar aqui E no espelho
 * plpgsql `app_private.mob_dias_uteis_apos` (supabase_migration_mobilizacao.sql).
 *
 * Duas famílias de função, porque os dois módulos guardam tempo de jeitos
 * diferentes e misturá-los é como se erra fuso horário:
 *   - Date  → o Administrativo, que grava `timestamptz` e precisa da hora.
 *   - 'AAAA-MM-DD' → a Mobilização, que grava `date` e não tem hora nenhuma.
 *
 * Lógica pura para poder ser testada.
 */

const FIM_DE_SEMANA = new Set([0, 6]); // domingo e sábado

export const ehDiaUtil = (d) => !FIM_DE_SEMANA.has(d.getDay());

/** Próximo dia útil, mantendo a hora. Devolve a própria data se já for útil. */
export function proximoDiaUtil(data) {
  const d = new Date(data);
  while (!ehDiaUtil(d)) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Vencimento a partir de `inicio`, somando `dias` dias úteis e preservando a
 * hora. Começar num fim de semana empurra para a segunda antes de contar —
 * senão o primeiro dia útil seria consumido por um dia em que ninguém trabalha.
 *
 * @returns {Date|null} null quando não há prazo definido.
 */
export function venceEmDiasUteis(inicio, dias) {
  const n = Number(dias);
  if (!Number.isFinite(n) || n <= 0) return null;

  const d = proximoDiaUtil(new Date(inicio));
  for (let i = 0; i < n; i += 1) {
    d.setDate(d.getDate() + 1);
    while (!ehDiaUtil(d)) d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Conveniência para gravar no banco. */
export const venceEmISO = (inicio, dias) => {
  const d = venceEmDiasUteis(inicio, dias);
  return d ? d.toISOString() : null;
};

// ---------------------------------------------------------------------------
// Data pura ('AAAA-MM-DD') — a família da Mobilização.
//
// Nunca use `new Date('2026-08-14')` aqui: essa forma é UTC, e no nosso fuso
// vira 13/08 às 21h. `getDay()` devolveria o dia errado e um prazo de sexta
// cairia no fim de semana calado.
// ---------------------------------------------------------------------------

/** 'AAAA-MM-DD' → Date local (meio-dia, longe de qualquer borda de fuso). */
export function deIso(iso) {
  if (typeof iso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → 'AAAA-MM-DD', pelos componentes locais (nunca por toISOString). */
export function paraIso(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Espelho exato de `app_private.mob_dias_uteis_apos`.
 *
 * Diferença deliberada em relação a `venceEmDiasUteis`: aqui `dias = 0` é
 * legítimo e devolve o próprio dia (ou o próximo útil). Na Mobilização a etapa
 * raiz tem SLA zero — a data dela É a data-base, e devolver null apagaria o
 * prazo de todo o resto da cadeia.
 *
 * @returns {string|null} 'AAAA-MM-DD', ou null se a data-base não existe.
 */
export function diasUteisApos(isoDia, dias) {
  const d = deIso(isoDia);
  if (!d) return null;

  const n = Number(dias);
  const passos = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;

  while (!ehDiaUtil(d)) d.setDate(d.getDate() + 1);
  for (let i = 0; i < passos; i += 1) {
    d.setDate(d.getDate() + 1);
    while (!ehDiaUtil(d)) d.setDate(d.getDate() + 1);
  }
  return paraIso(d);
}

/** Diferença em dias corridos entre duas datas puras. Positivo = `a` depois de `b`. */
export function diasEntre(isoA, isoB) {
  const a = deIso(isoA);
  const b = deIso(isoB);
  if (!a || !b) return null;
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** Hoje como 'AAAA-MM-DD', no fuso de quem está olhando. */
export const hojeIso = (agora = new Date()) => paraIso(agora);
