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
 *
 * ENCERRADA não evoluiu, mesmo tendo comentário: o funil mede o que ainda pode
 * virar contrato, e a encerrada já saiu. Contá-la fazia "Evoluíram" inchar com
 * oportunidades mortas — a etapa dizia 105 quando 60 delas não iam a lugar
 * nenhum, e a retenção para "Concluídas" parecia um despencar que não era real.
 */
export const evoluiu = (i) => i.status !== 'encerrada'
  && (i.status === 'em_evolucao' || i.status === 'concluida' || Boolean(i.comentario));

export function resumoAlavanca(linhas = []) {
  const concluidas = linhas.filter((i) => i.status === 'concluida');
  const elegiveis = linhas.filter((i) => i.elegibilidade === 'elegivel');
  // Encadeadas de propósito: cada etapa é filtrada sobre a ANTERIOR, não sobre
  // a base inteira. Solto, "Evoluíram" contava 45 contra 19 elegíveis e o funil
  // desenhava uma barra crescendo no meio — as 40 indicações nunca triadas
  // entravam por terem comentário, mas o comentário delas é metadado da carga
  // ("Planilha: Hunter"), não trabalho do comercial.
  const evoluidas = elegiveis.filter(evoluiu);

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
      { nome: 'Concluídas', total: evoluidas.filter((i) => i.status === 'concluida').length },
    ],
    porPessoa: [...porPessoa.values()].sort((a, b) => b.total - a.total),
    premioPago: concluidas.filter((i) => i.pago_em)
      .reduce((s, i) => s + Number(i.valor_premio || 0), 0),
    // "A pagar" é pendência com dono, não saldo: a regra manda pagar depois do
    // faturamento da 1ª medição, e é fácil deixar passar.
    premioAPagar: concluidas.filter((i) => !i.pago_em)
      .reduce((s, i) => s + Number(i.valor_premio || 0), 0),
    contratoTotal: concluidas.reduce((s, i) => s + Number(i.valor_contrato || 0), 0),
    /**
     * Saídas do funil, em ORDEM DE PRECEDÊNCIA — cada indicação cai em uma só.
     * Somadas com as que seguem vivas, dão o total; contadas soltas, não: 46
     * das encerradas também estão com elegibilidade pendente, e o card as
     * mostrava duas vezes (60 + 1 + 87 = 148 sobre uma base de 107).
     *
     * A ordem diz quem decidiu: encerrar é decisão do comercial e vale sobre
     * qualquer coisa; não elegível é a checagem contra a base; pendente é o
     * que sobrou sem ninguém olhar.
     */
    encerradas: linhas.filter((i) => i.status === 'encerrada').length,
    naoElegiveis: linhas.filter(
      (i) => i.status !== 'encerrada' && i.elegibilidade === 'nao_elegivel'
    ).length,
    pendentes: linhas.filter(
      (i) => i.status !== 'encerrada' && i.elegibilidade === 'pendente'
    ).length,
    total: linhas.length,
    elegiveis: elegiveis.length,
    // "Depende do comercial": empresa já na base com contato novo. Fica visível
    // porque é a fila de trabalho do time — não decidir é a pior saída.
    emAnalise: linhas.filter((i) => i.elegibilidade === 'em_analise').length,
    evoluidas: evoluidas.length,
    concluidas: concluidas.length,
    premioTotal: concluidas.reduce((s, i) => s + Number(i.valor_premio || 0), 0),
    // Mapa de vencedores: nome, valor e data de pagamento, conforme as regras.
    vencedores: concluidas
      .slice()
      .sort((a, b) => new Date(b.concluida_em || 0) - new Date(a.concluida_em || 0)),
  };
}
