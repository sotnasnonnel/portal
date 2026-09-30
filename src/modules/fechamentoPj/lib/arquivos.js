// Arquivos no navegador: abrir .xlsx, gravar .xlsx/.csv/.txt e baixar.
// SheetJS é carregado sob demanda, como no resto do portal.

export async function lerArquivoXlsx(file) {
  if (!file) throw new Error('Selecione um arquivo.');
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Envie a planilha no formato .xlsx.');
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return wb.SheetNames.map((nome) => ({
    nome,
    linhas: XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: '', blankrows: false }),
  }));
}

export function baixar(conteudo, nome, tipo) {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const FORMATO_MOEDA = '#,##0.00';
const FORMATO_PCT = '0.00%';
const FORMATO_DATA = 'dd/mm/yyyy';

/**
 * Data -> número de série do Excel (dias desde 30/12/1899), pela HORA DE
 * PAREDE local: 30/09/2026 00:00 aqui vira exatamente 46295.
 *
 * Existe porque o SheetJS 0.18 converte `Date` descontando o fuso HISTÓRICO de
 * São Paulo em 1899 (-3h06min), e a meia-noite local caía uns segundos antes:
 * 46294,9997 — o Excel mostrava o DIA ANTERIOR. Era o "data de pagamento um dia
 * antes" do Reembolso (30/09/2026). Montar o número à mão tira o fuso da conta.
 */
export function serialExcel(d) {
  const utc = Date.UTC(
    d.getFullYear(), d.getMonth(), d.getDate(),
    d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds(),
  );
  return (utc - Date.UTC(1899, 11, 30)) / 86400000;
}

const paraCelula = (v) => (v instanceof Date && !Number.isNaN(v.getTime()) ? serialExcel(v) : v);

/**
 * Grava um .xlsx a partir de abas no formato de lib/totvs.dadosConferencia:
 * { nome, titulo?, cabecalho, linhas, larguras?, moeda?, pct?, data?, moedaCelulas? }
 * Com título, a linha 1 é o título, a 2 fica em branco e o cabeçalho vai na 3.
 */
export async function gravarXlsx(abas, nomeArquivo) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  abas.forEach((aba) => {
    const topo = aba.titulo ? [[aba.titulo], []] : [];
    // Datas entram como número de série (serialExcel), não como Date. Toda
    // célula que chegou como Date ganha o formato de data — inclusive fora das
    // colunas `data` (a aba Parametros_RM mistura datas e números na mesma
    // coluna), que era o que o SheetJS fazia sozinho com cellDates.
    const datas = [];
    const linhas = aba.linhas.map((l, r) => l.map((v, c) => {
      if (v instanceof Date) datas.push([r, c]);
      return paraCelula(v);
    }));
    const ws = XLSX.utils.aoa_to_sheet([...topo, aba.cabecalho, ...linhas]);
    const inicio = topo.length + 1; // primeira linha de dados (0-based)
    datas.forEach(([r, c]) => {
      const cel = ws[XLSX.utils.encode_cell({ r: inicio + r, c })];
      if (cel?.t === 'n') cel.z = FORMATO_DATA;
    });
    const formatar = (colunas, z) => (colunas || []).forEach((c) => {
      for (let r = inicio; r < inicio + aba.linhas.length; r += 1) {
        const cel = ws[XLSX.utils.encode_cell({ r, c })];
        if (cel && (cel.t === 'n' || cel.t === 'd')) cel.z = z;
      }
    });
    formatar(aba.moeda, FORMATO_MOEDA);
    formatar(aba.pct, FORMATO_PCT);
    formatar(aba.data, FORMATO_DATA);
    (aba.moedaCelulas || []).forEach(([linha, coluna]) => {
      const cel = ws[XLSX.utils.encode_cell({ r: inicio + linha - 1, c: coluna })];
      if (cel?.t === 'n') cel.z = FORMATO_MOEDA;
    });
    if (aba.larguras) ws['!cols'] = aba.larguras.map((wch) => ({ wch }));
    if (aba.titulo) ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, aba.cabecalho.length - 1) } }];
    if (aba.linhas.length && aba.titulo && aba.nome !== 'Parametros_RM' && aba.nome !== 'Resumo') {
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: topo.length, c: 0 }, e: { r: topo.length + aba.linhas.length, c: aba.cabecalho.length - 1 } }) };
    }
    XLSX.utils.book_append_sheet(wb, ws, aba.nome.slice(0, 31));
  });
  XLSX.writeFile(wb, nomeArquivo);
}
