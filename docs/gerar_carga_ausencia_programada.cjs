/* Gera o SQL de carga da Ausência Programada a partir da planilha do RH.
 *
 *   Entrada: referencia/Controle de Ausência SC e PJ Consolidado 1.xlsx
 *   Saída:   supabase/supabase_import_ausencia_programada.sql
 *
 *   node docs/gerar_carga_ausencia_programada.cjs                 (todos)
 *   node docs/gerar_carga_ausencia_programada.cjs --piloto MAICON (só quem tem
 *        "MAICON" no nome; sai em supabase_import_ausencia_programada_piloto.sql)
 *
 * LAYOUT (aba "PLANILHA MODELO"): linha 2 = cabeçalho, linha 3+ = dados. O
 * `!ref` começa em B, então o índice 0 do array é a coluna B do Excel.
 *
 * COMO A PLANILHA É LIDA
 *  * Cada linha é UM lançamento; a chave do período é (nome, ANO AQUISITIVO
 *    INICIO). Datas do período (L, M) e a data limite (N) vêm do valor já
 *    calculado pelo Excel — inclusive o 31/12/2026 fixo de quem mudou de
 *    modalidade.
 *  * SALDO (O) é corrido e digitado à mão: a primeira linha do período é o
 *    crédito dele (já com a sobra de antes, quando o RH a levou). Esse número
 *    vira `dias_direito`. O saldo do portal passa a ser calculado.
 *  * Linha com INICIO AUSENCIA (Q) vira solicitação APROVADA de origem
 *    'importacao' (a planilha é o controle oficial; agendado lá = aprovado).
 *  * Coluna W (sem título) é observação livre e vai para o período.
 *  * Data inicial = fim do período (regra padrão). Exceção: quando a data
 *    limite cai ANTES do fim (saldo remanescente de mudança de modalidade com
 *    data limite no fim do ano, ex.: "12 residual SC"), os dias já estão
 *    liberados — a data inicial vira o início do período.
 *
 * O QUE NÃO ENTRA (sai no relatório do cabeçalho do SQL, para o RH tratar):
 *  * nome sem colaborador ativo com o mesmo nome no portal (o vínculo entre
 *    as bases é por nome, sem acento e sem diferença de caixa);
 *  * período sem SALDO na primeira linha.
 * E entra, mas é sinalizado: período cujo saldo digitado não bate com a conta
 * (crédito - dias), e período que termina negativo.
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const PLANILHA = 'Controle de Ausência SC e PJ Consolidado 1.xlsx';
const ENTRADA = path.join(RAIZ, 'referencia', PLANILHA);
const ABA = 'PLANILHA MODELO';

// Índices do array (coluna B = 0).
const C = {
  nome: 3, dataRef: 7, anoInicio: 8, inicioPeriodo: 10, fimPeriodo: 11, limite: 12,
  saldo: 13, dias: 14, inicio: 15, fim: 16, obs: 21,
};

/** Serial do Excel -> 'yyyy-mm-dd'. Conta em UTC (a época é 30/12/1899). */
function data(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  return d.toISOString().slice(0, 10);
}

