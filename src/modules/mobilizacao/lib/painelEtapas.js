/**
 * Regras de exibição do quadro e da fila de ETAPAS.
 *
 * Copia a FORMA do painel do Adm (src/modules/administrativo/lib/painel.js) —
 * filtro vazio significa "todos", opções montadas do que está na tela e não do
 * cadastro inteiro, busca sem acento — mas não as linhas: os campos são outros
 * (responsavel_id em vez de atendente_id, data_prevista em vez de
 * sla_vence_em) e o vocabulário de status é outro. Uma camada genérica para os
 * dois teria mais `if` do que as duas cópias somadas.
 *
 * Lógica pura, testável — sem Supabase e sem React.
 */
import { STATUS_ENCERRADOS, ehEncerrada } from './statusEtapa.js';
import { hojeIso } from '../../../utils/diasUteis.js';

/**
 * As duas perguntas de prazo que o quadro e a fila fazem o tempo todo.
 *
 * Ambas leem dias_atraso, que o BANCO ja calculou (mob_recalcular). Comparar
 * datas aqui daria erro de fuso: AAAA-MM-DD virado em Date e UTC e, no nosso
 * fuso, uma etapa que vence hoje apareceria vencida desde as 21h de ontem.
 *
 * So conta o que ainda esta em jogo: etapa concluida com atraso ja entrou no
 * indicador de cumprimento de prazo, e soma-la aqui contaria duas vezes.
 */
export const estaAtrasada = (e) => !ehEncerrada(e?.status) && Number(e?.dias_atraso) > 0;
// Number(null) e 0, entao a etapa SEM prazo passaria por "vence hoje" se a
// comparacao fosse so === 0. Sem prazo nao vence nunca.
export const temPrazo = (e) => e?.dias_atraso !== null && e?.dias_atraso !== undefined
  && Number.isFinite(Number(e.dias_atraso));
export const venceHoje = (e) => !ehEncerrada(e?.status) && temPrazo(e) && Number(e.dias_atraso) === 0;

/**
 * Colunas do quadro, na ordem em que a etapa caminha.
 *
 * "Não se aplica" fica FORA do quadro, acessível só por filtro na fila: é o
 * passo que ninguém precisa mais olhar, e uma coluna dedicada só encheria a
 * tela — mesma razão pela qual o Adm junta os três encerrados numa coluna só.
 */
export const COLUNAS_KANBAN = [
  { chave: 'pendente', titulo: 'A fazer', status: ['pendente'] },
  { chave: 'em_andamento', titulo: 'Em andamento', status: ['em_andamento'] },
  { chave: 'concluida', titulo: 'Concluída', status: ['concluida'] },
];

/** Para onde a etapa vai quando o cartão é solto nesta coluna. */
export const statusAoSoltar = (colunaChave) =>
  COLUNAS_KANBAN.find((c) => c.chave === colunaChave)?.status[0] || null;

export function agruparEmColunas(etapas = []) {
  return COLUNAS_KANBAN.map((col) => ({
    ...col,
    itens: etapas.filter((e) => col.status.includes(e.status)),
  }));
}

/**
 * A etapa pode ir para esta coluna?
 *
 * A única trava real é a DEPENDÊNCIA: concluir "Emissão do ASO" antes de
 * "Exames" registraria uma data que a operação não viveu, e o prazo de tudo
 * que vem depois passaria a contar de uma mentira.
 *
 * O bloqueio é por CONCLUSÃO do predecessor, não por ele estar "em andamento":
 * pegar um passo adiantado é normal (dá para começar a montar o dossiê antes do
 * treinamento acabar) — o que não dá é dizer que terminou.
 *
 * @returns {{ok: boolean, motivo?: string}}
 */
export function podeMover(etapa, destino, etapasDoProcesso = []) {
  if (!etapa) return { ok: false, motivo: 'Etapa não encontrada.' };
  if (!destino) return { ok: false, motivo: 'Coluna desconhecida.' };
  if (etapa.status === destino) return { ok: true };

  if (destino === 'concluida' && etapa.depende_de) {
    const anterior = etapasDoProcesso.find((e) => e.codigo === etapa.depende_de);
    // Predecessor que não existe neste processo (removido do catálogo, ou
    // condicional que não foi criado) não trava nada: dependência de algo que
    // nunca vai acontecer prenderia a etapa para sempre.
    if (anterior && !ehEncerrada(anterior.status)) {
      return { ok: false, motivo: `Depende de "${anterior.titulo}", que ainda não foi concluída.` };
    }
  }

  return { ok: true };
}

