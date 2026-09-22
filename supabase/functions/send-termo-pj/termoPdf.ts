// Termo de medição em PDF, para ir anexado ao e-mail do prestador.
//
// O conteúdo é o MESMO do termo da tela (DocumentoTermo em Termo.jsx) e do
// corpo do e-mail: total compensado, sem a abertura dos descontos. Se um dia
// o texto mudar em um lugar, tem que mudar nos três.
//
// Desenhado com pdf-lib: a Edge Function não tem navegador para imprimir HTML.
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 48;
const LARGURA_TEXTO = A4.largura - MARGEM * 2;

const AZUL = rgb(0.149, 0.251, 0.365); // #26405d
const TEXTO = rgb(0.106, 0.153, 0.208); // #1b2735
const CINZA = rgb(0.42, 0.447, 0.502); // #6b7280
const BORDA = rgb(0.933, 0.941, 0.953); // #eef0f3
const LARANJA = rgb(0.91, 0.506, 0.29); // #e8814a
const AVISO_FUNDO = rgb(1, 0.969, 0.925); // #fff7ed
const AVISO_BORDA = rgb(0.996, 0.843, 0.667); // #fed7aa
const AVISO_TITULO = rgb(0.604, 0.204, 0.071); // #9a3412

// A fonte padrão do PDF é WinAnsi: acentos passam, mas alguns sinais que o
// termo usa (travessão, reticências, espaço fixo) precisam de tradução.
const TROCAS: Array<[RegExp, string]> = [
  [/[\u2018\u2019]/g, "'"],
  [/[\u201C\u201D]/g, '"'],
  [/\u2026/g, "..."],
  [/\u2022/g, "-"],
  [/[\u2012\u2013\u2014]/g, "-"],
  [/\u00A0/g, " "],
];
function winAnsi(s: unknown): string {
  let t = String(s ?? "");
  for (const [re, sub] of TROCAS) t = t.replace(re, sub);
  // Qualquer coisa fora do Latin-1 (emoji, símbolo solto) vira espaço.
  return t.replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
}

type Pedaco = { t: string; b?: boolean; cor?: ReturnType<typeof rgb> };

/** Cursor de escrita com quebra de página automática. */
class Folha {
  doc: PDFDocument;
  pagina: PDFPage;
  y: number;
  normal: PDFFont;
  negrito: PDFFont;
  italico: PDFFont;

  constructor(doc: PDFDocument, normal: PDFFont, negrito: PDFFont, italico: PDFFont) {
    this.doc = doc;
    this.normal = normal;
    this.negrito = negrito;
    this.italico = italico;
    this.pagina = doc.addPage([A4.largura, A4.altura]);
    this.y = A4.altura - MARGEM;
  }

  espaco(h: number) {
    this.y -= h;
  }

  /** Garante altura livre; se não couber, abre outra página. */
  cabe(altura: number) {
    if (this.y - altura >= MARGEM) return;
    this.pagina = this.doc.addPage([A4.largura, A4.altura]);
    this.y = A4.altura - MARGEM;
  }

  fonte(p: Pedaco) {
    return p.b ? this.negrito : this.normal;
  }

  /** Quebra pedaços (com negrito no meio) em linhas de no máximo `largura`. */
  private linhas(pedacos: Pedaco[], tamanho: number, largura: number) {
    const linhas: Pedaco[][] = [[]];
    let usado = 0;
    for (const pedaco of pedacos) {
      const palavras = winAnsi(pedaco.t).split(/(\s+)/).filter((p) => p !== "");
      for (const palavra of palavras) {
        const fonte = this.fonte(pedaco);
        const w = fonte.widthOfTextAtSize(palavra, tamanho);
        const atual = linhas[linhas.length - 1];
        if (usado + w > largura && palavra.trim() !== "") {
          linhas.push([{ ...pedaco, t: palavra }]);
          usado = w;
        } else {
          if (!atual.length && palavra.trim() === "") continue;
          atual.push({ ...pedaco, t: palavra });
          usado += w;
        }
      }
    }
    return linhas;
  }

