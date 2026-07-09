// Gera o PDF de uma requisição: cabeçalho (logo + dados) + tabela de campos +
// anexo (imagem em página nova; não-imagem vira linha). Carregado por import
// dinâmico. Espelha o padrão de src/modules/reembolso/services/reembolsoPdf.js.
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import logoPhd from '../assets/logo-phd.png';
import { TIPO_LABEL } from '../config/aprovacao';
import { formatarData } from '../utils/formatters';
import { buscarRespostas, fmtResposta } from '../pages/Gestor/requisicoes/ModalRespostas';
import { STATUS_LABEL, nomeArquivoRequisicao, linhasDiretas } from './requisicaoPdfHelpers';

async function urlParaDataUrl(url) {
  const resp = await fetch(url);
  const blob = await resp.blob();
  const dataUrl = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
  return { dataUrl, type: blob.type };
}

export async function gerarRequisicaoPdf(sol, { nomeColaborador, nomeSolicitante } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  // Logo (não bloqueia se falhar)
  try {
    const { dataUrl } = await urlParaDataUrl(logoPhd);
    const props = doc.getImageProperties(dataUrl);
    const h = 32;
    const w = props.width * (h / props.height);
    doc.addImage(dataUrl, props.fileType || 'PNG', margin, 30, w, h);
  } catch { /* segue sem logo */ }

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(38, 64, 93);
  const numero = sol.numero != null ? `#${sol.numero} ` : '';
  doc.text(`Requisição ${numero}— ${TIPO_LABEL[sol.tipo] || sol.tipo}`, pageW - margin, 52, { align: 'right' });

  doc.setDrawColor(224, 224, 224);
  doc.setLineWidth(0.8);
  doc.line(margin, 78, pageW - margin, 78);

  // Cabeçalho em duas colunas
  const half = (pageW - margin * 2) / 2;
  const col1 = margin;
  const col2 = margin + half;
  const lineH = 18;
  function field(label, value, x, yy) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    const lbl = `${label}: `;
    doc.text(lbl, x, yy);
    const lw = doc.getTextWidth(lbl);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(String(value ?? '—'), x + lw, yy);
  }

  let y = 100;
  field('Colaborador', nomeColaborador || sol.colaborador?.nome || '—', col1, y);
  field('Status', STATUS_LABEL[sol.status] || sol.status || '—', col2, y);
  y += lineH;
  field('Solicitante', nomeSolicitante || sol.gestor?.nome || '—', col1, y);
  field('Data', formatarData(sol.created_at), col2, y);
  y += lineH + 8;

  // Campos
  const r = await buscarRespostas(sol); // null para os tipos diretos
  let anexoUrl = null;
  let anexoNome = null;
  let linhas;
  if (r) {
    linhas = r.campos.map((c) => [c.label, fmtResposta(c, r.dados[c.id])]);
    anexoUrl = r.anexoUrl;
    anexoNome = r.dados.anexo_nome || null;
  } else {
    linhas = linhasDiretas(sol);
  }
  if (linhas.length === 0) linhas = [['—', 'Sem campos preenchidos']];

  autoTable(doc, {
    startY: y,
    head: [['Campo', 'Resposta']],
    body: linhas,
    styles: { fontSize: 9, cellPadding: 5, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [195, 94, 30] },
    columnStyles: { 0: { cellWidth: 190, fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
  });
  y = doc.lastAutoTable.finalY + 16;

  // Anexo
  if (anexoUrl) {
    try {
      const { dataUrl, type } = await urlParaDataUrl(anexoUrl);
      if (type.startsWith('image/')) {
        doc.addPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(38, 64, 93);
        doc.text(`Anexo: ${anexoNome || ''}`, margin, 40);
        const props = doc.getImageProperties(dataUrl);
        const maxW = pageW - margin * 2;
        const maxH = pageH - 70 - margin;
        const ratio = Math.min(maxW / props.width, maxH / props.height);
        const w = props.width * ratio;
        const h = props.height * ratio;
        doc.addImage(dataUrl, props.fileType || 'JPEG', margin + (maxW - w) / 2, 55, w, h);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text(`Anexo: ${anexoNome || 'arquivo'}`, margin, y);
      }
    } catch { /* ignora anexo que não carregou */ }
  }

  doc.save(nomeArquivoRequisicao(sol, nomeColaborador || sol.colaborador?.nome));
}
