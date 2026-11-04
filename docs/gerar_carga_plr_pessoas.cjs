#!/usr/bin/env node
/**
 * Gera supabase/supabase_import_plr_pessoas.sql a partir da aba CALCULO PLR da
 * planilha "Bônus 26.27 Análise final.xlsx" (raiz do repositório).
 *
 * Uso: node docs/gerar_carga_plr_pessoas.cjs [caminho do xlsx]
 *
 * O QUE VAI PARA O BANCO (public.plr_pessoas, ver supabase_migration_plr_calculo.sql)
 *   * Só quem tem Status "Atual": desligado não entra em lugar nenhum.
 *   * Colaborador: COD CT (vira o setor do HUB), cargo, salário e admissão.
 *   * Gerência: só a chave do HUB, de onde o valor vem inteiro. O salário dela
 *     não entra.
 *
 * O arquivo gerado tem salários: está no .gitignore. Rode no SQL Editor (ou pelo
 * MCP) e não versione.
 *
 * Idempotente: pessoa por (ano, nome). Quem saiu da planilha sai do banco. A
 * carga falha inteira se um nome não casar com um login ativo do portal, ou se
 * um COD CT ou cargo não estiver nos mapas abaixo.
 */
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const RAIZ = path.resolve(__dirname, '..');
const ENTRADA = process.argv[2] || path.join(RAIZ, 'Bônus 26.27 Análise final.xlsx');
const SAIDA = path.join(RAIZ, 'supabase', 'supabase_import_plr_pessoas.sql');
const ANO = 2026;

// COD CT → setor do HUB (o `id` em plr_parametro 'setores').
// Decisão do usuário em 04/11/2026: Qualidade é da gerência do Leonardo Drumond e
// BIM é do time do Bruno Azevedo.
const SETOR_DO_CT = {
  'OPER>GLD': 'opleo', 'CSPI>GLD': 'opleo', 'CORP>QUAL': 'opleo', 'OPER>QUAL': 'opleo',
  'OPER>GBA': 'opbru', 'CSPI>GBA': 'opbru', 'OPER>BIM': 'opbru', 'CSPI>BIM': 'opbru',
  'OPER>GEE': 'opedu', 'CSPI>GEE': 'opedu',
  'CORP>ADM': 'adm', 'CORP>TI': 'adm',
  'CORP>RH': 'rh',
  'CORP>COM': 'com',
  'CORP>FIN': 'fin',
  'CORP>MKT': 'mkt',
  'CORP>PMO': 'pmo', 'CORP>INV': 'pmo',
};

// Nome na planilha → chave da pessoa no HUB (plr_pessoa.chave).
const GERENCIA = {
  'PEDRO HENRIQUE BOSCO NERY': 'nery',
  'PEDRO HENRIQUE BRAGA DE MORAIS': 'morais',
  'HENRIQUE DE OLIVEIRA SANTOS': 'henrique',
  'LEONARDO AUGUSTO OLIVEIRA DRUMOND': 'leo',
  'BRUNO ALBERTO AZEVEDO': 'bruno',
  'EDUARDO DOS REIS ELER': 'eduardo',
  'DANIELA TEIXEIRA SEBRIAN': 'daniela',
  'ANDRE LUIZ COSTA GUIMARAES': 'andre',
};

// Cargos da aba "Multiplic. Cargo" (mesma lista de MULT_CARGO em calculo.ts).
const CARGOS = new Set([
  'DIRETOR', 'GER EXEC', 'GERENTE', 'COORDENAÇÃO CORPORATIVA', 'HEAD', 'ESPECIALISTA', 'LIDER',
  'OPERAÇÃO PJ/Cotista', 'OPERAÇÃOCLT',
]);

// Nomes que a planilha escreve diferente do cadastro do portal.
const LOGIN_INFORMADO = {
  'DANIELA TEIXEIRA SEBRIAN': 'daniela.sebrian@phdengenharia.eng.br',
  'GABRIEL GOMES DA SILVA': 'gabriel.silva@phdengenharia.eng.br',
  'JEFERSON MAGALHAES DE SÁ': 'jefferson.magalhaes@phdengenharia.eng.br',
  'MILENA CARIUS DA SILVA NEVES': 'milena.neves@phdengenharia.eng.br',
  'MYLENA ALVES ZOQB': 'mylena.zoqbi@phdengenharia.eng.br',
  'TULIO RAFAEL DE MORAES NEIVA': 'tulio.rafael@phdengenharia.eng.br',
};

const limpo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

const sql = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

function dataIso(v) {
  if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
  // cellDates entrega meia-noite no fuso local: nada de toISOString, que muda o dia.
  const p = (n) => String(n).padStart(2, '0');
  return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
}

