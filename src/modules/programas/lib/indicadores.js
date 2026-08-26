import { CATEGORIAS, SETORES } from '../../../config/programas';

/**
 * Contas dos dois painéis. Ficam fora das telas — são o tipo de regra que muda
 * ("evoluída conta comentário?") e precisa de um lugar só para mudar.
 */

// ============================ Campo de Ideias ============================

const SEM_SETOR = 'Sem setor';

/**
 * Resumo do Dashboard do Campo de Ideias.
 *
 * `porSetor` inclui a faixa "Sem setor" porque a IDEIA não tem setor (a planilha
 * só pede setor na iniciativa). Escondê-las faria o gráfico somar menos que o
 * card de total, e alguém ia passar a tarde procurando as que faltam.
 */
export function resumoIdeias(linhas = []) {
  const mapa = new Map([...SETORES, SEM_SETOR].map((s) => [s, 0]));
  linhas.forEach((l) => {
    const k = l.setor || SEM_SETOR;
    mapa.set(k, (mapa.get(k) || 0) + 1);
  });

  return {
    total: linhas.length,
    ideias: linhas.filter((l) => l.tipo === 'ideia').length,
    iniciativas: linhas.filter((l) => l.tipo === 'iniciativa').length,
    porSetor: [...mapa.entries()]
      .map(([nome, total]) => ({ nome, total }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total),
    // O kanban da planilha é por categoria ("Tipo"), com uma coluna por opção —
    // inclusive as vazias, que também são informação: ninguém propôs venda.
    porCategoria: CATEGORIAS.map((c) => ({
      ...c,
      cards: linhas.filter((l) => l.categoria === c.valor),
    })),
  };
}

// ============================ Alavanca PHD ============================

/**
 * Uma indicação conta como EVOLUÍDA quando o comercial encostou nela: mudou o
 * status ou deixou comentário. É o critério da planilha ("se o time comercial
 * colocou algum comentário e/ou status significa que a iniciativa evoluiu").
 * Concluída também evoluiu — é o estágio seguinte, não um ramo paralelo.
 */
export const evoluiu = (i) =>
  i.status === 'em_evolucao' || i.status === 'concluida' || Boolean(i.comentario);

export function resumoAlavanca(linhas = []) {
  const concluidas = linhas.filter((i) => i.status === 'concluida');

  return {
    total: linhas.length,
    elegiveis: linhas.filter((i) => i.elegibilidade === 'elegivel').length,
    // "Depende do comercial": empresa já na base com contato novo. Fica visível
    // porque é a fila de trabalho do time — não decidir é a pior saída.
    emAnalise: linhas.filter((i) => i.elegibilidade === 'em_analise').length,
    naoElegiveis: linhas.filter((i) => i.elegibilidade === 'nao_elegivel').length,
    evoluidas: linhas.filter(evoluiu).length,
    concluidas: concluidas.length,
    premioTotal: concluidas.reduce((s, i) => s + Number(i.valor_premio || 0), 0),
    // Mapa de vencedores: nome, valor e data de pagamento, conforme as regras.
    vencedores: concluidas
      .slice()
      .sort((a, b) => new Date(b.concluida_em || 0) - new Date(a.concluida_em || 0)),
  };
}
