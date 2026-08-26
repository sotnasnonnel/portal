import { CATEGORIAS, SETORES } from '../../../config/programas';

/**
 * Contas dos dois painéis. Ficam fora das telas — são o tipo de regra que muda
 * ("evoluída conta comentário?") e precisa de um lugar só para mudar.
 */

// ============================ Campo de Ideias ============================

/**
 * Resumo do Dashboard do Campo de Ideias.
 *
 * `porSetor` quebra cada setor em ideias e iniciativas: saber que o setor tem
 * 8 registros não diz se são 8 coisas prontas ou 8 desejos.
 */
export function resumoIdeias(linhas = []) {
  const mapa = new Map(SETORES.map((s) => [s, { nome: s, ideias: 0, iniciativas: 0, total: 0 }]));
  linhas.forEach((l) => {
    // Setor fora da lista (herdado de carga antiga) ainda precisa aparecer —
    // some do gráfico e o total do card deixa de bater com a soma das barras.
    if (!mapa.has(l.setor)) mapa.set(l.setor, { nome: l.setor, ideias: 0, iniciativas: 0, total: 0 });
    const b = mapa.get(l.setor);
    b[l.tipo === 'ideia' ? 'ideias' : 'iniciativas'] += 1;
    b.total += 1;
  });

  return {
    total: linhas.length,
    ideias: linhas.filter((l) => l.tipo === 'ideia').length,
    iniciativas: linhas.filter((l) => l.tipo === 'iniciativa').length,
    porSetor: [...mapa.values()]
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
  const elegiveis = linhas.filter((i) => i.elegibilidade === 'elegivel');
  const evoluidas = linhas.filter(evoluiu);

  // Quem indica. Sem cortar em top-N: cortar a cauda esconde justamente quem
  // participou uma vez, que é o que o programa quer ver crescer.
  const porPessoa = new Map();
  linhas.forEach((i) => {
    const nome = i.indicadorNome || 'Não identificado';
    const p = porPessoa.get(nome) || { nome, total: 0, concluidas: 0 };
    p.total += 1;
    if (i.status === 'concluida') p.concluidas += 1;
    porPessoa.set(nome, p);
  });

  return {
    /**
     * Funil. Cada etapa é um SUBCONJUNTO da anterior, e é isso que autoriza
     * desenhá-las como barras que encurtam. "Não elegível" não entra: é saída
     * do funil, não etapa dele.
     */
    funil: [
      { nome: 'Recebidas', total: linhas.length },
      { nome: 'Elegíveis', total: elegiveis.length },
      { nome: 'Evoluíram', total: evoluidas.length },
      { nome: 'Concluídas', total: concluidas.length },
    ],
    porPessoa: [...porPessoa.values()].sort((a, b) => b.total - a.total),
    premioPago: concluidas.filter((i) => i.pago_em)
      .reduce((s, i) => s + Number(i.valor_premio || 0), 0),
    // "A pagar" é pendência com dono, não saldo: a regra manda pagar depois do
    // faturamento da 1ª medição, e é fácil deixar passar.
    premioAPagar: concluidas.filter((i) => !i.pago_em)
      .reduce((s, i) => s + Number(i.valor_premio || 0), 0),
    contratoTotal: concluidas.reduce((s, i) => s + Number(i.valor_contrato || 0), 0),
    pendentes: linhas.filter((i) => i.elegibilidade === 'pendente').length,
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
