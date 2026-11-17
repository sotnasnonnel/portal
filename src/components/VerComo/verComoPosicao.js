// verComoPosicao.js — copiado do HUB PHD (app-phd). Onde o botão flutuante do "Ver como" fica na tela.
//
// Pedido do Lennon (12/11/2026): "deixe o botão de ver como para eu conseguir
// movimentá-lo e ficar salvo onde eu deixar". O botão vive por cima de todas as
// telas (components/VerComo, montado no AppRoutes) e tapava conteúdo no canto inferior
// esquerdo — ora um gráfico, ora a primeira coluna de uma tabela.
//
// A posição é do NAVEGADOR de quem usa, não do banco: é preferência de tela de
// uma pessoa só e precisa valer já no primeiro quadro, antes de qualquer
// consulta. Por isso localStorage, e não uma tabela nova.
//
// Aqui mora só a conta (ler, limitar e gravar), para dar teste sem montar
// componente; o arraste em si está no VerComo.jsx.

export const CHAVE_POS_VER_COMO = 'portal.verComo.pos';

// Respiro do canto, em px: o mesmo que o botão sempre teve (left/bottom 16).
const MARGEM = 16;
// Quanto do botão tem de sobrar visível se a janela encolher depois do arraste.
// Menos que isso e ele viraria uma borda sem alvo de clique.
const MINIMO_VISIVEL = 32;

/**
 * Posição inicial: canto inferior esquerdo, onde o botão estava antes de poder
 * ser arrastado. `janela` = { largura, altura }; `tamanho` = { largura, altura }
 * do botão.
 */
export function posicaoPadrao(janela, tamanho) {
  const altura = Number(tamanho?.altura) || 34;
  return { left: MARGEM, top: Math.max(MARGEM, (Number(janela?.altura) || 768) - altura - MARGEM) };
}

/**
 * A posição com o botão ainda alcançável: ele pode sair um pouco para fora,
 * mas nunca ao ponto de não dar para clicar nem para arrastar de volta.
 * Acontece de verdade quando a pessoa arrasta no monitor grande e depois abre o
 * app no notebook.
 */
export function limitarPosicao(pos, janela, tamanho) {
  const larguraJanela = Number(janela?.largura) || 1024;
  const alturaJanela = Number(janela?.altura) || 768;
  const largura = Number(tamanho?.largura) || 130;
  const altura = Number(tamanho?.altura) || 34;
  const maxLeft = Math.max(0, larguraJanela - Math.min(largura, MINIMO_VISIVEL));
  const maxTop = Math.max(0, alturaJanela - Math.min(altura, MINIMO_VISIVEL));
  const limitar = (v, max) => Math.min(Math.max(0, Number(v) || 0), max);
  return { left: limitar(pos?.left, maxLeft), top: limitar(pos?.top, maxTop) };
}

/** A posição guardada, ou null se não há nada gravado (ou o que há não presta). */
export function lerPosicao(armazem) {
  try {
    const bruto = armazem?.getItem?.(CHAVE_POS_VER_COMO);
    if (!bruto) return null;
    const { left, top } = JSON.parse(bruto) || {};
    if (!Number.isFinite(Number(left)) || !Number.isFinite(Number(top))) return null;
    return { left: Number(left), top: Number(top) };
  } catch {
    // localStorage bloqueado (janela privada, política do navegador) ou JSON
    // estragado: o botão volta ao canto de sempre, sem quebrar a tela.
    return null;
  }
}

/** Guarda a posição. Falha de localStorage não pode derrubar o arraste. */
export function gravarPosicao(armazem, pos) {
  try {
    armazem?.setItem?.(CHAVE_POS_VER_COMO, JSON.stringify({ left: Math.round(pos.left), top: Math.round(pos.top) }));
    return true;
  } catch {
    return false;
  }
}
