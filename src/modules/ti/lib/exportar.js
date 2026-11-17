// Exportação da lista de ativos para Excel, com as colunas da planilha original.
// `xlsx` entra por import dinâmico: pesa e só é usado quando alguém clica.
import { CAMPOS_ATIVO } from './campos';
import { todayISO } from './regras';

export async function exportarAtivos(ativos, nomeDe) {
  const XLSX = await import('xlsx');
  const cab = [...CAMPOS_ATIVO.map((c) => c.l), 'Nome do responsável'];
  const linhas = ativos.map((a) => [
    ...CAMPOS_ATIVO.map((c) => {
      const v = a[c.k];
      if (v == null || v === '') return null;
      if (c.t === 'money') return Number(v);
      if (c.t === 'date') {
        const [y, m, d] = String(v).slice(0, 10).split('-');
        return `${d}/${m}/${y}`;
      }
      return String(v);
    }),
    a.responsavel && nomeDe(a.responsavel) !== a.responsavel ? nomeDe(a.responsavel) : null,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([cab, ...linhas]);
  ws['!cols'] = cab.map((c) => ({ wch: Math.max(12, Math.min(40, c.length + 4)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Controle de ativos');
  XLSX.writeFile(wb, `ti-ativos-${todayISO()}.xlsx`);
}
