import {
  round2, somar, fmtBRL, fmtNum, diasNoMes, ultimoDiaCompetencia, competenciaRotulo, dataBr,
} from './formato.js';

// Cálculo do envelope de pagamento PJ: proporcionalidade contratual, totais,
// conferência (divergências) e memória de cálculo.
//
// Os objetos seguem os nomes das colunas do banco (pj_prestadores,
// pj_envelopes, pj_eventos, pj_config), sem camada de tradução.

export const EVENTO_BRUTO = '1000';
export const EVENTO_OUTROS_DESCONTOS = '2100';
export const EVENTO_PLANO_SAUDE = '2001';
export const EVENTO_PLANO_ODONTO = '2003';

const SUFIXO_PROPORCIONAL = ' PROPORCIONAL';

export function totaisEventos(eventos = []) {
  const bruto = somar(eventos.filter((e) => e.natureza === 'provento'), 'valor');
  const descontos = somar(eventos.filter((e) => e.natureza === 'desconto'), 'valor');
  return { bruto, descontos, liquido: round2(bruto - descontos) };
}

const noMes = (iso, competencia) => {
  if (!iso) return false;
  return iso >= competencia && iso <= ultimoDiaCompetencia(competencia);
};

const dia = (iso) => Number(String(iso).slice(8, 10));

/**
 * Proporcionalidade do valor contratual na competência.
 *
 * Base "30 dias": o mês comercial — dia 31 conta como 30, e fevereiro também
 * tem 30 (entrada no dia 1 = mês cheio). Base "dias corridos": divisor é o
 * número de dias do mês.
 *
 * O fim do contrato vem do encerramento vigente (se houver) ou de data_fim do
 * cadastro. Encerramento registrado sempre gera proporcional, mesmo com a
 * chave "proporcional no encerramento" desligada — é para isso que ele existe.
 */
export function proporcionalidade({ prestador, competencia, config, eventos = [], encerramento = null }) {
  const divisor = config?.base_proporcional === 'dias_corridos' ? diasNoMes(competencia) : 30;
  const inicio = prestador?.data_inicio || null;
  const encerramentoVigente = encerramento && encerramento.status !== 'cancelado' ? encerramento : null;
  const fim = encerramentoVigente?.data_encerramento || prestador?.data_fim || null;

  const porAdmissao = Boolean(config?.proporcional_admissao) && noMes(inicio, competencia);
  const porEncerramento = (Boolean(config?.proporcional_encerramento) || Boolean(encerramentoVigente))
    && noMes(fim, competencia);

  const primeiro = porAdmissao ? Math.min(dia(inicio), divisor) : 1;
  const ultimo = porEncerramento ? Math.min(dia(fim), divisor) : divisor;
  const diasAtivos = Math.max(0, ultimo - primeiro + 1);

  const ev1000 = eventos.find((e) => e.codigo === EVENTO_BRUTO);
  const valorBase = round2(Number(prestador?.valor_mensal) || Number(ev1000?.valor_original) || Number(ev1000?.valor) || 0);
  const aplica = porAdmissao || porEncerramento;

  let motivo = 'Competência integral';
  if (porAdmissao && porEncerramento) motivo = 'Admissão e encerramento';
  else if (porAdmissao) motivo = 'Admissão';
  else if (porEncerramento) motivo = 'Encerramento';

  return {
    aplica,
    motivo,
    diasAtivos: aplica ? diasAtivos : divisor,
    divisor,
    valorBase,
    valorCalculado: aplica ? round2((valorBase * diasAtivos) / divisor) : valorBase,
    inicio,
    fim,
  };
}

/**
 * Aplica a proporcionalidade no evento 1000.
 *
 * Diferente do protótipo, DESFAZ o proporcional quando ele deixa de valer
 * (ex.: encerramento cancelado): um 1000 marcado como PROPORCIONAL volta ao
 * valor contratual. Evento forçado à mão não é tocado.
 */
export function aplicarProporcional(eventos, prop) {
  return eventos.map((e) => {
    if (e.codigo !== EVENTO_BRUTO || e.forcado) return e;
    const base = String(e.descricao || '').replace(SUFIXO_PROPORCIONAL, '');
    if (prop.aplica) {
      return {
        ...e,
        descricao: `${base}${SUFIXO_PROPORCIONAL}`,
        valor: prop.valorCalculado,
        valor_original: prop.valorBase,
        referencia: prop.diasAtivos,
        origem: `Cadastro contratual • ${prop.motivo}`,
      };
    }
    if (String(e.descricao || '').endsWith(SUFIXO_PROPORCIONAL)) {
      return { ...e, descricao: base, valor: prop.valorBase, valor_original: prop.valorBase, referencia: prop.divisor, origem: 'Cadastro contratual' };
    }
    return e;
  });
}

