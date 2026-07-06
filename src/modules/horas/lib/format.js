// Utilidades de tempo/formatação do módulo de Controle de Horas.
// Portadas do protótipo (referencia/controle-horas.html), sem dependências.

export function fmtDur(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return [h, m, x].map((n) => String(n).padStart(2, '0')).join(':');
}

export function fmtHoras(ms) {
  return (ms / 3600000).toFixed(1).replace('.', ',') + 'h';
}

export function fmtData(ts) {
  const d = new Date(ts);
  return (
    d.toLocaleDateString('pt-BR') +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
}

export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfWeek(ts) {
  const d = new Date(ts);
  const dia = (d.getDay() + 6) % 7; // segunda como início
  d.setHours(0, 0, 0, 0);
  return d.getTime() - dia * 86400000;
}

export function startOfMonth(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

// value para <input type="datetime-local"> a partir de um Date/ts (hora local).
export function toDatetimeLocal(ts) {
  const d = new Date(ts);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// yyyy-mm-dd (hora local) para <input type="date">.
export function toDateInput(ts) {
  const d = new Date(ts);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Intervalo padrão: últimos `dias` dias (limita o payload das consultas).
export function periodoPadrao(dias = 30, agora = Date.now()) {
  return { de: toDateInput(agora - (dias - 1) * 86400000), ate: toDateInput(agora) };
}

// Converte {de, ate} (yyyy-mm-dd) em timestamps para consulta (fim inclusivo).
export function intervaloTs({ de, ate }) {
  return {
    sinceTs: de ? new Date(de).getTime() : null,
    ateTs: ate ? new Date(ate).getTime() + 86400000 : null,
  };
}