const aba = XLSX.readFile(ENTRADA, { cellDates: true }).Sheets['CALCULO PLR'];
if (!aba) throw new Error('Aba CALCULO PLR não encontrada.');

const celula = (coluna, linha) => {
  const c = aba[`${coluna}${linha}`];
  return c && c.t !== 'e' ? c.v : null;
};

const fim = XLSX.utils.decode_range(aba['!ref']).e.r + 1;
const linhas = [];
const problemas = [];
for (let n = 5; n <= fim; n += 1) {
  const nome = limpo(celula('D', n));
  if (!nome || limpo(celula('C', n)) !== 'Atual') continue;

  const cod = limpo(celula('B', n));
  const hub = GERENCIA[nome] ?? null;
  const email = LOGIN_INFORMADO[nome] ?? null;
  if (hub) {
    linhas.push({ nome, cod, setor: null, cargo: null, salario: null, admissao: null, hub, email });
    continue;
  }

  const setor = SETOR_DO_CT[cod];
  const cargo = limpo(celula('G', n));
  const salario = celula('E', n);
  const admissao = dataIso(celula('H', n));
  if (!setor) problemas.push(`${nome}: COD CT "${cod}" sem setor.`);
  if (!CARGOS.has(cargo)) problemas.push(`${nome}: cargo "${cargo}" sem multiplicador.`);
  if (typeof salario !== 'number') problemas.push(`${nome}: salário inválido.`);
  if (!admissao) problemas.push(`${nome}: sem data de admissão.`);
  linhas.push({ nome, cod, setor, cargo, salario, admissao, hub: null, email });
}

const faltando = Object.keys(GERENCIA).filter((nome) => !linhas.some((l) => l.nome === nome));
for (const nome of faltando) problemas.push(`${nome}: é da gerência, mas não está como "Atual" na planilha.`);

if (problemas.length) {
  console.error(problemas.join('\n'));
  process.exit(1);
}

const normal = (x) => `translate(upper(btrim(regexp_replace(${x}, '\\s+', ' ', 'g'))), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN')`;

const valores = linhas.map((l) => `  (${[
  sql(l.nome), sql(l.email), sql(l.cod), sql(l.setor), sql(l.cargo),
  l.salario === null ? 'null::numeric' : l.salario,
  l.admissao === null ? 'null::date' : `${sql(l.admissao)}::date`,
  sql(l.hub),
].join(', ')})`).join(',\n');

const saida = `-- GERADO por docs/gerar_carga_plr_pessoas.cjs. TEM SALÁRIOS: não versione.
-- ${linhas.length} pessoas de ${ANO}. Aplicar depois de supabase_migration_plr_calculo.sql.
begin;

create temporary table plr_carga (
  nome text, email text, cod_ct text, setor_hub text, cargo_plr text,
  salario numeric, data_admissao date, hub_chave text
) on commit drop;

insert into plr_carga values
${valores};

-- Login ativo de cada um: pelo e-mail informado ou pelo nome, sem acento nem
-- espaço sobrando. O cadastro tem nome repetido em linha desativada; só a ativa vale.
create temporary table plr_login on commit drop as
select d.nome, (
         select array_agg(c.id)
           from public.colaboradores c
          where c.ativo is distinct from false
            and (case when d.email is not null then lower(c.email) = d.email
                      else ${normal('c.nome')} = ${normal('d.nome')} end)
       ) as ids
  from plr_carga d;

do $$
declare
  v_sem text;
begin
  select string_agg(l.nome, ', ') into v_sem
    from plr_login l
   where coalesce(cardinality(l.ids), 0) <> 1;
  if v_sem is not null then
    raise exception 'Sem um login ativo único: %', v_sem;
  end if;
end $$;

delete from public.plr_pessoas p
 where p.ano = ${ANO}
   and not exists (select 1 from plr_carga d where d.nome = p.nome);

insert into public.plr_pessoas
  (ano, colaborador_id, nome, cod_ct, setor_hub, cargo_plr, salario, data_admissao, hub_chave)
select ${ANO}, l.ids[1], d.nome, d.cod_ct, d.setor_hub, d.cargo_plr, d.salario, d.data_admissao, d.hub_chave
  from plr_carga d
  join plr_login l on l.nome = d.nome
on conflict (ano, nome) do update
   set colaborador_id = excluded.colaborador_id,
       cod_ct         = excluded.cod_ct,
       setor_hub      = excluded.setor_hub,
       cargo_plr      = excluded.cargo_plr,
       salario        = excluded.salario,
       data_admissao  = excluded.data_admissao,
       hub_chave      = excluded.hub_chave,
       atualizado_em  = now();

commit;
`;

fs.writeFileSync(SAIDA, saida);
console.log(`${linhas.length} pessoas (${linhas.filter((l) => l.hub).length} da gerência) em ${path.relative(RAIZ, SAIDA)}`);
