// Onde um caractere do textarea está desenhado, em px, relativo ao canto do
// próprio textarea: { left, top, altura }. O navegador não expõe isso para
// textarea, então se monta uma cópia invisível com a mesma caixa e a mesma
// fonte, com o texto até aquele ponto, e se mede um marcador no fim.
// Usado para abrir a lista do "@" ao lado do "@" (CampoMencoes).

const COPIAR = [
  'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight', 'fontFamily',
  'textAlign', 'textTransform', 'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing', 'tabSize',
  'whiteSpace', 'wordWrap', 'overflowWrap', 'wordBreak',
];

export function posicaoCursor(textarea, indice) {
  if (!textarea) return null;
  const css = window.getComputedStyle(textarea);
  const copia = document.createElement('div');
  for (const p of COPIAR) copia.style[p] = css[p];
  Object.assign(copia.style, {
    position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px',
    whiteSpace: 'pre-wrap', overflowWrap: 'break-word', overflow: 'hidden',
  });
  copia.textContent = textarea.value.slice(0, indice);
  const marca = document.createElement('span');
  marca.textContent = textarea.value.slice(indice) || '.';
  copia.appendChild(marca);
  document.body.appendChild(copia);
  const altura = parseFloat(css.lineHeight) || parseFloat(css.fontSize) * 1.4;
  const pos = {
    left: marca.offsetLeft + parseFloat(css.borderLeftWidth || 0) - textarea.scrollLeft,
    top: marca.offsetTop + parseFloat(css.borderTopWidth || 0) - textarea.scrollTop,
    altura,
  };
  document.body.removeChild(copia);
  return pos;
}
