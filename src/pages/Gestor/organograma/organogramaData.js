// Helpers puros da Consulta Organograma. Sem dependências de React/Supabase,
// para serem testados isoladamente com `node --test`.

/**
 * Normaliza linhas cruas de organograma_alocacao (colaborador embutido)
 * para o formato plano da tabela.
 */
export function mapAlocacoes(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    colaborador: r.colaborador?.nome ?? '',
    contrato: r.obra_cod_phd ?? '',
    gerente: r.colaborador?.gerente ?? '',
    percentual: r.percentual ?? null,
  }));
}

/** Meses distintos em ISO 'YYYY-MM-01', ordem desc. */
export function distinctMonths(rows) {
  const set = new Set();
  for (const r of rows ?? []) {
    if (r?.mes) set.add(String(r.mes).slice(0, 10));
  }
  return [...set].sort().reverse();
}

/** Mês corrente (primeiro dia) se existir; senão o mais recente. */
export function resolveDefaultMonth(months, today) {
  if (!months || months.length === 0) return null;
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const currentIso = `${y}-${m}-01`;
  if (months.includes(currentIso)) return currentIso;
  return [...months].sort().reverse()[0];
}

/** Opções distintas e ordenadas (pt-BR) para os dropdowns. */
export function deriveFilterOptions(rows) {
  const gerentes = new Set();
  const contratos = new Set();
  for (const r of rows ?? []) {
    if (r.gerente) gerentes.add(r.gerente);
    if (r.contrato) contratos.add(r.contrato);
  }
  const byPtBr = (a, b) => a.localeCompare(b, 'pt-BR');
  return {
    gerentes: [...gerentes].sort(byPtBr),
    contratos: [...contratos].sort(byPtBr),
  };
}

/** Filtra por gerente, contrato e nome (case-insensitive). '' = sem filtro. */
export function applyFilters(rows, { gerente = '', contrato = '', nome = '' } = {}) {
  const alvo = nome.trim().toLowerCase();
  return (rows ?? []).filter((r) => {
    if (gerente && r.gerente !== gerente) return false;
    if (contrato && r.contrato !== contrato) return false;
    if (alvo && !r.colaborador.toLowerCase().includes(alvo)) return false;
    return true;
  });
}

/** '—' quando null/undefined/''; senão 'N%'. */
export function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '—';
  return `${value}%`;
}

/** 'YYYY-MM-01' -> 'MM/AAAA'. */
export function formatMonthLabel(iso) {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  return `${m}/${y}`;
}

/** Nº de colaboradores distintos. */
export function countColaboradores(rows) {
  return new Set((rows ?? []).map((r) => r.colaborador)).size;
}