  /** Parágrafo com trechos em negrito. Devolve a altura usada. */
  texto(pedacos: Pedaco[], opcoes: { tamanho?: number; altura?: number; x?: number; largura?: number; cor?: ReturnType<typeof rgb> } = {}) {
    const tamanho = opcoes.tamanho ?? 10;
    const alturaLinha = opcoes.altura ?? tamanho * 1.5;
    const x0 = opcoes.x ?? MARGEM;
    const largura = opcoes.largura ?? LARGURA_TEXTO;
    const linhas = this.linhas(pedacos, tamanho, largura);
    for (const linha of linhas) {
      this.cabe(alturaLinha);
      let x = x0;
      for (const pedaco of linha) {
        const fonte = this.fonte(pedaco);
        this.pagina.drawText(pedaco.t, { x, y: this.y - tamanho, size: tamanho, font: fonte, color: pedaco.cor ?? opcoes.cor ?? TEXTO });
        x += fonte.widthOfTextAtSize(pedaco.t, tamanho);
      }
      this.y -= alturaLinha;
    }
  }

  titulo(t: string, tamanho = 13) {
    this.cabe(tamanho * 1.8);
    this.pagina.drawText(winAnsi(t), { x: MARGEM, y: this.y - tamanho, size: tamanho, font: this.negrito, color: AZUL });
    this.y -= tamanho * 1.8;
  }

  /** Linha da tabela "rótulo → valor", com o traço embaixo. */
  linhaTabela(rotulo: string, valor: string, negrito = false) {
    const tamanho = 10;
    const larguraRotulo = 150;
    const larguraValor = LARGURA_TEXTO - larguraRotulo - 12;
    const linhasValor = this.linhas([{ t: valor, b: negrito }], tamanho, larguraValor);
    const altura = Math.max(1, linhasValor.length) * tamanho * 1.45 + 8;
    this.cabe(altura);
    const topo = this.y;
    this.pagina.drawText(winAnsi(rotulo), { x: MARGEM, y: topo - tamanho, size: tamanho, font: this.normal, color: CINZA });
    let y = topo;
    for (const linha of linhasValor) {
      let x = MARGEM + larguraRotulo;
      for (const pedaco of linha) {
        const fonte = this.fonte(pedaco);
        this.pagina.drawText(pedaco.t, { x, y: y - tamanho, size: tamanho, font: fonte, color: TEXTO });
        x += fonte.widthOfTextAtSize(pedaco.t, tamanho);
      }
      y -= tamanho * 1.45;
    }
    this.y = topo - altura;
    this.pagina.drawLine({
      start: { x: MARGEM, y: this.y + 4 },
      end: { x: MARGEM + LARGURA_TEXTO, y: this.y + 4 },
      thickness: 0.6,
      color: BORDA,
    });
  }
}

export type DadosTermo = {
  pessoa: { codigo: string; nome: string; razaoSocial: string; cnpj: string };
  competenciaRotulo: string;
  descontos: number;
  brutoTexto: string;
  liquidoTexto: string;
  descontosTexto: string;
  tomador: { razao: string; cnpj: string };
  enderecoTomador: string;
  emailFinanceiro: string;
  prazos: { envioTermos: string; prazoNf: string; pagamento: string };
  logoPng?: Uint8Array | null;
};

