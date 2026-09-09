import { diasEntre, hojeIso } from '../../../utils/diasUteis.js';
import { STATUS_LABEL as STATUS_ADM } from '../../administrativo/lib/statusChamado.js';
import { STATUS_LABEL as STATUS_MOB } from '../../mobilizacao/lib/statusEtapa.js';
import { rotuloFluxoCurto } from '../../../config/mobilizacao.js';
import { rotulosDeServico, chaveServico } from './matrizChamados.js';

/**
 * A lista única da Torre: etapas de Mobilização E chamados do Administrativo.
 *
 * O Mapa e o Quadro já mostravam os dois; a lista mostrava só mobilização, e
 * quem conferia item a item na reunião tinha de sair da tela para ver o Adm —
 * exatamente o que a Torre existe para evitar.
 *
 * As duas coisas NÃO são a mesma, e a lista não finge que são: cada linha diz
 * de onde veio. O que se unifica é só o formato da linha, para caberem na mesma
 * tabela e nos mesmos filtros.
 *
 * Lógica pura, testada. A tela só desenha.
 */

export const ORIGENS = [
  { valor: 'mobilizacao', label: 'Mobilização' },
  { valor: 'adm', label: 'Chamado do Adm' },
];

const semAcento = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Só a parte da data: o Adm guarda prazo com hora, a Mobilização sem. */
const soData = (v) => (v ? String(v).slice(0, 10) : null);

/**
 * Dias de atraso de um CHAMADO.
 *
 * A Mobilização já tem `dias_atraso` calculado pelo banco; o Adm não tem coluna
 * equivalente, então a conta é feita aqui — em dias inteiros sobre a data pura,
 * e não em milissegundos, porque `sla_vence_em` é timestamptz e comparar o
 * instante faria um prazo que vence hoje às 18h aparecer como atrasado de manhã.
 *
 * Positivo = atrasado. Chamado encerrado congela no dia em que fechou.
 */
export function atrasoDoChamado(chamado, hoje = hojeIso()) {
  const prazo = soData(chamado?.sla_vence_em);
  if (!prazo) return null;
  const referencia = soData(chamado?.fechado_em) || hoje;
  return diasEntre(referencia, prazo);
}

/** Uma etapa de mobilização vira linha. */
function linhaDaEtapa(e) {
  return {
    chave: `mob:${e.id}`,
    origem: 'mobilizacao',
    numero: e.numero,
    titulo: e.titulo,
    contexto: e.processoTitulo || '',
    grupo: rotuloFluxoCurto(e.fluxo),
    grupoChave: e.fluxo,
    responsavel_id: e.responsavel_id || null,
    responsavelNome: e.responsavelNome || '',
    status: e.status,
    statusLabel: STATUS_MOB[e.status] || e.status,
    prazo: soData(e.data_prevista),
    real: soData(e.data_real),
    diasAtraso: e.dias_atraso === null || e.dias_atraso === undefined ? null : Number(e.dias_atraso),
    link: e.processo_id ? `/mobilizacao/processo/${e.processo_id}` : null,
  };
}

/** Um chamado do Adm vira linha. */
function linhaDoChamado(c, rotulos, hoje) {
  const rotulo = rotulos.get(chaveServico(c.classe, c.servico));
  return {
    chave: `adm:${c.id}`,
    origem: 'adm',
    numero: c.numero,
    // O "passo" de um chamado é o serviço pedido — é o equivalente mais próximo
    // da etapa, e o que a reunião chama pelo nome ("a solicitação de uniforme").
    titulo: rotulo?.servico || c.assunto || c.servico,
    contexto: c.assunto && c.assunto !== rotulo?.servico ? c.assunto : (rotulo?.classe || ''),
    grupo: 'Chamado do Adm',
    grupoChave: 'adm',
    responsavel_id: c.atendente_id || null,
    responsavelNome: c.atendenteNome || '',
    status: c.status,
    statusLabel: STATUS_ADM[c.status] || c.status,
    prazo: soData(c.sla_vence_em),
    real: soData(c.fechado_em),
    diasAtraso: atrasoDoChamado(c, hoje),
    link: `/administrativo/chamado/${c.id}`,
  };
}

/**
 * Junta os dois mundos e ordena.
 *
 * Ordem por GRAVIDADE: o mais atrasado primeiro, e sem prazo por último. É a
 * ordem que a reunião quer — quem não tem prazo não está atrasado, mas também
 * não deve ocupar o topo da tela.
 */
