/**
 * Ordenação das tabelas da Mobilização (Etapas e Processos) pelo cabeçalho.
 *
 * Cada tela diz como ler cada coluna (`colunas`: chave -> função da linha); aqui
 * só se compara. A leitura fica na tela porque é ela que sabe o que a coluna
 * MOSTRA — ordenar Fluxo pelo slug e exibir o rótulo deixaria a ordem sem
 * sentido para quem olha.
 *
 * Regras:
 *   - vazio (null, undefined, '') vai sempre para o fim, nas duas direções:
 *     quem ordena por prazo quer ver os prazos, não uma pilha de "—" no topo;
 *   - número compara como número (atraso -3 antes de 2, não "-3" vs "2");
 *   - texto compara sem caixa e acento, com dígitos como número ("9" antes de
 *     "10", e o # do processo "61" antes de "367"). Datas ISO entram como texto
 *     e já saem na ordem certa.
 *   - empate mantém a ordem que veio do banco (sort estável).
 */

const vazio = (v) => v === null || v === undefined || v === '';

function comparar(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base', numeric: true });
}

export function ordenarLinhas(linhas = [], ordem, colunas = {}) {
  const ler = ordem && colunas[ordem.coluna];
  if (!ler) return linhas;
  const sinal = ordem.direcao === 'desc' ? -1 : 1;
  return [...linhas].sort((x, y) => {
    const a = ler(x);
    const b = ler(y);
    if (vazio(a) && vazio(b)) return 0;
    if (vazio(a)) return 1;
    if (vazio(b)) return -1;
    return sinal * comparar(a, b);
  });
}

/** Clique no cabeçalho: crescente → decrescente → ordem original. */
export function proximaOrdem(atual, coluna) {
  if (!atual || atual.coluna !== coluna) return { coluna, direcao: 'asc' };
  if (atual.direcao === 'asc') return { coluna, direcao: 'desc' };
  return null;
}
