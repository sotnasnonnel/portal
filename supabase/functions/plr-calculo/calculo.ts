// deno-lint-ignore-file no-explicit-any

// O PLR de cada pessoa, pela regra da aba CALCULO PLR da planilha "Bônus 26.27
// Análise final", com a % do setor vinda do HUB:
//
//   Multiplicador empresa = o de Editar resultados (75% até alguém mudar), igual para todos
//   Valor % setor        = % do setor no HUB × Metas setor (25%)
//   Multiplicador total   = Multiplicador empresa + Valor % setor
//   Multiplicador final   = tempo × cargo × Multiplicador total
//   Valor final           = Multiplicador final × salário
//
// O multiplicador da empresa não depende do Fator PLR corporativo (pedido do
// usuário em 04/11/2026), nem do gatilho da margem, que só zera o fator.
//
// A gerência (quem tem hub_chave) não passa por esta conta: o valor dela vem
// inteiro do HUB, como a tela de lá mostra, com o fator da base de projeção de
// fechamento. O fator da base YTD não entra: com a margem acumulada abaixo do
// corte do gatilho, ele daria zero.
//
// Sem dependência de Deno: calculo.test.ts roda no `node --test`.

import { calc, corpFator, montarDados, respOf, setorScore, TRIGGER_CORTE, type Base } from "./motorHub.ts";

// Sem linha em plr_config para o ano. Mesmo valor do coalesce da RPC plr_mult_empresa.
export const MULT_EMPRESA_PADRAO = 0.75;
export const METAS_SETOR = 0.25;
// Quem ficou menos que isto no ano não recebe (coluna TEMPO TR da planilha).
export const MESES_MINIMOS = 4;

const BASE_DO_FATOR: Base = "proj";

// Aba "Multiplic. Cargo" da planilha, coluna 2026.
export const MULT_CARGO: Record<string, number> = {
  "DIRETOR": 2.5,
  "GER EXEC": 2.5,
  "GERENTE": 2.5,
  "COORDENAÇÃO CORPORATIVA": 1.3,
  "HEAD": 1.3,
  "ESPECIALISTA": 1.15,
  "LIDER": 1.15,
  "OPERAÇÃO PJ/Cotista": 1,
  "OPERAÇÃOCLT": 0.6,
};

/** DAYS360(inicio; fim; VERDADEIRO) do Excel: método europeu, datas 'AAAA-MM-DD'. */
export function dias360(inicio: string, fim: string): number {
  const [a1, m1, d1] = inicio.split("-").map(Number);
  const [a2, m2, d2] = fim.split("-").map(Number);
  return (a2 - a1) * 360 + (m2 - m1) * 30 + (Math.min(d2, 30) - Math.min(d1, 30));
}

