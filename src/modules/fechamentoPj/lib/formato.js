// Formatos do Fechamento PJ: competência, datas, dinheiro e normalização de
// texto. Tudo puro — sem React, sem Supabase — para os testes rodarem com
// node --test.
//
// Convenção de competência: no banco é `date` no dia 1 ('2026-08-01'); na tela
// é 'MM/AAAA'. As funções abaixo são as únicas que convertem entre os dois.

export const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

export const somar = (lista, campo) => round2((lista || []).reduce((s, x) => s + (Number(campo ? x?.[campo] : x) || 0), 0));

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtBRL = (v) => brl.format(Number(v) || 0);

const num2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtNum = (v) => num2.format(Number(v) || 0);
export const fmtPct = (v) => `${num2.format(Number(v) || 0)} %`;

// Nome, cabeçalho de planilha e chave de busca: sem acento, maiúsculo, espaço único.
export const normalizar = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().replace(/\s+/g, ' ').toUpperCase();

// Maiúsculo preservando acento (é assim que o nome é gravado).
export const maiusculo = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');

export const digitos = (s) => String(s ?? '').replace(/\D/g, '');

// Valor vindo de planilha ou de campo digitado: "R$ 1.234,56", "1234.56", 1234.56.
export function paraNumero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').replace(/R\$/gi, '').replace(/\s/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Competência
// ---------------------------------------------------------------------------

// 'MM/AAAA' -> '2026-08-01'. Devolve null se inválida.
export function competenciaParaIso(mmaaaa) {
  const m = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(String(mmaaaa ?? '').trim());
  return m ? `${m[2]}-${m[1]}-01` : null;
}

// '2026-08-01' (ou Date) -> '08/2026'.
export function competenciaRotulo(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[2]}/${m[1]}` : '—';
}

export function partesCompetencia(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return null;
  return { ano: Number(m[1]), mes: Number(m[2]), aaaa: m[1], mm: m[2], aa: m[1].slice(-2) };
}

export function proximaCompetencia(iso) {
  const p = partesCompetencia(iso);
  if (!p) return null;
  const mes = p.mes === 12 ? 1 : p.mes + 1;
  const ano = p.mes === 12 ? p.ano + 1 : p.ano;
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
}

export function ultimoDiaCompetencia(iso) {
  const p = partesCompetencia(iso);
  if (!p) return null;
  const dia = new Date(Date.UTC(p.ano, p.mes, 0)).getUTCDate();
  return `${p.aaaa}-${p.mm}-${String(dia).padStart(2, '0')}`;
}

export function diasNoMes(iso) {
  const p = partesCompetencia(iso);
  return p ? new Date(Date.UTC(p.ano, p.mes, 0)).getUTCDate() : 30;
}

// ---------------------------------------------------------------------------
// Datas ('AAAA-MM-DD' no banco, 'DD/MM/AAAA' na tela)
// ---------------------------------------------------------------------------

export function dataBr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

// 'DD/MM/AAAA' -> 'AAAA-MM-DD', validando dia e mês (31/02 não passa).
export function dataIso(br) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br ?? '').trim());
  if (!m) return null;
  const [d, mo, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(a, mo - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function dataHoraBr(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Serial do Excel (1900) -> 'AAAA-MM-DD'.
export function serialExcelParaIso(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 100000) return null;
  const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  return dt.toISOString().slice(0, 10);
}

// Célula de data de planilha: serial, Date, 'DD/MM/AAAA' ou 'AAAA-MM-DD'.
export function celulaParaIso(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return serialExcelParaIso(v);
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return dataIso(s);
}

export function idade(isoNascimento, hoje = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoNascimento ?? ''));
  if (!m) return null;
  let anos = hoje.getFullYear() - Number(m[1]);
  const mes = hoje.getMonth() + 1;
  if (mes < Number(m[2]) || (mes === Number(m[2]) && hoje.getDate() < Number(m[3]))) anos -= 1;
  return anos >= 0 ? anos : null;
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export function cpfValido(v) {
  const d = digitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i += 1) soma += Number(base[i]) * (base.length + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(d.slice(0, 9)) === Number(d[9]) && dv(d.slice(0, 10)) === Number(d[10]);
}

export function cnpjValido(v) {
  const d = digitos(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((s, p, i) => s + p * Number(base[i]), 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

export function mascararCnpj(v) {
  const d = digitos(v);
  if (d.length !== 14) return String(v ?? '');
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function mascararCpf(v) {
  const d = digitos(v);
  if (d.length !== 11) return String(v ?? '');
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export const CC_RM_REGEX = /^\d\.\d{3}\.\d{6}$/;

// "1004100102" ou "1004100102.0" (célula numérica) -> "1.004.100102".
export function codigoRmCentroCusto(v) {
  const s = String(v ?? '').trim().replace(/\.0+$/, '');
  if (CC_RM_REGEX.test(s)) return s;
  if (!/^\d{10}$/.test(s)) return '';
  return `${s[0]}.${s.slice(1, 4)}.${s.slice(4)}`;
}