export async function montarPdfTermo(d: DadosTermo): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Termo de medição ${d.competenciaRotulo} - ${d.pessoa.nome}`);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const italico = await doc.embedFont(StandardFonts.HelveticaOblique);
  const f = new Folha(doc, normal, negrito, italico);

  // Faixa do topo: competência à esquerda, logo à direita.
  const alturaFaixa = 44;
  f.pagina.drawRectangle({ x: 0, y: A4.altura - alturaFaixa, width: A4.largura, height: alturaFaixa, color: AZUL });
  f.pagina.drawText(winAnsi(`Competência ${d.competenciaRotulo}`), {
    x: MARGEM, y: A4.altura - 28, size: 12, font: negrito, color: rgb(1, 1, 1),
  });
  f.pagina.drawText(winAnsi(`Código ${d.pessoa.codigo}`), {
    x: MARGEM, y: A4.altura - 40, size: 8, font: normal, color: rgb(0.85, 0.89, 0.94),
  });
  if (d.logoPng?.length) {
    try {
      const img = await doc.embedPng(d.logoPng);
      const alturaLogo = 20;
      const larguraLogo = (img.width / img.height) * alturaLogo;
      f.pagina.drawImage(img, {
        x: A4.largura - MARGEM - larguraLogo, y: A4.altura - alturaFaixa / 2 - alturaLogo / 2,
        width: larguraLogo, height: alturaLogo,
      });
    } catch {
      // Logo é enfeite: PDF sem ela é melhor que e-mail sem anexo.
    }
  }
  f.y = A4.altura - alturaFaixa - 30;

  f.titulo("TERMO DE MEDIÇÃO E AUTORIZAÇÃO DE FATURAMENTO", 13);
  f.texto([{ t: "À " }, { t: d.pessoa.razaoSocial || d.pessoa.nome, b: true }]);
  f.texto([{ t: "CNPJ: " }, { t: d.pessoa.cnpj || "não cadastrado", b: true }]);
  f.espaco(8);
  f.texto([
    { t: `Informamos que a medição dos serviços prestados no mês ` },
    { t: d.competenciaRotulo, b: true },
    { t: " foi concluída. Fica autorizada a emissão da Nota Fiscal no valor líquido de " },
    { t: d.liquidoTexto, b: true },
    { t: "." },
  ]);
  f.espaco(10);

  f.titulo("Dados para emissão da Nota Fiscal", 11);
  f.linhaTabela("Tomador do serviço", d.tomador.razao);
  f.linhaTabela("CNPJ do tomador", d.tomador.cnpj);
  f.linhaTabela("Endereço", d.enderecoTomador);
  f.linhaTabela("Descrição do serviço", "Atentar-se para o escopo contratual.");
  f.linhaTabela("Valor bruto", d.brutoTexto);
  f.linhaTabela("Valor líquido da NF", d.liquidoTexto, true);
  f.espaco(12);

  // Só o total compensado: a abertura dos descontos não vai para o prestador.
  if (d.descontos > 0) {
    f.texto([
      { t: "Já se encontra compensado no valor líquido acima o valor total de " },
      { t: d.descontosTexto, b: true },
      { t: "." },
    ]);
    f.espaco(6);
  }

  f.texto([
    { t: "Consulte a situação do seu pagamento em " },
    { t: "consulta.phdengenharia.tech", b: true },
    { t: " (informe o CNPJ)." },
  ]);
  f.texto([
    { t: "A Nota Fiscal deve ser enviada para " },
    { t: d.emailFinanceiro || "o Financeiro", b: true },
    { t: "." },
  ]);
  f.espaco(14);

  // Caixa "Atenção aos prazos".
  const alturaCaixa = 92;
  f.cabe(alturaCaixa + 10);
  const topoCaixa = f.y;
  f.pagina.drawRectangle({
    x: MARGEM, y: topoCaixa - alturaCaixa, width: LARGURA_TEXTO, height: alturaCaixa,
    color: AVISO_FUNDO, borderColor: AVISO_BORDA, borderWidth: 1,
  });
  f.y = topoCaixa - 14;
  const recuo = { x: MARGEM + 14, largura: LARGURA_TEXTO - 28 };
  f.texto([{ t: "Atenção aos prazos", b: true, cor: AVISO_TITULO }], { ...recuo, tamanho: 10 });
  f.texto([{ t: "- Envio dos termos: " }, { t: d.prazos.envioTermos, b: true }], { ...recuo, tamanho: 9.5 });
  f.texto([{ t: "- Prazo para emissão e envio da NF: " }, { t: d.prazos.prazoNf, b: true }], { ...recuo, tamanho: 9.5 });
  f.texto([{ t: "- Data prevista de pagamento: " }, { t: d.prazos.pagamento, b: true }], { ...recuo, tamanho: 9.5 });
  f.texto([{ t: "Nota Fiscal recebida depois do prazo passa para a data de pagamento seguinte.", cor: CINZA }], { ...recuo, tamanho: 8.5 });
  f.y = topoCaixa - alturaCaixa - 24;

  f.texto([{ t: "Atenciosamente," }]);
  f.texto([{ t: d.tomador.razao, b: true }]);
  f.cabe(16);
  f.pagina.drawText(winAnsi("Tudo acontece com gente!"), {
    x: MARGEM, y: f.y - 10, size: 10, font: italico, color: LARANJA,
  });

  return await doc.save();
}
