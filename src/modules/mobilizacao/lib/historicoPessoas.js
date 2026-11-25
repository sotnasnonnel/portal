/**
 * Histórico de Mob / Desmob — uma linha por MOVIMENTO de pessoa.
 *
 * "Quem está mobilizado" responde o estado de hoje (uma linha por pessoa);
 * aqui fica tudo o que aconteceu: cada entrada e cada saída, de cada obra,
 * vindas da planilha antiga ou do portal. A mesma pessoa junta pela chave de
 * situacaoPessoas (id do colaborador, ou o nome quando o processo veio da
 * planilha sem id), para o filtro por pessoa trazer a trajetória inteira.
 *
 * Lógica pura, testável com `node --test`.
 */
import {
  FLUXO_MOBILIZACAO, FLUXO_DESMOBILIZACAO, chaveadorDePessoas, situacaoPorPessoa,
} from './situacaoPessoas.js';

export const TIPO = {
  mobilizacao: 'Mobilização',
  desmobilizacao: 'Desmobilização',
};

const semAcento = (v) => String(v || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase();

/**
 * Data do movimento: a data-base (quando aconteceu). Sem ela — desmobilização
 * registrada sem data de saída —, vale o dia em que entrou no portal.
 */
const dataDoMovimento = (p) => String(p.data_base || p.criado_em || '').slice(0, 10) || null;

/**
 * @param processos lista crua de mobilizacao_processos (todos os fluxos)
 * @returns [{ id, numero, chave, nome, tipo, status, data, local_obra, cod_ct,
 *             cliente_phd, ger_phd, coo_phd, origem, situacaoAtual, movimentos }]
 *          da data mais recente para a mais antiga.
 */
export function movimentosDePessoas(processos = []) {
  const daPessoa = processos.filter((p) => (
    (p.fluxo === FLUXO_MOBILIZACAO || p.fluxo === FLUXO_DESMOBILIZACAO)
    && String(p.profissional_nome || p.profissional_id || '').trim()
  ));
  const chave = chaveadorDePessoas(daPessoa);

  // A situação de hoje de cada pessoa, para a linha dizer onde ela está agora
  // (a mesma conta de "Quem está mobilizado").
  const situacao = new Map(situacaoPorPessoa(daPessoa).map((l) => [l.chave, l.situacao]));
  const contagem = new Map();
  for (const p of daPessoa) contagem.set(chave(p), (contagem.get(chave(p)) || 0) + 1);

  return daPessoa
    .map((p) => ({
      id: p.id,
      numero: p.numero,
      chave: chave(p),
      nome: p.profissional_nome || '',
      tipo: p.fluxo === FLUXO_DESMOBILIZACAO ? 'desmobilizacao' : 'mobilizacao',
      status: p.status,
      data: dataDoMovimento(p),
      local_obra: p.local_obra || '',
      cod_ct: p.cod_ct || '',
      cliente_phd: p.cliente_phd || '',
      ger_phd: p.ger_phd || '',
      coo_phd: p.coo_phd || '',
      origem: p.origem === 'planilha' ? 'Planilha' : 'Portal',
      situacaoAtual: situacao.get(chave(p)) || null,
      movimentos: contagem.get(chave(p)) || 1,
    }))
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || ''))
      || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

/**
 * Filtros da tela. `status` vazio esconde só os cancelados (não aconteceram);
 * 'todos' traz tudo. Período compara a data do movimento, inclusive nas pontas.
 */
export function filtrarMovimentos(linhas = [], {
  busca = '', tipo = '', status = '', ct = '', cliente = '', de = '', ate = '', pessoa = '',
} = {}) {
  const alvo = semAcento(busca.trim());
  return linhas.filter((l) => {
    if (pessoa && l.chave !== pessoa) return false;
    if (tipo && l.tipo !== tipo) return false;
    if (!status && l.status === 'cancelado') return false;
    if (status && status !== 'todos' && l.status !== status) return false;
    if (ct && l.cod_ct !== ct) return false;
    if (cliente && l.cliente_phd !== cliente) return false;
    if (de && (!l.data || l.data < de)) return false;
    if (ate && (!l.data || l.data > ate)) return false;
    if (!alvo) return true;
    return [l.nome, l.local_obra, l.cod_ct, l.cliente_phd, l.ger_phd, l.coo_phd]
      .some((v) => semAcento(v).includes(alvo));
  });
}

/** Valores distintos de uma coluna, para os seletores. */
export function opcoes(linhas = [], campo) {
  return [...new Set(linhas.map((l) => l[campo]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Números do topo: movimentos, entradas, saídas e pessoas distintas. */
export function resumoMovimentos(linhas = []) {
  return {
    total: linhas.length,
    mobilizacoes: linhas.filter((l) => l.tipo === 'mobilizacao').length,
    desmobilizacoes: linhas.filter((l) => l.tipo === 'desmobilizacao').length,
    pessoas: new Set(linhas.map((l) => l.chave)).size,
  };
}
