import { supabase } from '../../../services/supabase';

/**
 * Ficha de ROI do Programa de Inovação 2026 e o Ranking que sai dela.
 *
 * Os cálculos vêm do mockup Programa_Inovacao_2026_ficha.html, e ficam aqui,
 * sem React, porque a mesma conta aparece em três lugares: a ficha (enquanto
 * se digita), o modal de validação e o Ranking.
 *
 * O banco guarda só o que foi digitado. Horas, percentuais e posições são
 * calculados na leitura: a posição de uma ficha depende de todas as outras, e
 * guardá-la deixaria o ranking velho a cada ficha nova.
 */

export const PRAZO_RELATORIO = '30/11/2026';

export const UNIDADES = [
  { valor: 'hora', label: 'horas', horas: 1 },
  { valor: 'minuto', label: 'minutos', horas: 1 / 60 },
  { valor: 'dia', label: 'dias úteis (8h)', horas: 8 },
  { valor: 'semana', label: 'semanas (40h)', horas: 40 },
];

/** As 4 perguntas de facilidade, 0 a 2 pontos cada (nota de 0 a 8). */
export const FACILIDADE = [
  {
    campo: 'fac_desenvolver',
    pergunta: 'Tempo para desenvolver',
    opcoes: [
      { pontos: 2, label: 'Até 1 mês' },
      { pontos: 1, label: '1 a 3 meses' },
      { pontos: 0, label: 'Acima de 3 meses' },
    ],
  },
  {
    campo: 'fac_implantar',
    pergunta: 'Tempo para implantar em outra equipe',
    opcoes: [
      { pontos: 2, label: 'Até 1 semana' },
      { pontos: 1, label: 'Até 1 mês' },
      { pontos: 0, label: 'Mais de 1 mês' },
    ],
  },
  {
    campo: 'fac_treinamento',
    pergunta: 'Treinamento por usuário',
    opcoes: [
      { pontos: 2, label: 'Até 30 min' },
      { pontos: 1, label: 'Até 2 h' },
      { pontos: 0, label: 'Acima de 2 h' },
    ],
  },
  {
    campo: 'fac_autonomia',
    pergunta: 'Autonomia do usuário',
    opcoes: [
      { pontos: 2, label: 'Usa sem apoio' },
      { pontos: 1, label: 'Apoio pontual' },
      { pontos: 0, label: 'Depende de especialista' },
    ],
  },
];

export const VALIDACAO_LABEL = {
  pendente: 'Aguardando validação',
  validada: 'Validada',
  recusada: 'Recusada',
};

/** Pontos por posição em cada critério: 1º 3, 2º 2, 3º 1. */
const PONTOS_POSICAO = { 1: 3, 2: 2, 3: 1 };

// ------------------------------------------------------------------ contas

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const preenchido = (v) => Boolean(String(v ?? '').trim());

/**
 * Economia de tempo. `estado`: pendente (falta dado), revisar (dado
 * incoerente: depois maior que antes, antes zero) ou ok.
 */
export function calcularTempo(f) {
  const antes = num(f.tempo_antes);
  const depois = num(f.tempo_depois);
  const execucoes = num(f.tempo_execucoes);
  const unidade = UNIDADES.find((u) => u.valor === f.tempo_unidade);
  if (antes === null || depois === null || execucoes === null || !unidade) return { estado: 'pendente' };

  const antesH = antes * unidade.horas;
  const depoisH = depois * unidade.horas;
  if (antesH <= 0 || depoisH < 0 || execucoes <= 0 || depoisH > antesH) return { estado: 'revisar' };

  return {
    estado: 'ok',
    horas: (antesH - depoisH) * execucoes,
    reducao: (antesH - depoisH) / antesH,
  };
}

/**
 * Retorno financeiro. "Gasto atual" já exclui o custo da solução, que é
 * descontado à parte — senão entraria duas vezes. Redução sem gasto anterior
 * e ROI sem custo ficam `null` (n.a.), não zero.
 */
export function calcularFinanceiro(f) {
  const antes = num(f.gasto_antes);
  const atual = num(f.gasto_atual);
  const custo = num(f.custo_solucao);
  if (antes === null || atual === null || custo === null) return { estado: 'pendente' };
  if (antes < 0 || atual < 0 || custo < 0) return { estado: 'revisar' };

  const economia = antes - atual - custo;
  if (economia < 0) return { estado: 'revisar' };

  return {
    estado: 'ok',
    economia,
    reducao: antes > 0 ? economia / antes : null,
    roi: custo > 0 ? economia / custo : null,
  };
}

export function notaFacilidade(f) {
  const pontos = FACILIDADE.map((q) => num(f[q.campo]));
  const completa = pontos.every((p) => p !== null);
  return { completa, nota: pontos.reduce((a, p) => a + (p || 0), 0) };
}

/**
 * Elegibilidade ao ranking. Workshop é condição do PROGRAMA, não do
 * preenchimento: sem ele a ficha é enviada do mesmo jeito, só não concorre.
 */
