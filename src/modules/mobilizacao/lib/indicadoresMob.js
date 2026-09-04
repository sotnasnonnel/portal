import { ehEncerrada, estaAberta } from './statusEtapa.js';
import { estaAtrasada } from './painelEtapas.js';

/**
 * Indicadores da Mobilização.
 *
 * Lógica pura — sem Supabase, sem React — para poder ser testada. A tela só
 * desenha o que sai daqui.
 *
 * Espelha a FORMA do painel do Adm (`pct: null` quando não há o que medir,
 * "sem prazo" visível de propósito, atraso só do que ainda está em jogo), mas
 * mede outra coisa: lá a unidade é o chamado, aqui é a ETAPA. O recorte que a
 * planilha nunca deu — e que é a razão de existir do módulo — é o ranking por
 * etapa: qual passo trava o processo, sempre.
 *
 * O que estes números cobrem depende do que a RLS entrega a quem está olhando:
 * o time do Adm vê tudo, e quem só responde por uma etapa vê os processos dele.
 * Os números são "do que eu enxergo", nunca uma verdade global — a tela precisa
 * dizer isso.
 */

/**
 * Etapa vencida AGORA — vem de painelEtapas, que e onde o quadro e a fila
 * tambem a consultam. Duas definicoes de "esta atrasada" fariam o card do
 * indicador discordar do que o quadro pinta de vermelho.
 */
export { estaAtrasada } from './painelEtapas.js';

/**
 * Concluiu dentro do prazo?
 *
 * @returns {boolean|null} null quando não dá para dizer — etapa ainda aberta,
 *   dispensada, ou sem prazo. Contar "sem prazo" como cumprido inflaria o
 *   indicador justamente onde falta configuração.
 */
export function concluiuNoPrazo(e) {
  if (e?.status !== 'concluida') return null;
  if (e.dias_atraso === null || e.dias_atraso === undefined) return null;
  return Number(e.dias_atraso) <= 0;
}