/**
 * Quem pode gravar esta etapa.
 *
 * Espelha a policy de update (supabase_migration_mobilizacao.sql): time do Adm
 * ou o próprio responsável. É gate de UI — quem barra de fato é a RLS —, mas
 * aqui serve para não OFERECER um arrasto que morreria no rollback.
 */
export const podeEditar = (etapa, { meuId, souTime = false } = {}) =>
  souTime || (!!meuId && etapa?.responsavel_id === meuId);

/** "4 de 11" e a fração para a barra. */
export function progresso(processo) {
  const total = Number(processo?.etapas_total) || 0;
  const feitas = Number(processo?.etapas_concluidas) || 0;
  return { total, feitas, pct: total > 0 ? Math.round((feitas / total) * 100) : 0 };
}

/** Iniciais para o avatar do responsável no cartão. */
export function iniciais(nome) {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

const semAcento = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Filtros da fila de etapas.
 *
 * `busca` procura no título da etapa E no do processo: quem digita o nome do
 * profissional quer achar os passos dele, não só um passo chamado com o nome
 * dele (que não existe).
 *
 * `atrasadas` usa dias_atraso, que o banco já calculou. Comparar data aqui
 * daria fuso errado: 'AAAA-MM-DD' virado em Date é UTC, e um prazo que vence
 * hoje apareceria vencido desde as 21h de ontem.
 */
export function filtrarFila(etapas = [], f = {}) {
  const termo = semAcento(f.busca).trim();
  return etapas.filter((e) => {
    if (termo && !semAcento(`${e.titulo} ${e.processoTitulo || ''}`).includes(termo)) return false;
    if (f.fluxo && e.fluxo !== f.fluxo) return false;
    if (f.status && e.status !== f.status) return false;
    // '' no filtro = "todos"; 'sem' = as que ninguém assumiu ainda.
    if (f.responsavelId === 'sem' && e.responsavel_id) return false;
    if (f.responsavelId && f.responsavelId !== 'sem' && e.responsavel_id !== f.responsavelId) return false;
    if (f.atrasadas && !estaAtrasada(e)) return false;
    if (f.venceHoje && !venceHoje(e)) return false;
    // Sem filtro de situação, as encerradas ficam fora: a fila é o que falta.
    if (!f.status && !f.incluirEncerradas && STATUS_ENCERRADOS.includes(e.status)) return false;
    return true;
  });
}

/**
 * Opções dos filtros, montadas do que está NA FILA — não do cadastro inteiro.
 * Oferecer um responsável sem etapa nenhuma só gera lista vazia.
 */
export function opcoesDaFila(etapas = []) {
  const responsaveis = new Map();
  const fluxos = new Set();
  const status = new Set();
  for (const e of etapas) {
    if (e.responsavel_id) responsaveis.set(e.responsavel_id, e.responsavelNome || 'Sem nome');
    if (e.fluxo) fluxos.add(e.fluxo);
    if (e.status) status.add(e.status);
  }
  return {
    responsaveis: [...responsaveis].map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    fluxos: [...fluxos].sort(),
    status: [...status].sort(),
    temSemResponsavel: etapas.some((e) => !e.responsavel_id),
  };
}

/**
 * Processo atrasado: ainda em andamento e com o prazo ja vencido.
 *
 * prazo_em e o MAIOR prazo entre as etapas que faltam (mob_recalcular), entao
 * um processo so e atrasado quando o ultimo passo pendente ja passou da data.
 * A comparacao e entre TEXTOS AAAA-MM-DD, que ordena igual a cronologia e nao
 * passa por Date — mesmo motivo de estaAtrasada acima.
 */
export function processoAtrasado(p, hoje = hojeIso()) {
  if (!p?.prazo_em || p.status !== 'em_andamento') return false;
  return String(p.prazo_em).slice(0, 10) < hoje;
}

/**
 * Filtros da lista de processos. Mesma convencao do resto do portal: filtro
 * vazio e "todos", nunca "nenhum".
 *
 * A busca varre titulo, profissional, cliente e codigos de projeto: quem
 * procura "IMCS-CT09" esta atras da obra, e quem digita um sobrenome esta
 * atras da pessoa — os dois caem na mesma caixa.
 */
export function filtrarProcessos(processos = [], f = {}, hoje = hojeIso()) {
  const termo = semAcento(f.busca).trim();
  return processos.filter((p) => {
    if (termo) {
      const alvo = [p.titulo, p.profissional_nome, p.cliente_phd, p.cliente_final,
        p.local_obra, p.cod_ct, p.cod_phd, p.responsavelNome].filter(Boolean).join(' ');
      if (!semAcento(alvo).includes(termo)) return false;
    }
    if (f.fluxo && p.fluxo !== f.fluxo) return false;
    if (f.atrasados && !processoAtrasado(p, hoje)) return false;
    return true;
  });
}
