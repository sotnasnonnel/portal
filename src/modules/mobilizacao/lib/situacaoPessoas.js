/**
 * Quem está mobilizado agora — uma linha por PESSOA, não por processo.
 *
 * Pedido da Edijane (24/09/2026): "quando precisar consultar quem está
 * mobilizado no contrato, onde vamos ver essa informação?". A lista de
 * Processos não responde isso: quem foi mobilizado duas vezes aparece duas
 * vezes, e o que interessa é o estado ATUAL de cada pessoa.
 *
 * A situação é DERIVADA do processo mais recente de cada pessoa — o portal não
 * guarda um campo "está mobilizado". Derivar é o certo: um campo assim
 * precisaria ser mantido à mão e divergiria do histórico no primeiro
 * esquecimento.
 *
 * LIMITE CONHECIDO, e a tela precisa dizê-lo: a base veio de uma planilha que
 * só registrava ENTRADAS. Em 25/09/2026 havia 91 mobilizações concluídas e
 * nenhuma desmobilização concluída, então quem saiu da obra antes do portal
 * aparece aqui como mobilizado. Isso se corrige sozinho conforme as saídas
 * passarem a ser registradas — não é conta errada, é dado que falta.
 *
 * Lógica pura, testável com `node --test`.
 */

/** Os dois fluxos que falam de pessoa. O de empresa não entra nesta conta. */
export const FLUXO_MOBILIZACAO = 'mobilizacao_pessoa';
export const FLUXO_DESMOBILIZACAO = 'desmobilizacao_pessoa';

export const SITUACAO = {
  mobilizado: 'Mobilizado',
  em_mobilizacao: 'Em mobilização',
  desmobilizado: 'Desmobilizado',
  em_desmobilizacao: 'Em desmobilização',
};

/** Ordem de leitura da tela: primeiro quem está na obra, depois quem saiu. */
export const ORDEM_SITUACAO = ['mobilizado', 'em_mobilizacao', 'em_desmobilizacao', 'desmobilizado'];

/**
 * A mesma pessoa em processos diferentes.
 *
 * O id do colaborador é a chave boa, mas metade da base veio da planilha sem
 * id — ali só há o nome. Cair para o nome normalizado evita que a mesma pessoa
 * vire duas linhas; o preço é que dois homônimos se fundem, o que é menos ruim
 * do que a lista mentir sobre quem está na obra.
 */
export const chaveDaPessoa = (p) => (
  p?.profissional_id || String(p?.profissional_nome || '').trim().toUpperCase()
);

const tempo = (p) => {
  const t = Date.parse(p?.criado_em || '');
  return Number.isFinite(t) ? t : 0;
};

function situacaoDoProcesso(p) {
  const emAndamento = p.status === 'em_andamento';
  if (p.fluxo === FLUXO_DESMOBILIZACAO) return emAndamento ? 'em_desmobilizacao' : 'desmobilizado';
  return emAndamento ? 'em_mobilizacao' : 'mobilizado';
}

/**
 * @param processos lista crua de mobilizacao_processos
 * @returns [{ chave, nome, situacao, local_obra, cod_ct, ger_phd, cliente_phd,
 *             contrato, data_base, processoId, numero, desde }]
 */
export function situacaoPorPessoa(processos = []) {
  const daPessoa = processos.filter((p) => (
    (p.fluxo === FLUXO_MOBILIZACAO || p.fluxo === FLUXO_DESMOBILIZACAO)
    // Cancelado não aconteceu: contá-lo diria que a pessoa está numa obra em
    // que ela nunca entrou.
    && p.status !== 'cancelado'
    && chaveDaPessoa(p)
  ));

  const porPessoa = new Map();
  for (const p of daPessoa) {
    const chave = chaveDaPessoa(p);
    const atual = porPessoa.get(chave) || [];
    atual.push(p);
    porPessoa.set(chave, atual);
  }

  const linhas = [];
  for (const [chave, lista] of porPessoa) {
    const ordenados = [...lista].sort((a, b) => tempo(b) - tempo(a));
    const ultimo = ordenados[0];
    // Obra, CT e gestor saem da última MOBILIZAÇÃO, e não do último processo: o
    // formulário de desmobilização não coleta esses campos (só quem sai e
    // quando), então a linha de um desmobilizado ficaria vazia justamente nas
    // colunas que respondem "de qual obra ele saiu?".
    const ultimaMob = ordenados.find((p) => p.fluxo === FLUXO_MOBILIZACAO) || ultimo;
    linhas.push({
      chave,
      nome: ultimo.profissional_nome || '',
      situacao: situacaoDoProcesso(ultimo),
      local_obra: ultimaMob.local_obra || '',
      cod_ct: ultimaMob.cod_ct || '',
      ger_phd: ultimaMob.ger_phd || '',
      cliente_phd: ultimaMob.cliente_phd || '',
      contrato: ultimaMob.contrato || '',
      data_base: ultimo.data_base || null,
      processoId: ultimo.id,
      numero: ultimo.numero,
      // Quantos processos essa pessoa já teve — é o que explica um "mobilizado"
      // que já passou por três obras.
      processos: ordenados.length,
    });
  }

  return linhas.sort((a, b) => (
    ORDEM_SITUACAO.indexOf(a.situacao) - ORDEM_SITUACAO.indexOf(b.situacao)
    || a.nome.localeCompare(b.nome, 'pt-BR')
  ));
}

/** Filtro da tela: texto livre + situação + contrato/CT. */
export function filtrarPessoas(linhas = [], { busca = '', situacao = '', ct = '' } = {}) {
  const alvo = busca.trim().toLowerCase();
  return linhas.filter((l) => {
    if (situacao && l.situacao !== situacao) return false;
    if (ct && l.cod_ct !== ct) return false;
    if (!alvo) return true;
    return [l.nome, l.local_obra, l.cod_ct, l.ger_phd, l.cliente_phd, l.contrato]
      .some((v) => String(v || '').toLowerCase().includes(alvo));
  });
}

/** Os CTs que aparecem na lista, para o seletor de contrato. */
export function centrosDeCusto(linhas = []) {
  return [...new Set(linhas.map((l) => l.cod_ct).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Contagem por situação, para os cartões do topo. */
export function contarPorSituacao(linhas = []) {
  return ORDEM_SITUACAO.map((chave) => ({
    chave,
    label: SITUACAO[chave],
    total: linhas.filter((l) => l.situacao === chave).length,
  }));
}
