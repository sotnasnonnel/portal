import { startOfDay } from './format';

// Utilitários de agregação para os dashboards. Puros (sem I/O), fáceis de testar.

export function somaMs(list) {
  return list.reduce((s, a) => s + (a.duracao || 0), 0);
}

// Converte ms -> horas SEM perder registros curtos. Arredondar para 2 casas
// zeraria um apontamento de 10s (0,00277h) e o gráfico não mostraria nada.
const emHoras = (ms) => Math.round((ms / 3600000) * 1e6) / 1e6;

// Agrupa por chave (função) somando duração; retorna array recharts-friendly,
// ordenado por duração desc. `ms` é a fonte de verdade (usada nos tooltips).
export function agruparHoras(list, keyFn) {
  const m = new Map();
  for (const a of list) {
    const k = keyFn(a) || '—';
    m.set(k, (m.get(k) || 0) + (a.duracao || 0));
  }
  return [...m.entries()]
    .map(([name, ms]) => ({ name, ms, horas: emHoras(ms) }))
    .sort((x, y) => y.ms - x.ms);
}

// Série diária dos últimos `dias` dias: [{ name: 'dd/mm', horas, ms, dayStart }]
export function serieDiaria(list, dias = 14, agora = Date.now()) {
  const out = [];
  for (let i = dias - 1; i >= 0; i--) {
    const dayStart = startOfDay(agora - i * 86400000);
    const dayEnd = dayStart + 86400000;
    const ms = list
      .filter((a) => a.inicio >= dayStart && a.inicio < dayEnd)
      .reduce((s, a) => s + (a.duracao || 0), 0);
    out.push({
      dayStart,
      name: new Date(dayStart).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      ms,
      horas: emHoras(ms),
    });
  }
  return out;
}

// Paleta da marca (mesma do protótipo) para os gráficos categóricos.
export const PALETTE = [
  '#C44A28',
  '#26405d',
  '#00a49a',
  '#b85236',
  '#F59E0B',
  '#9a3412',
  '#64748b',
  '#f8c0a0',
  '#10B981',
  '#0f172a',
];