export function montarLista({ etapas = [], chamados = [], classes, hoje = hojeIso() } = {}) {
  const rotulos = rotulosDeServico(classes);
  const linhas = [
    ...etapas.map(linhaDaEtapa),
    ...chamados.map((c) => linhaDoChamado(c, rotulos, hoje)),
  ];

  return linhas.sort((a, b) => {
    const av = a.diasAtraso === null ? -Infinity : a.diasAtraso;
    const bv = b.diasAtraso === null ? -Infinity : b.diasAtraso;
    if (av !== bv) return bv - av;
    return (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR');
  });
}

/** Vencido = tem prazo, passou, e não terminou. */
export const estaAtrasada = (l) => l.diasAtraso !== null && l.diasAtraso > 0 && !l.real;

/**
 * Encerrado = acabou e não volta para a fila.
 *
 * Reprovado e cancelado entram junto com fechado pela mesma razão já assumida
 * no Adm: para quem pediu, um pedido negado está tão concluído quanto um
 * atendido, e deixá-lo "em andamento" faria o item parecer vivo para sempre.
 */
const ENCERRADOS = {
  mobilizacao: ['concluida', 'dispensada'],
  adm: ['fechado', 'reprovado', 'cancelado'],
};

export const ehEncerrado = (l) => (ENCERRADOS[l?.origem] || []).includes(l?.status);

/**
 * Filtros. Mesma convenção do resto do portal: string vazia é "todos".
 *
 * `origem` é o filtro novo, e o que torna a lista utilizável: numa reunião que
 * está falando só de mobilização, os chamados viram ruído — e vice-versa.
 */
export function filtrarLista(linhas = [], f = {}) {
  const termo = semAcento(f.busca).trim();
  return linhas.filter((l) => {
    if (f.origem && l.origem !== f.origem) return false;
    if (f.grupo && l.grupoChave !== f.grupo) return false;
    // A situacao e comparada pela chave COMPOSTA origem:status, a mesma que
    // opcoesDaLista monta — 'concluida' da mobilizacao e 'fechado' do Adm sao
    // coisas diferentes, e comparar so o status faria o seletor de um mundo
    // filtrar o outro junto.
    if (f.status && `${l.origem}:${l.status}` !== f.status) return false;
    if (f.responsavelId === 'sem' && l.responsavel_id) return false;
    if (f.responsavelId && f.responsavelId !== 'sem' && l.responsavel_id !== f.responsavelId) return false;
    if (f.atrasadas && !estaAtrasada(l)) return false;
    // Sem pedir situação nem encerradas, a lista é o que FALTA. São ~1300
    // etapas contra ~50 em aberto: mostrar tudo por padrão afogaria a reunião
    // no que já acabou. Mesma regra da fila da Mobilização.
    if (!f.status && !f.incluirEncerradas && ehEncerrado(l)) return false;
    if (termo && !semAcento(`${l.titulo} ${l.contexto} ${l.numero}`).includes(termo)) return false;
    return true;
  });
}

/** As opções dos seletores saem do que existe na tela, não de uma lista fixa. */
export function opcoesDaLista(linhas = []) {
  const responsaveis = new Map();
  const grupos = new Map();
  const situacoes = new Map();
  let temSemResponsavel = false;

  for (const l of linhas) {
    if (l.responsavel_id) responsaveis.set(l.responsavel_id, l.responsavelNome || 'Sem nome');
    else temSemResponsavel = true;
    if (l.grupoChave) grupos.set(l.grupoChave, l.grupo);
    // A situação vem por ORIGEM: "concluida" da mobilização e "fechado" do Adm
    // são estados diferentes de coisas diferentes, e juntá-los num rótulo só
    // faria o filtro esconder metade do que ele promete mostrar.
    situacoes.set(`${l.origem}:${l.status}`, `${l.statusLabel} (${l.origem === 'adm' ? 'chamado' : 'etapa'})`);
  }

  const ordenar = (mapa) => [...mapa].map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  return {
    responsaveis: ordenar(responsaveis),
    grupos: ordenar(grupos),
    situacoes: ordenar(situacoes),
    temSemResponsavel,
  };
}

/** Contagem por origem, para a linha de resumo acima da tabela. */
export function resumoDaLista(linhas = []) {
  return {
    total: linhas.length,
    mobilizacao: linhas.filter((l) => l.origem === 'mobilizacao').length,
    chamados: linhas.filter((l) => l.origem === 'adm').length,
    atrasadas: linhas.filter(estaAtrasada).length,
  };
}