export function elegibilidade(f) {
  if (f.workshop === null || f.workshop === undefined) return 'pendente';
  if (f.workshop === false) return 'nao_elegivel';
  return preenchido(f.workshop_qual) ? 'elegivel' : 'pendente';
}

/** O checklist "Prontidão para avaliação", na ordem da ficha. */
export function prontidao(f) {
  const ini = f.medicao_inicio;
  const fim = f.medicao_fim;
  return [
    {
      chave: 'id',
      label: 'Workshop e problema',
      ok: preenchido(f.problema) && elegibilidade(f) !== 'pendente',
    },
    { chave: 'periodo', label: 'Período de medição', ok: Boolean(ini && fim && fim >= ini) },
    { chave: 'tempo', label: 'Tempo medido', ok: calcularTempo(f).estado === 'ok' },
    { chave: 'fin', label: 'Financeiro medido', ok: calcularFinanceiro(f).estado === 'ok' },
    { chave: 'detalhes', label: 'Detalhamentos', ok: preenchido(f.detalhe_tempo) && preenchido(f.detalhe_financeiro) },
    { chave: 'fac', label: 'Facilidade avaliada', ok: notaFacilidade(f).completa },
  ];
}

export const pendencias = (f) => prontidao(f).filter((c) => !c.ok).length;

/**
 * Situação da ficha numa palavra, para badge de tabela. A ordem importa:
 * validação da equipe vence o preenchimento, e não elegível vence "pronta".
 */
export function situacaoFicha(f) {
  if (!f) return { valor: 'sem_ficha', label: 'Sem ficha', tom: 'tom-recusado' };
  if (f.validacao === 'recusada') return { valor: 'recusada', label: 'Recusada', tom: 'tom-recusado' };
  const falta = pendencias(f);
  if (falta) return { valor: 'incompleta', label: `Em preenchimento · ${falta} pendência(s)`, tom: 'tom-andamento' };
  if (elegibilidade(f) === 'nao_elegivel') return { valor: 'nao_elegivel', label: 'Não elegível (sem workshop)', tom: 'tom-neutro' };
  if (f.validacao === 'validada') return { valor: 'validada', label: 'Validada · no ranking', tom: 'tom-ok' };
  return { valor: 'pendente', label: 'Aguardando validação', tom: 'tom-destaque' };
}

/**
 * Posição de competição ("1, 1, 3"): valores iguais dividem a posição, e a
 * seguinte pula. Valor `null` (n.a.) fica sem posição e sem ponto.
 */
function posicoes(itens, valor) {
  const comValor = itens.filter((i) => valor(i) !== null).sort((a, b) => valor(b) - valor(a));
  const mapa = new Map();
  comValor.forEach((item, idx) => {
    const anterior = comValor[idx - 1];
    const pos = anterior && valor(anterior) === valor(item) ? mapa.get(anterior.id) : idx + 1;
    mapa.set(item.id, pos);
  });
  return mapa;
}

/**
 * Monta o ranking: só ficha VALIDADA, completa e elegível. Em cada critério
 * (redução de custo, redução de tempo, facilidade) o 1º leva 3 pontos, o 2º 2 e
 * o 3º 1. Máximo 9.
 *
 * Empate no total: prevalece quem mais engajou — aqui medido pelos registros
 * do autor no Campo de Ideias, o único dado de engajamento que o sistema tem
 * (o workshop é sim/não). Persistindo o empate, a posição é dividida e a
 * equipe decide; a tela marca o caso.
 *
 * `registros` = linhas do Campo de Ideias (já com autorNome);
 * `fichas` = linhas de programas_roi.
 */
export function montarRanking(registros, fichas) {
  const porIdeia = new Map(registros.map((r) => [r.id, r]));
  const registrosPorAutor = registros.reduce((m, r) => m.set(r.autor_id, (m.get(r.autor_id) || 0) + 1), new Map());

  const itens = fichas
    .filter((f) => f.validacao === 'validada' && pendencias(f) === 0 && elegibilidade(f) === 'elegivel')
    .filter((f) => porIdeia.has(f.ideia_id))
    .map((f) => {
      const registro = porIdeia.get(f.ideia_id);
      return {
        id: f.id,
        ficha: f,
        registro,
        custo: calcularFinanceiro(f).reducao,
        tempo: calcularTempo(f).reducao,
        facilidade: notaFacilidade(f).nota,
        engajamento: registrosPorAutor.get(registro.autor_id) || 0,
      };
    });

  const criterios = {
    custo: posicoes(itens, (i) => i.custo),
    tempo: posicoes(itens, (i) => i.tempo),
    facilidade: posicoes(itens, (i) => i.facilidade),
  };

  const pontuados = itens.map((i) => {
    const pos = {
      custo: criterios.custo.get(i.id) ?? null,
      tempo: criterios.tempo.get(i.id) ?? null,
      facilidade: criterios.facilidade.get(i.id) ?? null,
    };
    const pontos = {
      custo: PONTOS_POSICAO[pos.custo] || 0,
      tempo: PONTOS_POSICAO[pos.tempo] || 0,
      facilidade: PONTOS_POSICAO[pos.facilidade] || 0,
    };
    return { ...i, pos, pontos, total: pontos.custo + pontos.tempo + pontos.facilidade };
  });

  pontuados.sort((a, b) => b.total - a.total
    || b.engajamento - a.engajamento
    || (a.registro.titulo || '').localeCompare(b.registro.titulo || '', 'pt-BR'));

  const igual = (a, b) => a.total === b.total && a.engajamento === b.engajamento;
  return pontuados.reduce((lista, item, idx) => {
    const anterior = lista[idx - 1];
    const outros = pontuados.filter((o) => o !== item && o.total === item.total);
    lista.push({
      ...item,
      posicao: anterior && igual(anterior, item) ? anterior.posicao : idx + 1,
      // Mesmo total, separado pelo engajamento.
      desempatado: outros.length > 0 && !outros.some((o) => igual(o, item)),
      // Mesmo total E mesmo engajamento: a equipe decide.
      empateAberto: outros.some((o) => igual(o, item)),
    });
    return lista;
  }, []);
}