// ---------------------------------------------------------------------------
// Conferência
// ---------------------------------------------------------------------------

export const TIPOS_DIVERGENCIA = {
  descontos_planilha: 'Total de descontos da planilha',
  bruto_planilha: 'Valor bruto da planilha',
  rateio: 'Rateio do centro de custo',
  plano_sem_beneficio: 'Desconto de plano sem benefício',
};

// Ações que resolvem cada tipo. `ajusta` diz se a ação mexe nos eventos.
export const RESOLUCOES = {
  descontos_planilha: [
    { acao: 'lancar_diferenca', rotulo: 'Lançar a diferença em 2100 (outros descontos)', ajusta: true },
    { acao: 'manter_colunas', rotulo: 'Manter a soma das colunas (a planilha errou o total)' },
  ],
  bruto_planilha: [
    { acao: 'usar_planilha', rotulo: 'Usar o valor da planilha neste mês', ajusta: true },
    { acao: 'manter_contrato', rotulo: 'Manter o valor contratual' },
  ],
  rateio: [
    { acao: 'ciente', rotulo: 'Ciente — o rateio será corrigido no cadastro' },
  ],
  plano_sem_beneficio: [
    { acao: 'confirmar_desconto', rotulo: 'Confirmar o desconto (benefício será cadastrado)' },
  ],
};

/**
 * Regras de conferência do envelope. Cada divergência carrega uma `chave`
 * com o valor encontrado: uma resolução só vale para aquela chave. Se o número
 * mudar depois (novo input, evento editado), a divergência volta.
 */
export function conferir({ eventos = [], prestador, config, planilha = null, rateios = [], resolucoes = [] }) {
  const lista = [];
  const { bruto, descontos } = totaisEventos(eventos);

  if (planilha && Number.isFinite(Number(planilha.descontos_total))) {
    const total = round2(planilha.descontos_total);
    if (Math.abs(total - descontos) > 0.009) {
      lista.push({
        tipo: 'descontos_planilha',
        titulo: 'Total de descontos diferente da soma dos lançamentos',
        detalhe: `A coluna TOTAL DESCONTOS traz ${fmtBRL(total)}, mas os descontos lançados somam ${fmtBRL(descontos)}.`,
        esperado: fmtBRL(total),
        encontrado: fmtBRL(descontos),
        diferenca: round2(total - descontos),
        chave: `descontos_planilha:${total}:${descontos}`,
        sugestao: 'Confira a linha na planilha. Se o total estiver certo, lance a diferença em 2100.',
      });
    }
  }

  if (planilha && Number(planilha.bruto) > 0) {
    const tolerancia = Number(config?.tolerancia_bruto ?? 0.01);
    const valorPlanilha = round2(planilha.bruto);
    if (Math.abs(round2(valorPlanilha - bruto)) > tolerancia) {
      lista.push({
        tipo: 'bruto_planilha',
        titulo: 'Valor bruto da planilha diferente do envelope',
        detalhe: `A planilha traz ${fmtBRL(valorPlanilha)} e o envelope calculou ${fmtBRL(bruto)}.`,
        esperado: fmtBRL(bruto),
        encontrado: fmtBRL(valorPlanilha),
        diferenca: round2(valorPlanilha - bruto),
        chave: `bruto_planilha:${valorPlanilha}:${bruto}`,
        sugestao: 'Pode ser reajuste não cadastrado ou proporcional de admissão/encerramento.',
      });
    }
  }

  if (rateios.length) {
    const total = round2(somar(rateios, 'percentual'));
    if (Math.abs(total - 100) > 0.01) {
      lista.push({
        tipo: 'rateio',
        titulo: 'Rateio não fecha 100%',
        detalhe: `Os centros de custo do prestador somam ${fmtNum(total)} %.`,
        esperado: '100,00 %',
        encontrado: `${fmtNum(total)} %`,
        chave: `rateio:${total}`,
        sugestao: 'Ajuste os percentuais no cadastro ou reimporte o organograma.',
      });
    }
  }

  const planoMedico = eventos.find((e) => e.codigo === EVENTO_PLANO_SAUDE && Number(e.valor) > 0);
  if (planoMedico && prestador && !prestador?.beneficios?.medico?.ativo) {
    lista.push({
      tipo: 'plano_sem_beneficio',
      titulo: 'Desconto de plano de saúde sem benefício cadastrado',
      detalhe: `O envelope desconta ${fmtBRL(planoMedico.valor)} em 2001, mas o prestador não tem plano médico ativo no cadastro.`,
      esperado: 'Plano médico ativo',
      encontrado: fmtBRL(planoMedico.valor),
      codigo: EVENTO_PLANO_SAUDE,
      chave: `plano_sem_beneficio:${round2(planoMedico.valor)}`,
      sugestao: 'Rode a conferência Bradesco ou confirme o desconto.',
    });
  }

  const resolvidas = new Set((resolucoes || []).map((r) => r.chave));
  const divergencias = lista.map((d) => ({ ...d, resolvida: resolvidas.has(d.chave) }));
  const abertas = divergencias.filter((d) => !d.resolvida);
  return { divergencias, abertas, conferencia: abertas.length ? 'divergente' : 'ok' };
}

