/**
 * Quem está mobilizado agora — uma linha por PESSOA, não por processo.
 *
 * Pedido da Edijane (24/09/2026): "quando precisar consultar quem está
 * mobilizado no contrato, onde vamos ver essa informação?". A lista de
 * Processos não responde isso: quem foi mobilizado duas vezes aparece duas
 * vezes, e o que interessa é o estado ATUAL de cada pessoa.
 *
 * A situação é DERIVADA da última mobilização de cada pessoa e de uma eventual
 * desmobilização DAQUELA obra (ver `encerra`) — o portal não
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
 * O id do colaborador é a chave boa, mas a carga da planilha veio sem id — ali
 * só há o nome —, enquanto o que nasce no portal tem id. Por isso a junção é
 * feita em situacaoPorPessoa: o id de um processo é emprestado aos processos
 * da mesma pessoa que só têm nome. Sem isso, quem foi importado e depois
 * desmobilizado pelo portal virava DUAS linhas (conferência de 25/11/2026: 13
 * pessoas aparecendo como mobilizadas e desmobilizadas ao mesmo tempo). O
 * preço é que dois homônimos se fundem, o que é menos ruim do que a lista
 * mentir sobre quem está na obra.
 */
export const nomeNormalizado = (nome) => String(nome || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ').trim().toUpperCase();

export const chaveDaPessoa = (p) => p?.profissional_id || nomeNormalizado(p?.profissional_nome);

/**
 * Chave da pessoa dentro de um conjunto de processos: o id de um processo é
 * emprestado aos processos da mesma pessoa que só têm nome (nome -> id, de
 * quem tem os dois). Usada aqui e no Histórico, para as duas telas contarem
 * as mesmas pessoas.
 */
export function chaveadorDePessoas(processos = []) {
  const idDoNome = new Map();
  for (const p of processos) {
    const nome = nomeNormalizado(p.profissional_nome);
    if (p.profissional_id && nome && !idDoNome.has(nome)) idDoNome.set(nome, p.profissional_id);
  }
  return (p) => p.profissional_id || idDoNome.get(nomeNormalizado(p.profissional_nome))
    || nomeNormalizado(p.profissional_nome);
}

/** Data-base primeiro (é quando o fato aconteceu); a criação só desempata. */
const momento = (p) => {
  const base = Date.parse(p?.data_base || '');
  const criado = Date.parse(p?.criado_em || '');
  return [Number.isFinite(base) ? base : (Number.isFinite(criado) ? criado : 0),
    Number.isFinite(criado) ? criado : 0];
};
const maisRecentePrimeiro = (a, b) => {
  const [ba, ca] = momento(a);
  const [bb, cb] = momento(b);
  return (bb - ba) || (cb - ca);
};
const naoAntes = (desmob, mob) => {
  const [bd, cd] = momento(desmob);
  const [bm, cm] = momento(mob);
  return bd > bm || (bd === bm && cd >= cm);
};

const ctNormalizado = (v) => String(v || '').replace(/\s+/g, '').toUpperCase();

/**
 * A desmobilização encerra a obra ATUAL? Só se for da mesma obra (mesmo CT)
 * e não for anterior a ela. Desmobilização de obra antiga, registrada depois
 * que a pessoa já foi mobilizada em outra (Lucas Pedro: sai da IMC SASTE em
 * 28/10, entra na Superus em 26/10), não tira a pessoa da obra nova.
 * Desmobilização sem CT vale para a obra atual — o formulário antigo não
 * coletava o CT. Mobilização sem CT compara pelo local da obra.
 */
const encerra = (desmob, mob) => {
  if (!naoAntes(desmob, mob)) return false;
  const ctD = ctNormalizado(desmob.cod_ct);
  const ctM = ctNormalizado(mob.cod_ct);
  if (!ctD) return true;
  if (ctM) return ctD === ctM;
  // Mobilização ainda sem CT (Hudson e Marcos Antonio na BP Bioenergy): vale
  // o local da obra.
  return nomeNormalizado(desmob.local_obra) === nomeNormalizado(mob.local_obra);
};

/**
 * @param processos lista crua de mobilizacao_processos
 * @returns [{ chave, nome, situacao, local_obra, cod_ct, ger_phd, cliente_phd,
 *             contrato, data_base, processoId, numero, processos }]
 */
export function situacaoPorPessoa(processos = []) {
  const daPessoa = processos.filter((p) => (
    (p.fluxo === FLUXO_MOBILIZACAO || p.fluxo === FLUXO_DESMOBILIZACAO)
    // Cancelado não aconteceu: contá-lo diria que a pessoa está numa obra em
    // que ela nunca entrou.
    && p.status !== 'cancelado'
    && chaveDaPessoa(p)
  ));

  const chave = chaveadorDePessoas(daPessoa);

  const porPessoa = new Map();
  for (const p of daPessoa) {
    const k = chave(p);
    const atual = porPessoa.get(k) || [];
    atual.push(p);
    porPessoa.set(k, atual);
  }

  const linhas = [];
  for (const [k, lista] of porPessoa) {
    const ordenados = [...lista].sort(maisRecentePrimeiro);
    const mobs = ordenados.filter((p) => p.fluxo === FLUXO_MOBILIZACAO);
    const desmobs = ordenados.filter((p) => p.fluxo === FLUXO_DESMOBILIZACAO);
    // A obra atual é a da última mobilização: uma mobilização nova substitui
    // as antigas, que a planilha nunca encerrou.
    const obra = mobs[0] || null;
    const saida = obra ? desmobs.find((d) => encerra(d, obra)) : desmobs[0];

    let situacao;
    let ref;
    if (saida) {
      situacao = saida.status === 'em_andamento' ? 'em_desmobilizacao' : 'desmobilizado';
      ref = saida;
    } else {
      situacao = obra.status === 'em_andamento' ? 'em_mobilizacao' : 'mobilizado';
      ref = obra;
    }
    // Obra, CT e gestor saem da mobilização, e não da saída: o formulário de
    // desmobilização não coleta esses campos (só quem sai e quando), então a
    // linha de um desmobilizado ficaria vazia justamente nas colunas que
    // respondem "de qual obra ele saiu?".
    const dados = obra || ref;
    linhas.push({
      chave: k,
      nome: ref.profissional_nome || dados.profissional_nome || '',
      situacao,
      local_obra: dados.local_obra || '',
      cod_ct: dados.cod_ct || '',
      ger_phd: dados.ger_phd || '',
      cliente_phd: dados.cliente_phd || '',
      contrato: dados.contrato || '',
      data_base: ref.data_base || null,
      processoId: ref.id,
      numero: ref.numero,
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