function inteiro(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Mesma normalização do SQL (translate + upper + espaços). */
function normal(nome) {
  return String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

function somarDias(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

/** Data a partir da qual o período pode ser usado (ver cabeçalho). */
function dataInicial(p) {
  return p.limite && p.fim && p.limite < p.fim ? p.inicio : p.fim;
}

/** Agrupa as linhas em períodos, na ordem da planilha. */
function montarPeriodos(linhas) {
  const periodos = new Map();
  for (const r of linhas) {
    const nome = normal(r[C.nome]);
    const ano = inteiro(r[C.anoInicio]);
    if (!nome || ano === null) continue;
    const chave = `${nome}|${ano}`;
    if (!periodos.has(chave)) {
      periodos.set(chave, {
        nome,
        nomeOriginal: String(r[C.nome]).trim(),
        ano,
        inicio: data(r[C.inicioPeriodo]),
        fim: data(r[C.fimPeriodo]),
        limite: data(r[C.limite]),
        credito: inteiro(r[C.saldo]),
        saldosDigitados: [],
        lancamentos: [],
        obs: [],
      });
    }
    const p = periodos.get(chave);
    const saldo = inteiro(r[C.saldo]);
    const dias = inteiro(r[C.dias]);
    const inicio = data(r[C.inicio]);
    p.saldosDigitados.push({ saldo, dias: inicio ? dias : null });
    if (p.credito === null && saldo !== null) p.credito = saldo;
    if (r[C.obs]) p.obs.push(String(r[C.obs]).trim());
    if (inicio && dias && dias > 0) {
      p.lancamentos.push({ inicio, fim: data(r[C.fim]) || somarDias(inicio, dias - 1), dias });
    }
  }
  return [...periodos.values()];
}

/** O saldo digitado linha a linha fecha com "saldo anterior - dias"? */
function saldoCorridoConfere(p) {
  const s = p.saldosDigitados;
  for (let i = 0; i + 1 < s.length; i += 1) {
    if (s[i].saldo === null || s[i + 1].saldo === null) continue;
    if (s[i + 1].saldo !== s[i].saldo - (s[i].dias || 0)) return false;
  }
  return true;
}

function analisar(periodos, nomesPortal) {
  const semColaborador = new Set();
  const semSaldo = [];
  const divergentes = [];
  const negativos = [];
  const validos = [];
  for (const p of periodos) {
    if (!nomesPortal.has(p.nome)) { semColaborador.add(p.nomeOriginal); continue; }
    if (p.credito === null || !p.inicio || !p.fim || !p.limite) { semSaldo.push(p); continue; }
    const usados = p.lancamentos.reduce((t, l) => t + l.dias, 0);
    p.saldoFinal = p.credito - usados;
    if (!saldoCorridoConfere(p)) divergentes.push(p);
    if (p.saldoFinal < 0) negativos.push(p);
    validos.push(p);
  }
  return { semColaborador: [...semColaborador].sort(), semSaldo, divergentes, negativos, validos };
}

// No SQL o nome é normalizado igual ao normal() acima. translate cobre os
// acentos do português; o resto (ñ etc.) não aparece no cadastro.
const SQL_NOME = "regexp_replace(upper(translate(trim(c.nome), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')), '\\s+', ' ', 'g')";

function gerarSql(analise, { piloto }) {
  const { validos, semColaborador, semSaldo, divergentes, negativos } = analise;
  const rel = (titulo, itens) => [
    `--  ${titulo}: ${itens.length}`,
    ...itens.map((t) => `--    - ${t}`),
  ];
  const nomeP = (p) => `${p.nomeOriginal} (${p.ano}/${p.ano + 1})`;

  const per = validos.map((p) => `  (${q(p.nome)}, ${q(p.inicio)}, ${q(p.fim)}, ${q(dataInicial(p))}, ${q(p.limite)}, ${p.credito}, ${q(p.obs.join(' | ') || null)})`);
  const sol = validos.flatMap((p) => p.lancamentos.map((l) => `  (${q(p.nome)}, ${q(p.inicio)}, ${q(l.inicio)}, ${q(l.fim)})`));

  return [
    '-- Carga da Ausência Programada (projeto bogsuuhrgvopzgcceoqz)',
    `-- GERADO por docs/gerar_carga_ausencia_programada.cjs a partir de referencia/${PLANILHA}`,
    `-- ${piloto ? `PILOTO: só nomes com "${piloto}"` : 'Carga completa'}. Não editar à mão: gere de novo.`,
    '-- Rodar DEPOIS de supabase_migration_ausencia_programada.sql. Idempotente:',
    '-- período repetido e lançamento repetido (mesma pessoa e início) são ignorados.',
    '--',
    '-- RELATÓRIO PARA O RH',
    `--  Períodos importados: ${validos.length} · lançamentos: ${sol.length}`,
    ...rel('Nomes sem colaborador ativo no portal (não importados)', semColaborador),
    ...rel('Períodos sem saldo na planilha (não importados)', semSaldo.map(nomeP)),
    ...rel('Saldo digitado não fecha com os dias lançados (conferir)', divergentes.map((p) => `${nomeP(p)}: saldos ${p.saldosDigitados.map((s) => s.saldo ?? '-').join(' → ')}`)),
    ...rel('Períodos que terminam negativos (conferir)', negativos.map((p) => `${nomeP(p)}: ${p.saldoFinal}`)),
    '',
    'begin;',
    '',
    'create temp table _aus_per (nome text, inicio date, fim date, data_inicial date, limite date, credito int, obs text) on commit drop;',
    'create temp table _aus_sol (nome text, periodo_inicio date, inicio date, fim date) on commit drop;',
    '',
    per.length ? `insert into _aus_per values\n${per.join(',\n')};` : '-- (nenhum período)',
    '',
    sol.length ? `insert into _aus_sol values\n${sol.join(',\n')};` : '-- (nenhum lançamento)',
    '',
    'create temp table _aus_colab on commit drop as',
    `  select distinct on (${SQL_NOME}) c.id, ${SQL_NOME} as nome`,
    '  from public.colaboradores c',
    '  where c.ativo is distinct from false',
    `  order by ${SQL_NOME}, c.auth_id is null, c.id;`,
    '',
    'insert into public.ausencia_periodos',
    '  (colaborador_id, inicio_periodo, fim_periodo, data_inicial, data_limite, dias_direito, observacao, origem)',
    'select k.id, p.inicio, p.fim, p.data_inicial, p.limite, p.credito, p.obs, \'importacao\'',
    'from _aus_per p join _aus_colab k on k.nome = p.nome',
    'on conflict (colaborador_id, inicio_periodo) do nothing;',
    '',
    'insert into public.ausencia_solicitacoes',
    '  (colaborador_id, periodo_id, data_inicio, data_fim, status, origem, observacao, decidido_em)',
    "select k.id, ap.id, s.inicio, s.fim, 'aprovada', 'importacao', 'Importado da planilha de controle', now()",
    'from _aus_sol s',
    'join _aus_colab k on k.nome = s.nome',
    'join public.ausencia_periodos ap on ap.colaborador_id = k.id and ap.inicio_periodo = s.periodo_inicio',
    'where not exists (',
    '  select 1 from public.ausencia_solicitacoes x',
    "  where x.colaborador_id = k.id and x.data_inicio = s.inicio and x.origem = 'importacao'",
    ');',
    '',
    'commit;',
    '',
  ].join('\n');
}

function lerPlanilha() {
  const wb = XLSX.readFile(ENTRADA);
  const ws = wb.Sheets[ABA];
  if (!ws) throw new Error(`Aba "${ABA}" não encontrada em ${PLANILHA}.`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }).slice(2);
}

// Nomes do portal: lidos de um arquivo gerado por consulta (um por linha), para
// o relatório não depender de conexão. Sem o arquivo, o relatório de "sem
// colaborador" fica vazio e o SQL continua seguro (o join descarta sozinho).
function lerNomesPortal() {
  const arq = path.join(RAIZ, 'referencia', 'colaboradores_ativos.txt');
  if (!fs.existsSync(arq)) return null;
  return new Set(fs.readFileSync(arq, 'utf8').split(/\r?\n/).map(normal).filter(Boolean));
}

function main() {
  const i = process.argv.indexOf('--piloto');
  const piloto = i > -1 ? normal(process.argv[i + 1]) : null;
  let periodos = montarPeriodos(lerPlanilha());
  if (piloto) periodos = periodos.filter((p) => p.nome.includes(piloto));
  const nomes = lerNomesPortal() || new Set(periodos.map((p) => p.nome));
  const analise = analisar(periodos, nomes);
  const saida = path.join(RAIZ, 'supabase', piloto
    ? 'supabase_import_ausencia_programada_piloto.sql'
    : 'supabase_import_ausencia_programada.sql');
  fs.writeFileSync(saida, gerarSql(analise, { piloto }));
  console.log(`${path.relative(RAIZ, saida)}: ${analise.validos.length} período(s), `
    + `${analise.semColaborador.length} nome(s) sem colaborador, ${analise.semSaldo.length} sem saldo, `
    + `${analise.divergentes.length} com saldo divergente, ${analise.negativos.length} negativo(s).`);
}

if (require.main === module) main();

module.exports = { data, inteiro, normal, dataInicial, montarPeriodos, saldoCorridoConfere, analisar, gerarSql, C };
