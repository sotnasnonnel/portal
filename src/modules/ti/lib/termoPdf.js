// PDF do Termo de Empréstimo de Equipamentos. Carregado por import dinâmico
// (jsPDF pesa e só é usado quando alguém baixa um termo).
import { jsPDF } from 'jspdf';
import {
  TITULO_TERMO, camposIdentificacao, linhaAceite, linhasEquipamento, localEData, textoDoTermo,
} from './termoTexto';

/**
 * @param termo linha de ti_termos ({modelo, pessoa_nome, pessoa_email, cpf,
 *   data_admissao, cidade, data_termo, identificacao, ativos[], aceite_em...})
 * @returns jsPDF (quem chama decide salvar ou abrir)
 */
export function gerarTermoPdf(termo) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const larg = W - M * 2;
  let y = M;

  const cabe = (alt) => {
    if (y + alt > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const paragrafo = (txt, { size = 9, bold = false, gap = 6 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const linhas = doc.splitTextToSize(txt, larg);
    const alt = linhas.length * size * 1.3;
    cabe(alt);
    doc.text(linhas, M, y + size);
    y += alt + gap;
  };
  const campo = (rotulo, valor) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const r = `${rotulo}: `;
    doc.text(r, M, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.text(String(valor || '—'), M + doc.getTextWidth(r), y + 9);
    y += 13;
  };

  // O texto que a pessoa aceitou, não o atual do código.
  const txt = textoDoTermo(termo);
  doc.setTextColor(20, 20, 20);
  paragrafo(TITULO_TERMO, { size: 13, bold: true, gap: 12 });
  paragrafo(txt.identificacao, { size: 10, bold: true, gap: 6 });
  for (const [rotulo, valor] of camposIdentificacao(termo.modelo, termo)) campo(rotulo, valor);
  y += 6;
  paragrafo(txt.abertura, { gap: 10 });

  for (const c of txt.clausulas) {
    cabe(40);
    paragrafo(c.titulo, { size: 10, bold: true, gap: 4 });
    for (const item of c.itens) paragrafo(item, { gap: 4 });
    y += 6;
  }

  cabe(40);
  paragrafo('DESCRIÇÃO DO EQUIPAMENTO', { size: 10, bold: true, gap: 4 });
  for (const a of termo.ativos) {
    const linhas = linhasEquipamento(a);
    const blocos = linhas.map(([r, v]) => doc.splitTextToSize(`${r}: ${v}`, larg - 16));
    const alt = blocos.reduce((s, b) => s + b.length * 11.5, 0) + 14;
    cabe(alt);
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.6);
    doc.rect(M, y, larg, alt);
    let yy = y + 7;
    linhas.forEach(([r, v]) => {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      const rr = `${r}: `;
      doc.text(rr, M + 8, yy + 8.5);
      doc.setFont('helvetica', 'normal');
      const resto = doc.splitTextToSize(String(v), larg - 16 - doc.getTextWidth(rr));
      doc.text(resto, M + 8 + doc.getTextWidth(rr), yy + 8.5);
      yy += resto.length * 11.5;
    });
    y += alt + 8;
  }

  y += 4;
  paragrafo(txt.declaracao, { gap: 6 });
  const aceite = linhaAceite(termo);
  paragrafo(localEData(termo.cidade, termo.data_termo), { gap: aceite ? 12 : 50 });

  if (aceite) {
    // Aceite eletrônico: no lugar da linha de assinatura, o registro do aceite.
    paragrafo(aceite, { bold: true, gap: 4 });
    paragrafo(`${txt.assinatura}: ${termo.pessoa_nome || ''}`, { gap: 4 });
  } else {
    cabe(40);
    doc.setDrawColor(20, 20, 20);
    doc.line(M, y, M + 200, y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(txt.assinatura, M, y + 12);
    doc.text(String(termo.pessoa_nome || ''), M, y + 24);
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    doc.text(`Página ${p} de ${total}`, W - M, H - 24, { align: 'right' });
    // Impressão digital do registro: confere com ti_termo_integro(id) no banco.
    if (termo.aceite_hash) doc.text(`Registro ${termo.id} · SHA-256 ${termo.aceite_hash}`, M, H - 24, { maxWidth: larg - 70 });
  }
  return doc;
}

export function nomeArquivoTermo(termo) {
  const base = String(termo.pessoa_nome || termo.pessoa_email || 'termo')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
  return `Termo_equipamentos_${base}_${termo.data_termo || ''}.pdf`;
}
