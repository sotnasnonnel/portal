// "28 de outubro de 2026" — os avisos ficam no ar por meses, então a data vai
// por extenso em vez do "há 3 dias" do Feed.
export const dataDoAviso = (iso) => (iso
  ? new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  : '');
