// Exportação para Excel e CSV. `xlsx` entra por import dinâmico: pesa e só é usado
// quando alguém clica em Exportar.
import { todayISO, parseISO, isNum } from './regras';
import { colVal } from './relatorios';
import { fmtDec } from './schemas';

const excelDate = (s) => {
  const d = parseISO(s);
  if (!d) return null;
  return (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000;
};
const dataBR = (s) => {
  const d = parseISO(s);
  return d ? d.toLocaleDateString('pt-BR') : '';
};

function sheetFrom(XLSX, cols, rows, ctx) {
  const aoa = [cols.map((c) => c.l)].concat(rows.map((r) => cols.map((c) => {
    const v = colVal(r, c, ctx);
    if (v == null || v === '') return null;
    if (c.t === 'money' || c.t === 'int') return isNum(v) ? v : null;
    if (c.t === 'date') return excelDate(v);
    return String(v);
  })));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  cols.forEach((c, ci) => {
    for (let ri = 1; ri < aoa.length; ri += 1) {
      const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })];
      if (cell) {
        if (c.t === 'money') cell.z = '#,##0.00';
        else if (c.t === 'date') cell.z = 'dd/mm/yyyy';
        else if (c.t === 'int') cell.z = '#,##0';
      }
    }
  });
  ws['!cols'] = cols.map((c, ci) => ({
    wch: Math.min(50, Math.max(c.l.length + 2, ...aoa.slice(1, 300).map((r) => {
      if (r[ci] == null) return 0;
      return c.t === 'date' ? 11 : String(r[ci]).length + 1;
    }))),
  }));
  if (aoa.length > 1) {
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: cols.length - 1 } }) };
  }
  return ws;
}

// Sem isto o Excel abre o CSV em ANSI e quebra os acentos.
const BOM = String.fromCharCode(0xFEFF);

function csvFrom(cols, rows, ctx) {
  const q = (s) => {
    const t = String(s ?? '');
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const linhas = [cols.map((c) => q(c.l)).join(';')].concat(rows.map((r) => cols.map((c) => {
    const v = colVal(r, c, ctx);
    if (v == null || v === '') return '';
    if (c.t === 'money') return isNum(v) ? fmtDec.format(v) : '';
    if (c.t === 'int') return isNum(v) ? String(v) : '';
    if (c.t === 'date') return dataBR(v);
    return q(v);
  }).join(';')));
  return `${BOM}${linhas.join('\r\n')}`;
}

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Dispara o download. Sem linhas, lança erro com mensagem para a tela. */
export async function exportarLinhas({ base, cols, rows, aba, ctx, fmt = 'xlsx', resumo = null }) {
  if (!rows.length) throw new Error('Não há linhas para exportar com os filtros atuais.');
  const stamp = todayISO();
  if (fmt === 'csv') {
    baixar(new Blob([csvFrom(cols, rows, ctx)], { type: 'text/csv;charset=utf-8' }), `${base}-${stamp}.csv`);
    return;
  }
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  if (resumo) XLSX.utils.book_append_sheet(wb, sheetFrom(XLSX, resumo.cols, resumo.rows, ctx), 'Resumo');
  XLSX.utils.book_append_sheet(wb, sheetFrom(XLSX, cols, rows, ctx), String(aba).replace(/[\\/?*[\]:]/g, '-').slice(0, 31));
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  baixar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}-${stamp}.xlsx`);
}