// ------------------------------------------------------------------ dados

const COLUNAS = `
  id, ideia_id, autor_id, workshop, workshop_qual, problema,
  medicao_inicio, medicao_fim,
  tempo_antes, tempo_depois, tempo_unidade, tempo_execucoes, detalhe_tempo,
  gasto_descricao, gasto_antes, gasto_atual, custo_solucao, detalhe_financeiro,
  fac_desenvolver, fac_implantar, fac_treinamento, fac_autonomia,
  validacao, parecer, validado_por, validado_em, criado_em, updated_at
`;

/** Todas as fichas — o Ranking é aberto a todos (RLS: select true). */
export async function listarFichas() {
  const { data, error } = await supabase.from('programas_roi').select(COLUNAS);
  if (error) throw new Error(`Não foi possível carregar as fichas de ROI: ${error.message}`);
  return data || [];
}

export async function buscarFicha(ideiaId) {
  const { data, error } = await supabase
    .from('programas_roi')
    .select(COLUNAS)
    .eq('ideia_id', ideiaId)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível carregar a ficha de ROI: ${error.message}`);
  return data;
}

const texto = (v) => (String(v ?? '').trim() || null);

/** Só o conteúdo: validação é do admin e o trigger recusa qualquer outra mão. */
function linhaDoFormulario(v) {
  return {
    workshop: v.workshop === null || v.workshop === undefined ? null : Boolean(v.workshop),
    workshop_qual: v.workshop ? texto(v.workshop_qual) : null,
    problema: texto(v.problema),
    medicao_inicio: v.medicao_inicio || null,
    medicao_fim: v.medicao_fim || null,
    tempo_antes: num(v.tempo_antes),
    tempo_depois: num(v.tempo_depois),
    tempo_unidade: v.tempo_unidade || null,
    tempo_execucoes: num(v.tempo_execucoes) === null ? null : Math.round(num(v.tempo_execucoes)),
    detalhe_tempo: texto(v.detalhe_tempo),
    gasto_descricao: texto(v.gasto_descricao),
    gasto_antes: num(v.gasto_antes),
    gasto_atual: num(v.gasto_atual),
    custo_solucao: num(v.custo_solucao),
    detalhe_financeiro: texto(v.detalhe_financeiro),
    ...Object.fromEntries(FACILIDADE.map((q) => [q.campo, num(v[q.campo])])),
  };
}

/**
 * Cria ou atualiza a ficha do registro. Salva mesmo incompleta: medir leva
 * semanas, e obrigar tudo de uma vez faria a pessoa perder o que já digitou.
 * Quem separa rascunho de pronta é o checklist (pendencias).
 *
 * UPDATE barrado pela RLS não dá erro no PostgREST, só não afeta linha — por
 * isso a ausência de retorno vira recusa, e não sucesso calado.
 */
export async function salvarFicha(ideiaId, fichaAtual, valores, autorId) {
  const linha = linhaDoFormulario(valores);
  const consulta = fichaAtual
    ? supabase.from('programas_roi').update(linha).eq('id', fichaAtual.id)
    : supabase.from('programas_roi').insert([{ ...linha, ideia_id: ideiaId, autor_id: autorId }]);

  const { data, error } = await consulta.select(COLUNAS).maybeSingle();
  if (error) throw new Error(`Não foi possível salvar a ficha: ${error.message}`);
  if (!data) throw new Error('Você não pode alterar esta ficha. Só quem registrou a solução pode.');
  return data;
}

/** Parecer da equipe de Inovação (admin do módulo). */
export async function validarFicha(ficha, { validacao, parecer }, validadorId) {
  const decidida = validacao !== 'pendente';
  const { data, error } = await supabase
    .from('programas_roi')
    .update({
      validacao,
      parecer: texto(parecer),
      validado_por: decidida ? validadorId : null,
      validado_em: decidida ? new Date().toISOString() : null,
    })
    .eq('id', ficha.id)
    .select(COLUNAS)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível registrar a validação: ${error.message}`);
  if (!data) throw new Error('Só a equipe de Inovação (admin do módulo) valida fichas.');
  return data;
}