/** A data seguinte, em 'AAAA-MM-DD'. Em UTC, para o fuso não mudar o dia. */
function diaSeguinte(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * Meses que contam no ano (coluna TEMPO TR): de janeiro, ou da admissão, até o
 * fim do ano ou, para o desligado, até o dia da demissão inclusive. Em duas casas.
 * Abaixo de 4 meses vira zero. A parte da fórmula que zera quem saiu por iniciativa
 * própria não está aqui porque esses não vêm na carga.
 */
export function mesesNoAno(dataAdmissao: string, ano: number, dataDemissao: string | null = null): number {
  const janeiro = `${ano}-01-01`;
  const inicio = dataAdmissao > janeiro ? dataAdmissao : janeiro;
  const fim = dataDemissao ? diaSeguinte(dataDemissao) : `${ano + 1}-01-01`;
  const meses = Math.round((Math.max(0, dias360(inicio, fim)) / 30) * 100) / 100;
  return meses < MESES_MINIMOS ? 0 : meses;
}

/** A conta da planilha para um colaborador. Sem salário: valor null. */
export function multiplicadores(
  { multEmpresa, setorPct, meses, multCargo, salario }:
  { multEmpresa: number; setorPct: number; meses: number; multCargo: number; salario: number | null },
) {
  const valorSetor = setorPct * METAS_SETOR;
  const multTotal = multEmpresa + valorSetor;
  const multFinal = (meses / 12) * multCargo * multTotal;
  return { multEmpresa, valorSetor, multTotal, multFinal, valor: salario === null ? null : multFinal * salario };
}

const soma = (itens: any[], f: (i: any) => number | null) => itens.reduce((a, i) => a + (f(i) ?? 0), 0);

/** O mesmo corte de plr_pessoas_visiveis: só sai quem está desativado no cadastro. */
export const soAtivas = (linhas: any[]) => linhas.filter((p) => p.colaboradores?.ativo !== false);

/** O que o HUB recebe: só agregados, nunca nome ou salário de alguém. */
export function resumoParaHub(r: ReturnType<typeof montarResultado>) {
  return {
    ano: r.ano,
    total: r.totais.colaboradores,
    pessoas: r.colaboradores.length,
    multEmpresa: r.multEmpresa,
    ytdAte: r.ytdAte,
    foraDaConta: r.problemas.length,
  };
}

/**
 * Junta as pessoas do portal (o que a pessoa logada pode ver, vindo da RPC
 * plr_pessoas_visiveis) com os parâmetros e executivos do HUB, e devolve o que
 * a tela mostra. Quem chamou só recebe o que já estava em `pessoas`: os dados
 * do HUB de quem não está na lista não saem daqui.
 */
export function montarResultado(
  { ano, papel, veTodos, multEmpresa, pessoas, parametros, pessoasHub }:
  { ano: number; papel: string; veTodos: boolean; multEmpresa: number; pessoas: any[]; parametros: any[]; pessoasHub: any[] },
) {
  const D = montarDados(parametros, pessoasHub);
  const problemas: string[] = [];

  // Só a gerência depende do fator: daqui sai o aviso de gatilho dela.
  const cf = corpFator(D, BASE_DO_FATOR);

  const setoresHub = new Map<string, any>(D.setores.map((s: any) => [s.id, s]));
  const pessoasDoHub = new Map<string, any>(D.pessoas.map((p: any) => [p.chave, p]));

  const colaboradores: any[] = [];
  const gerencia: any[] = [];

  for (const p of pessoas) {
    if (p.hub_chave) {
      const h = pessoasDoHub.get(p.hub_chave);
      if (!h) {
        problemas.push(`${p.nome}: não encontrada no HUB (chave ${p.hub_chave}).`);
        continue;
      }
      const c = calc(D, h, BASE_DO_FATOR);
      gerencia.push({
        id: p.id,
        nome: p.nome,
        cargo: h.cargo,
        salario: h.salario,
        fator: c.P.pct,
        plr: c.r.plr,
        bonus: c.r.bon + c.r.sup,
        variavel: c.V ? c.r.var : null,
        total: c.r.total,
        bonusZerado: c.B.block,
      });
      continue;
    }

    const setor = setoresHub.get(p.setor_hub);
    const multCargo = MULT_CARGO[p.cargo_plr];
    if (!setor) {
      problemas.push(`${p.nome}: setor "${p.setor_hub ?? ""}" não existe no HUB.`);
      continue;
    }
    if (multCargo === undefined) {
      problemas.push(`${p.nome}: cargo "${p.cargo_plr}" sem multiplicador.`);
      continue;
    }
    const setorPct = setorScore(setor);
    const meses = mesesNoAno(p.data_admissao, ano, p.data_demissao ?? null);
    const salario = p.salario === null || p.salario === undefined ? null : Number(p.salario);
    colaboradores.push({
      id: p.id,
      nome: p.nome,
      cod_ct: p.cod_ct,
      cargo: p.cargo_plr,
      dataDemissao: p.data_demissao ?? null,
      setorId: setor.id,
      setorNome: setor.nome,
      setorPct,
      salario,
      meses,
      multTempo: meses / 12,
      multCargo,
      ...multiplicadores({ multEmpresa, setorPct, meses, multCargo, salario }),
    });
  }

  // Na ordem da lista de setores do HUB, e só os que têm gente visível.
  const setores = D.setores
    .map((s: any) => {
      const dele = colaboradores.filter((c) => c.setorId === s.id);
      const pct = setorScore(s);
      return {
        id: s.id,
        nome: s.nome,
        responsavel: respOf(D, s.id)?.nome ?? null,
        pct,
        valorSetor: pct * METAS_SETOR,
        multTotal: multEmpresa + pct * METAS_SETOR,
        pessoas: dele.length,
        valor: soma(dele, (c) => c.valor),
      };
    })
    .filter((s: any) => s.pessoas > 0);

  const doTime = soma(colaboradores, (c) => c.valor);
  const daGerencia = soma(gerencia, (g) => g.total);

  const datas = parametros
    .filter((p) => p.chave === "painel" || p.chave === "setores")
    .map((p) => p.atualizado_em)
    .filter(Boolean)
    .sort();

  return {
    ano,
    papel,
    veTodos,
    metasSetor: METAS_SETOR,
    corteGatilho: TRIGGER_CORTE,
    ytdAte: D.automaticos?.ate ?? null,
    atualizadoEm: datas[datas.length - 1] ?? null,
    multEmpresa,
    gatilho: cf.trig,
    margemDaMeta: cf.mol?.ratio ?? null,
    setores,
    colaboradores,
    gerencia,
    totais: { colaboradores: doTime, gerencia: daGerencia, geral: doTime + daGerencia },
    // Nome e motivo de quem ficou de fora: só quem vê todo mundo precisa saber.
    problemas: veTodos ? problemas : [],
  };
}