// Aplica o efeito de uma resolução nos eventos (quando a ação ajusta algo).
export function ajustarPorResolucao(eventos, divergencia, acao, descricao2100 = 'OUTROS DESCONTOS CONTRATUAIS') {
  if (divergencia.tipo === 'descontos_planilha' && acao === 'lancar_diferenca') {
    const dif = Number(divergencia.diferenca) || 0;
    const existente = eventos.find((e) => e.codigo === EVENTO_OUTROS_DESCONTOS);
    if (existente) {
      const valor = round2(Number(existente.valor) + dif);
      return valor > 0.009
        ? eventos.map((e) => (e === existente ? { ...e, valor, origem: 'Ajuste da conferência (total da planilha)' } : e))
        : eventos.filter((e) => e !== existente);
    }
    if (dif <= 0.009) return eventos;
    return [...eventos, {
      codigo: EVENTO_OUTROS_DESCONTOS, descricao: descricao2100, natureza: 'desconto', referencia: 0,
      valor: round2(dif), valor_original: round2(dif), forcado: false, origem: 'Ajuste da conferência (total da planilha)', ordem: 99,
    }];
  }
  if (divergencia.tipo === 'bruto_planilha' && acao === 'usar_planilha') {
    const alvo = round2(Number(divergencia.diferenca) || 0);
    return eventos.map((e) => (e.codigo === EVENTO_BRUTO
      ? { ...e, valor: round2(Number(e.valor) + alvo), forcado: true, origem: 'Valor da planilha (conferência)' }
      : e));
  }
  return eventos;
}

// Termo depois de um cálculo: divergência em aberto bloqueia (se a
// configuração mandar); resolvida, o bloqueio sai sozinho.
export function termoApos({ termoAtual, conferencia, config }) {
  if (conferencia === 'divergente' && config?.bloquear_termo_divergencia !== false) return 'bloqueado';
  if (termoAtual === 'bloqueado') return 'disponivel';
  return termoAtual || 'disponivel';
}

// ---------------------------------------------------------------------------
// Memória de cálculo (vai para pj_calculos.memoria)
// ---------------------------------------------------------------------------

export function memoriaCalculo({ eventos, prop, rateios = [], centros = {} }) {
  const proventos = eventos.filter((e) => e.natureza === 'provento');
  const descontos = eventos.filter((e) => e.natureza === 'desconto');
  const linha = (e, prioridade) => {
    let regra = e.natureza === 'provento'
      ? 'Provento lançado no envelope para a competência'
      : 'Desconto lançado e identificado no envelope';
    let formula = `Lançamento do ${e.natureza} informado: ${fmtBRL(e.valor)}`;
    if (e.codigo === EVENTO_BRUTO && prop?.aplica && !e.forcado) {
      regra = `Proporcionalidade por ${prop.motivo.toLowerCase()} — ${prop.diasAtivos}/${prop.divisor} dias`;
      formula = `${fmtBRL(prop.valorBase)} ÷ ${prop.divisor} dias × ${prop.diasAtivos} dias = ${fmtBRL(e.valor)}`;
    } else if (e.forcado) {
      regra = 'Valor forçado manualmente';
    }
    return { codigo: e.codigo, descricao: e.descricao, natureza: e.natureza, prioridade, regra, formula, origem: e.origem, valor: round2(e.valor) };
  };
  return {
    proporcional: prop ? {
      aplica: prop.aplica, motivo: prop.motivo, diasAtivos: prop.diasAtivos, divisor: prop.divisor,
      valorBase: prop.valorBase, valorCalculado: prop.valorCalculado,
    } : null,
    eventos: [...proventos.map((e, i) => linha(e, i + 1)), ...descontos.map((e, i) => linha(e, 10 + i + 1))],
    rateio: rateios.map((r) => ({ codCt: r.cod_ct, codigoRm: centros[r.cod_ct] || null, percentual: Number(r.percentual) })),
  };
}

/**
 * Calcula um envelope inteiro: proporcional -> totais -> conferência -> termo.
 * Devolve o payload de pj_gravar_envelopes (com `calculo` quando `registrar`).
 */