/** Agrupa e ordena do maior para o menor, com desempate estável pelo nome. */
function contarPor(itens, chave) {
  const mapa = new Map();
  for (const i of itens) {
    const k = chave(i);
    if (!k) continue;
    mapa.set(k, (mapa.get(k) || 0) + 1);
  }
  return [...mapa.entries()]
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => (b.total - a.total) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Painel completo.
 *
 * @param etapas [{ status, titulo, fluxo, dias_atraso, responsavelNome, processo_id }]
 * @param processos [{ status, fluxo }]
 */
export function resumoIndicadores(etapas = [], processos = []) {
  const abertas = etapas.filter(estaAberta);
  const concluidas = etapas.filter((e) => e.status === 'concluida');

  // Cumprimento de prazo: só entram as que dá para julgar. `semPrazo` fica
  // visível para a lacuna de configuração não sumir dentro de uma porcentagem.
  let noPrazo = 0;
  let fora = 0;
  let semPrazo = 0;
  for (const e of concluidas) {
    const v = concluiuNoPrazo(e);
    if (v === null) semPrazo += 1;
    else if (v) noPrazo += 1;
    else fora += 1;
  }
  const medidas = noPrazo + fora;

  const atrasadas = etapas.filter(estaAtrasada);

  return {
    processos: {
      total: processos.length,
      emAndamento: processos.filter((p) => p.status === 'em_andamento').length,
      finalizados: processos.filter((p) => p.status === 'finalizado').length,
      cancelados: processos.filter((p) => p.status === 'cancelado').length,
      // Processo com pelo menos uma etapa vencida. É o número que responde
      // "quantas mobilizações estão em apuros", que não é o mesmo que "quantas
      // etapas estão vencidas" — uma mobilização pode travar em três passos.
      atrasados: new Set(atrasadas.map((e) => e.processo_id)).size,
    },
    etapas: {
      total: etapas.length,
      abertas: abertas.length,
      concluidas: concluidas.length,
      dispensadas: etapas.filter((e) => e.status === 'dispensada').length,
      semDono: abertas.filter((e) => !e.responsavel_id).length,
      atrasadas: atrasadas.length,
    },
    prazo: {
      medidas,
      noPrazo,
      fora,
      semPrazo,
      // Média de nada não é zero — zero significaria "nenhuma cumpriu".
      pct: medidas ? Math.round((noPrazo / medidas) * 100) : null,
    },
    abertasPorFluxo: contarPor(abertas, (e) => e.fluxoLabel || e.fluxo),
    abertasPorStatus: contarPor(abertas, (e) => e.status),
    atrasadasPorResponsavel: contarPor(atrasadas, (e) => e.responsavelNome || 'Sem responsável'),
    // O achado que a planilha nunca deu: onde o processo trava sempre.
    gargalos: gargalosPorEtapa(etapas),
  };
}

/**
 * Ranking das etapas por atraso.
 *
 * `atrasoMedio` sai só das que já foram concluídas: incluir as abertas faria a
 * média subir todo dia sozinha, e a etapa recém-criada entraria puxando para
 * baixo. `abertasAtrasadas` mostra a dor de agora, e as duas juntas separam
 * "esse passo sempre demora" de "esse passo está travado hoje".
 */
export function gargalosPorEtapa(etapas = []) {
  const mapa = new Map();
  for (const e of etapas) {
    const nome = e.titulo || e.codigo;
    if (!nome) continue;
    if (!mapa.has(nome)) {
      mapa.set(nome, { nome, total: 0, concluidas: 0, somaAtraso: 0, foraDoPrazo: 0, abertasAtrasadas: 0 });
    }
    const linha = mapa.get(nome);
    linha.total += 1;
    if (e.status === 'concluida' && e.dias_atraso !== null && e.dias_atraso !== undefined) {
      linha.concluidas += 1;
      linha.somaAtraso += Number(e.dias_atraso);
      if (Number(e.dias_atraso) > 0) linha.foraDoPrazo += 1;
    }
    if (estaAtrasada(e)) linha.abertasAtrasadas += 1;
  }

  return [...mapa.values()]
    .map((l) => ({
      ...l,
      atrasoMedio: l.concluidas ? Math.round((l.somaAtraso / l.concluidas) * 10) / 10 : null,
    }))
    .sort((a, b) => (b.foraDoPrazo + b.abertasAtrasadas) - (a.foraDoPrazo + a.abertasAtrasadas)
      || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Faixa de cor do percentual de cumprimento, igual à do Adm. */
export const faixaPct = (pct) => {
  if (pct === null || pct === undefined) return 'vazio';
  if (pct >= 90) return 'alta';
  if (pct >= 70) return 'media';
  return 'baixa';
};

/** Formata um percentual que pode não existir. */
export const formatarPct = (pct) => (pct === null || pct === undefined ? '—' : `${pct}%`);

/** Ordena as etapas de um processo do jeito que o passo a passo se lê. */
export const porOrdem = (etapas = []) => [...etapas].sort((a, b) => a.ordem - b.ordem);

export { ehEncerrada };

/**
 * Detalhe do card "Etapas vencidas": as etapas em atraso, da pior para a menos
 * pior. Um numero num card so vira acao quando da para responder "quais?" — e
 * o ranking por atraso e a ordem em que alguem vai atacar a lista.
 */
export function etapasVencidas(etapas = []) {
  return etapas.filter(estaAtrasada)
    .sort((a, b) => (Number(b.dias_atraso) - Number(a.dias_atraso))
      || String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR'));
}

/**
 * Detalhe do card "Processos travados": um processo por linha, com quantas
 * etapas dele estao vencidas e qual o pior atraso.
 *
 * Agrupa por processo de proposito: o card conta PROCESSOS, e uma mobilizacao
 * travada em tres passos continua sendo uma mobilizacao. Listar as etapas soltas
 * aqui faria o detalhe nao bater com o numero do card.
 */
export function processosTravados(etapas = [], processos = []) {
  const porId = new Map(processos.map((p) => [p.id, p]));
  const mapa = new Map();

  for (const e of etapasVencidas(etapas)) {
    if (!mapa.has(e.processo_id)) {
      const p = porId.get(e.processo_id) || {};
      mapa.set(e.processo_id, {
        id: e.processo_id,
        numero: p.numero ?? e.processo?.numero,
        titulo: p.titulo || e.processo?.titulo || e.processoTitulo,
        fluxo: p.fluxo || e.fluxo,
        etapas: [],
        piorAtraso: 0,
      });
    }
    const linha = mapa.get(e.processo_id);
    linha.etapas.push(e);
    linha.piorAtraso = Math.max(linha.piorAtraso, Number(e.dias_atraso) || 0);
  }

  return [...mapa.values()].sort((a, b) => (b.piorAtraso - a.piorAtraso)
    || (b.etapas.length - a.etapas.length));
}