export function calcularEnvelope({
  envelope, eventos, prestador, config, competencia, encerramento = null, rateios = [], centros = {},
  origem = 'Cálculo do envelope', registrar = true,
}) {
  const prop = proporcionalidade({ prestador, competencia, config, eventos, encerramento });
  const eventosCalc = aplicarProporcional(eventos, prop)
    .map((e, i) => ({ ...e, valor: round2(e.valor), ordem: e.ordem ?? i }));
  const totais = totaisEventos(eventosCalc);
  const conf = conferir({
    eventos: eventosCalc, prestador, config, planilha: envelope?.planilha, rateios, resolucoes: envelope?.resolucoes,
  });
  const mudouValor = envelope && (Math.abs(Number(envelope.bruto) - totais.bruto) > 0.009
    || Math.abs(Number(envelope.descontos) - totais.descontos) > 0.009);

  const payload = {
    prestador_id: prestador.id,
    bruto: totais.bruto,
    descontos: totais.descontos,
    valor_base: prop.valorBase,
    dias_ativos: prop.diasAtivos,
    divisor: prop.divisor,
    proporcional_motivo: prop.motivo,
    conferencia: conf.conferencia,
    divergencias: conf.divergencias,
    termo: termoApos({ termoAtual: mudouValor ? 'disponivel' : envelope?.termo, conferencia: conf.conferencia, config }),
    // Valor mudou depois de gerado o termo: o termo antigo não vale mais.
    envio: mudouValor ? 'nao_enviado' : (envelope?.envio || 'nao_enviado'),
    eventos: eventosCalc.map(({ codigo, descricao, natureza, referencia, valor, valor_original, forcado, origem: o, ordem }) => ({
      codigo, descricao, natureza, referencia: Number(referencia) || 0, valor, valor_original: valor_original ?? valor,
      forcado: Boolean(forcado), origem: o, ordem,
    })),
  };
  if (registrar) {
    payload.calculo = {
      origem,
      bruto_anterior: envelope?.calculado_em ? Number(envelope.bruto) : null,
      rateio_total: rateios.length ? somar(rateios, 'percentual') : null,
      memoria: memoriaCalculo({ eventos: eventosCalc, prop, rateios, centros }),
    };
  }
  return { payload, prop, totais, conferencia: conf };
}

// ---------------------------------------------------------------------------
// Encerramento
// ---------------------------------------------------------------------------

export function validarEncerramento({ dados, prestador, competencia }) {
  const obrig = ['data_calculo', 'data_encerramento', 'data_pagamento', 'data_ultimo_movimento'];
  if (obrig.some((k) => !dados[k])) return 'Confira as datas: todas são obrigatórias e no formato DD/MM/AAAA.';
  if (String(dados.motivo || '').trim().length < 5) return 'Informe o motivo do encerramento.';
  if (prestador?.data_inicio && dados.data_encerramento < prestador.data_inicio) {
    return `O encerramento não pode ser antes do início do contrato (${dataBr(prestador.data_inicio)}).`;
  }
  if (!noMes(dados.data_encerramento, competencia)) {
    return `O encerramento precisa cair dentro da competência ${competenciaRotulo(competencia)}.`;
  }
  if (dados.data_ultimo_movimento > dados.data_encerramento) {
    return 'O último movimento não pode ser depois do encerramento.';
  }
  return null;
}

export function calcularEncerramento({ dados, prestador, competencia, config, eventos = [] }) {
  const prop = proporcionalidade({
    prestador, competencia, config, eventos,
    encerramento: { data_encerramento: dados.data_encerramento, status: 'programado' },
  });
  const descontos = somar(eventos.filter((e) => e.natureza === 'desconto'), 'valor');
  const percentual = Number(config?.indenizacao_percentual) || 0;
  const valorIndenizacao = dados.indenizacao ? round2((prop.valorBase * percentual) / 100) : 0;
  return {
    diasAtivos: prop.diasAtivos,
    divisor: prop.divisor,
    valorBase: prop.valorBase,
    valorProporcional: prop.valorCalculado,
    valorIndenizacao,
    indenizacaoPercentual: dados.indenizacao ? percentual : null,
    descontos,
    liquido: round2(prop.valorCalculado - descontos + valorIndenizacao),
  };
}

export const statusEncerramento = (dataEncerramento, hojeIso = new Date().toISOString().slice(0, 10)) =>
  (dataEncerramento > hojeIso ? 'programado' : 'encerrado');

export function substituirAssunto(assunto, competencia) {
  return String(assunto || '').replace(/\{\{\s*competencia\s*\}\}/gi, competenciaRotulo(competencia));
}
