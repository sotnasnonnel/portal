#!/usr/bin/env node
/**
 * Gera supabase/supabase_import_fechamento_pj.sql a partir do protótipo
 * pj_fechamento.html (raiz do repositório).
 *
 * Uso: node docs/gerar_carga_fechamento_pj.cjs [caminho do html]
 *
 * O QUE VAI PARA O BANCO
 *   * Prestadores: os 55 do fechamento 07/2026 (constante `zb` do bundle), com o
 *     overlay de perfil (`Gb`) e a contabilidade Montservice (`p1`); mais quem
 *     aparece só no histórico 01–07/2026 (entra como desligado) ou só no
 *     layout TOTVS 08/2026 (ENTRADA, entra como ativo).
 *   * Benefício médico e dependentes (nomes) dos prestadores de 07/2026.
 *   * Histórico 01–07/2026 (PLANILHA_ROWS): competências FECHADAS, origem
 *     'historico', um envelope por prestador só com totais e o cadastro
 *     congelado. A Folha Analítica concilia a falta de eventos (1000/2100).
 *   * Fornecedores TOTVS RM: ENTRADA (ligados ao prestador), SUPPLIERS que não
 *     estão na ENTRADA (sem prestador) e o cadastro completo da MVF.
 *   * Centros de custo (COD CT -> código RM) e rateio 08/2026 (EMBEDDED do
 *     script phd-cost-center-script).
 *
 * O QUE NÃO VAI
 *   * Os dados de demonstração do protótipo (OCR da pasta, Bradesco de exemplo,
 *     organograma "referência" de 8 linhas).
 *   * A competência 08/2026 — abre-se no app, em "Abrir competência", para ela
 *     nascer pelo mesmo caminho das próximas.
 *
 * O arquivo gerado tem CPF e dados bancários: está no .gitignore. Rode no SQL
 * Editor (ou pelo MCP) e não versione.
 *
 * Idempotente: prestador por `codigo`, fornecedor por `codigo_rm`/prestador,
 * envelope por (competência, prestador), centro de custo por `cod_ct`.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '..');
const HTML = process.argv[2] || path.join(RAIZ, 'pj_fechamento.html');
const SAIDA = path.join(RAIZ, 'supabase', 'supabase_import_fechamento_pj.sql');

const html = fs.readFileSync(HTML, 'utf8');

// ---------------------------------------------------------------------------
// Extração
// ---------------------------------------------------------------------------

// Lê o literal que começa em `inicio` (um [ ou {) até o fechamento correspondente.
function literalEm(texto, inicio) {
  const abre = texto[inicio];
  const fecha = abre === '[' ? ']' : '}';
  let nivel = 0;
  let aspas = null;
  for (let i = inicio; i < texto.length; i += 1) {
    const c = texto[i];
    if (aspas) {
      if (c === '\\') i += 1;
      else if (c === aspas) aspas = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') aspas = c;
    else if (c === abre) nivel += 1;
    else if (c === fecha) {
      nivel -= 1;
      if (nivel === 0) return texto.slice(inicio, i + 1);
    }
  }
  throw new Error('Literal sem fechamento');
}

function constante(nome, { prefixos = [`const ${nome}=`, `const ${nome} =`, `${nome}=`] } = {}) {
  for (const p of prefixos) {
    const re = new RegExp(`(^|[^A-Za-z0-9_$])${p.replace(/[$[\]()]/g, '\\$&')}`);
    const m = re.exec(html);
    if (!m) continue;
    let i = m.index + m[0].length;
    while (/\s/.test(html[i])) i += 1;
    if (html[i] === 'n' && html.startsWith('new Set(', i)) i += 'new Set('.length;
    if (html[i] !== '[' && html[i] !== '{') continue;
    return vm.runInNewContext(`(${literalEm(html, i)})`);
  }
  throw new Error(`Constante ${nome} não encontrada`);
}

const ZB = constante('zb');
const GB = constante('Gb');
const P1 = new Set(constante('p1'));
const ROWS = constante('PLANILHA_ROWS');
const ENTRADA = constante('ENTRADA');
const SUPPLIERS = constante('SUPPLIERS');
const MVF = constante('MVF');
const EMBEDDED = constante('EMBEDDED');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
const up = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
const vazio = (v) => v == null || ['', 'NAO INFORMADO', '—', '-'].includes(norm(v));
const txt = (v) => (vazio(v) ? null : String(v).trim());
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v == null || !Number.isFinite(Number(v)) ? 'null' : String(r2(v)));
const j = (v) => `${q(JSON.stringify(v))}::jsonb`;
const b = (v) => (v ? 'true' : 'false');
const dataIso = (br) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br ?? '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const compIso = (mmaaaa) => {
  const m = /^(\d{2})\/(\d{4})$/.exec(String(mmaaaa ?? '').trim());
  return m ? `${m[2]}-${m[1]}-01` : null;
};
const empresa = (s) => (norm(s).includes('ENGENHARIA') ? 'PHD ENGENHARIA' : 'PHD ASSESSORIA');
const digitos = (s) => String(s ?? '').replace(/\D/g, '');

// ---------------------------------------------------------------------------
// Prestadores
// ---------------------------------------------------------------------------

const prestadores = new Map(); // chave: nome normalizado
let proximoCodigo = 1;
const novoCodigo = () => String(proximoCodigo++).padStart(6, '0');

ZB.forEach((z, i) => {
  const codigo = String(i + 1).padStart(6, '0');
  proximoCodigo = Math.max(proximoCodigo, i + 2);
  const overlay = (GB[codigo] && norm(GB[codigo].name) === norm(z.name))
    ? GB[codigo]
    : Object.values(GB).find((g) => norm(g.name) === norm(z.name));
  const pf = overlay?.profile || {};
  const titular = z.healthRows || [];
  const dependentes = titular.filter((h) => h.holderType === 'Dependente').map((h) => ({
    nome: up(h.name), cpf: null, nascimento: null, situacao: 'Não conferido na base ativa',
    fonte: 'Conferência Saúde 07/2026 (carga do protótipo)', beneficio: 'Plano Médico',
  }));
  prestadores.set(norm(overlay?.name || z.name), {
    codigo,
    nome: up(overlay?.name || z.name),
    empresa: empresa(z.company),
    email: txt(overlay?.email || z.email),
    situacao: 'ativo',
    razao_social: txt(up(z.legalName)),
    cnpj: txt(z.cnpj),
    cpf: txt(pf.cpf || z.cpf),
    rg: txt(pf.rg),
    data_nascimento: dataIso(pf.birthDate),
    sexo: ['M', 'F'].includes(pf.sex) ? pf.sex : null,
    telefone: txt(pf.phone),
    email_pessoal: txt(z.email),
    municipio: txt(pf.city),
    uf: txt(pf.state),
    modalidade: txt(pf.contractType) || 'CNPJ',
    data_inicio: dataIso(pf.startDate || overlay?.admission),
    data_fim: dataIso(pf.endDate),
    funcao: txt(up(pf.serviceRole || z.serviceRole)),
    projeto: txt(up(pf.project)),
    gestor: txt(pf.manager),
    secao_codigo: txt(up(pf.sectionCode)),
    secao_nome: txt(up(pf.sectionName)),
    valor_mensal: r2(z.gross),
    banco: txt(z.bank),
    banco_codigo: txt(z.bankCode),
    agencia: txt(z.agency),
    conta: txt(z.account),
    contabilidade: P1.has(norm(z.name)) ? 'Montservice' : 'Externo',
    beneficios: titular.length ? {
      medico: {
        ativo: true,
        plano: titular.find((h) => h.plan)?.plan || 'Plano Médico Bradesco',
        valor: r2(titular.reduce((s, h) => s + (Number(h.value) || 0), 0)),
        vidas: titular.length,
        fonte: 'Conferência Saúde 07/2026 (carga do protótipo)',
        atualizadoEm: '2026-07-31',
      },
    } : {},
    dependentes,
  });
});

// Histórico: quem não está no 07/2026 do bundle.
const ultimaLinha = new Map();
ROWS.forEach((r) => {
  const k = norm(r.name);
  const atual = ultimaLinha.get(k);
  if (!atual || compIso(r.competence) > compIso(atual.competence)) ultimaLinha.set(k, r);
});
ultimaLinha.forEach((r, k) => {
  if (prestadores.has(k)) return;
  prestadores.set(k, {
    codigo: null, nome: up(r.name), empresa: 'PHD ASSESSORIA', email: txt(r.email),
    situacao: r.competence === '07/2026' ? 'ativo' : 'desligado',
    razao_social: txt(up(r.legalName)), cnpj: txt(r.cnpj), valor_mensal: r2(r.gross),
    contabilidade: P1.has(k) ? 'Montservice' : 'Externo', beneficios: {}, dependentes: [],
  });
});

// Layout TOTVS 08/2026: quem entrou em agosto.
ENTRADA.forEach((e) => {
  const k = norm(e.collaborator);
  const p = prestadores.get(k);
  if (p) {
    p.empresa = empresa(e.company);
    if (!p.razao_social) p.razao_social = txt(up(e.legalName));
    if (!p.cnpj) p.cnpj = txt(e.cnpj);
    if (p.situacao === 'desligado') p.situacao = 'ativo';
    return;
  }
  prestadores.set(k, {
    codigo: null, nome: up(e.collaborator), empresa: empresa(e.company), situacao: 'ativo',
    razao_social: txt(up(e.legalName)), cnpj: txt(e.cnpj), valor_mensal: r2(e.gross),
    contabilidade: P1.has(k) ? 'Montservice' : 'Externo', beneficios: {}, dependentes: [],
  });
});

[...prestadores.values()]
  .filter((p) => !p.codigo)
  .sort((a, b2) => a.nome.localeCompare(b2.nome))
  .forEach((p) => { p.codigo = novoCodigo(); });

const porNome = prestadores;
const codigoDe = (nome) => porNome.get(norm(nome))?.codigo;

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const out = [];
const add = (s) => out.push(s);

add(`-- Import: Fechamento PJ — carga inicial do protótipo
-- ============================================================================
-- GERADO por docs/gerar_carga_fechamento_pj.cjs em ${new Date().toISOString().slice(0, 10)}.
-- NÃO EDITAR À MÃO e NÃO VERSIONAR (tem CPF e dados bancários).
--
-- ${prestadores.size} prestadores • ${ROWS.length} linhas de histórico (01–07/2026)
-- ${ENTRADA.length} fornecedores da ENTRADA + ${SUPPLIERS.length} do cadastro RM • ${Object.keys(EMBEDDED.map).length} centros de custo
-- ${EMBEDDED.allocations.length} linhas de rateio 08/2026
-- ============================================================================
begin;
`);

// Centros de custo
add('-- Centros de custo (COD CT -> código RM)');
add(`insert into public.pj_centros_custo (cod_ct, codigo_rm, origem) values
${Object.entries(EMBEDDED.map).map(([cc, v]) => `  (${q(cc)}, ${q(/^\d\.\d{3}\.\d{6}$/.test(v.rmCode || '') ? v.rmCode : null)}, ${q(v.source || EMBEDDED.sourceFile)})`).join(',\n')}
on conflict (cod_ct) do update set codigo_rm = coalesce(excluded.codigo_rm, public.pj_centros_custo.codigo_rm), origem = excluded.origem;
`);

// Prestadores
const colunas = ['codigo', 'nome', 'empresa', 'email', 'situacao', 'cadastro_origem', 'razao_social', 'cnpj', 'cpf', 'rg',
  'data_nascimento', 'sexo', 'telefone', 'email_pessoal', 'municipio', 'uf', 'modalidade', 'data_inicio', 'data_fim',
  'funcao', 'projeto', 'gestor', 'secao_codigo', 'secao_nome', 'valor_mensal', 'banco', 'banco_codigo', 'agencia',
  'conta', 'contabilidade', 'beneficios', 'dependentes'];
add('-- Prestadores');
add(`insert into public.pj_prestadores (${colunas.join(', ')}) values
${[...prestadores.values()].sort((a, c) => a.codigo.localeCompare(c.codigo)).map((p) => `  (${[
  q(p.codigo), q(p.nome), q(p.empresa), q(p.email ?? null), q(p.situacao), q('carga'), q(p.razao_social ?? null), q(p.cnpj ?? null),
  q(p.cpf ?? null), q(p.rg ?? null), q(p.data_nascimento ?? null), q(p.sexo ?? null), q(p.telefone ?? null), q(p.email_pessoal ?? null),
  q(p.municipio ?? null), q(p.uf ?? null), q(p.modalidade || 'CNPJ'), q(p.data_inicio ?? null), q(p.data_fim ?? null),
  q(p.funcao ?? null), q(p.projeto ?? null), q(p.gestor ?? null), q(p.secao_codigo ?? null), q(p.secao_nome ?? null),
  n(p.valor_mensal), q(p.banco ?? null), q(p.banco_codigo ?? null), q(p.agencia ?? null), q(p.conta ?? null),
  q(p.contabilidade ?? null), j(p.beneficios || {}), j(p.dependentes || []),
].join(', ')})`).join(',\n')}
on conflict (codigo) do nothing;
`);

// Rateio 08/2026
const grupos = new Map();
EMBEDDED.allocations.forEach((a) => {
  const cod = codigoDe(a.name);
  if (!cod) return;
  if (!grupos.has(cod)) grupos.set(cod, new Map());
  const g = grupos.get(cod);
  g.set(a.costCenter, (g.get(a.costCenter) || 0) + Number(a.allocation || 0));
});
const semRateio = EMBEDDED.allocations.filter((a) => !codigoDe(a.name)).map((a) => a.name);
add(`-- Rateio fixo (${EMBEDDED.sourceFile})${semRateio.length ? ` — ${new Set(semRateio).size} nome(s) do organograma sem prestador` : ''}`);
const linhasRateio = [];
grupos.forEach((g, cod) => {
  const soma = [...g.values()].reduce((s, v) => s + v, 0) || 1;
  g.forEach((aloc, cc) => linhasRateio.push(`  (${q(cod)}, ${q(cc)}, ${((aloc / soma) * 100).toFixed(6)}, ${aloc}, ${q(`${EMBEDDED.sourceFile} • Rateio 08.2026`)})`));
});
add(`insert into public.pj_prestador_rateios (prestador_id, cod_ct, percentual, alocacao_organograma, origem)
select p.id, v.cod_ct, v.percentual, v.alocacao, v.origem
  from (values
${linhasRateio.join(',\n')}
  ) v(codigo, cod_ct, percentual, alocacao, origem)
  join public.pj_prestadores p on p.codigo = v.codigo
on conflict (prestador_id, cod_ct) do nothing;
`);

// Fornecedores
add('-- Fornecedores TOTVS RM');
const fornecedores = [];
const codigosUsados = new Set();
ENTRADA.forEach((e) => {
  const rm = /^\d{7}$/.test(String(e.rmCode || '')) ? e.rmCode : null;
  if (rm) codigosUsados.add(rm);
  const bancos = digitos(e.cnpj).length === 14 ? [{
    ref: 1, descricao: 'PIX CNPJ', ativo: true, filial: '1', filialNome: 'PHD ASSESSORIA EM GESTAO LTDA', formaPagamento: 'PIX Transferência',
    favorecido: up(e.legalName), favorecidoDoc: e.cnpj, pixTipo: 'CNPJ', pixChave: e.cnpj,
  }] : [];
  fornecedores.push({ codigo: codigoDe(e.collaborator), codigo_rm: rm, razao_social: up(e.legalName), nome_fantasia: up(e.legalName), cnpj: e.cnpj || null, bancos, origem: rm ? 'Layout TOTVS 08/2026' : 'Pendente no layout 08/2026' });
});
SUPPLIERS.forEach((s) => {
  if (codigosUsados.has(s.code)) return;
  codigosUsados.add(s.code);
  fornecedores.push({ codigo: null, codigo_rm: s.code, razao_social: up(s.legalName), nome_fantasia: up(s.legalName), cnpj: null, bancos: [], origem: 'Cadastro RM (base informada)' });
});
const mvf = fornecedores.find((f) => f.codigo_rm === MVF.supplierCode);
const mvfDados = {
  razao_social: MVF.legalName, nome_fantasia: MVF.tradeName, cnpj: MVF.cnpj, classificacao: MVF.classification,
  endereco: {
    cep: MVF.address.zip, tipoRua: MVF.address.streetType, rua: MVF.address.street, numero: MVF.address.number,
    complemento: MVF.address.complement, tipoBairro: MVF.address.districtType, bairro: MVF.address.district,
    paisCodigo: MVF.address.countryCode, pais: MVF.address.country, ufCodigo: MVF.address.stateCode, uf: MVF.address.state,
    municipioCodigo: MVF.address.cityCode, municipio: MVF.address.city,
  },
  bancos: MVF.banks.map((x) => ({
    ref: x.ref, descricao: x.description, ativo: x.active, filial: x.branchCode, filialNome: x.branchName, formaPagamento: x.paymentForm,
    banco: x.bank, agencia: x.agency, agenciaDigito: x.agencyDigit, agenciaNome: x.agencyName, conta: x.account, contaDigito: x.accountDigit,
    tipoConta: x.accountType, camara: x.clearingHouse, favorecido: x.favored, favorecidoDoc: x.favoredTaxId, pixTipo: x.pixType, pixChave: x.pixKey,
  })),
};
if (mvf) Object.assign(mvf, mvfDados, { origem: 'Cadastro TOTVS RM (MVF)' });

add(`insert into public.pj_fornecedores_rm (prestador_id, codigo_rm, razao_social, nome_fantasia, cnpj, classificacao, endereco, bancos, origem)
select p.id, v.codigo_rm, v.razao_social, v.nome_fantasia, v.cnpj, v.classificacao, v.endereco, v.bancos, v.origem
  from (values
${fornecedores.map((f) => `  (${[q(f.codigo), q(f.codigo_rm), q(f.razao_social), q(f.nome_fantasia), q(f.cnpj), q(f.classificacao || 'Fornecedor'), j(f.endereco || {}), j(f.bancos || []), q(f.origem)].join(', ')})`).join(',\n')}
  ) v(codigo, codigo_rm, razao_social, nome_fantasia, cnpj, classificacao, endereco, bancos, origem)
  left join public.pj_prestadores p on p.codigo = v.codigo
 where not exists (select 1 from public.pj_fornecedores_rm f
                    where (v.codigo_rm is not null and f.codigo_rm = v.codigo_rm)
                       or (p.id is not null and f.prestador_id = p.id));
`);

// Histórico
const comps = [...new Set(ROWS.map((r) => r.competence))].sort((a, c) => compIso(a).localeCompare(compIso(c)));
add('-- Histórico 01–07/2026: competências fechadas');
add(`insert into public.pj_competencias (competencia, status, origem, prestadores, bruto, descontos, liquido, fechada_em, criado_por) values
${comps.map((c) => {
  const rs = ROWS.filter((r) => r.competence === c);
  const bruto = r2(rs.reduce((s, r) => s + Number(r.gross || 0), 0));
  const desc = r2(rs.reduce((s, r) => s + Number(r.discounts || 0), 0));
  return `  (${q(compIso(c))}, 'fechada', 'historico', ${rs.length}, ${bruto}, ${desc}, ${r2(bruto - desc)}, ${q(`${compIso(c).slice(0, 7)}-28 12:00:00-03`)}, null)`;
}).join(',\n')}
on conflict (competencia) do nothing;
`);

// Envelopes históricos (duplicados no mesmo mês somam)
const env = new Map();
ROWS.forEach((r) => {
  const cod = codigoDe(r.name);
  const k = `${r.competence}|${cod}`;
  const atual = env.get(k);
  if (atual) {
    atual.bruto = r2(atual.bruto + Number(r.gross || 0));
    atual.descontos = r2(atual.descontos + Number(r.discounts || 0));
    return;
  }
  const p = porNome.get(norm(r.name));
  env.set(k, {
    comp: compIso(r.competence), codigo: cod, bruto: r2(r.gross), descontos: r2(r.discounts),
    email: txt(r.email), razao: txt(up(r.legalName)), cnpj: txt(r.cnpj),
  });
});
add(`insert into public.pj_envelopes (competencia, prestador_id, origem, bruto, descontos, conferencia, termo, envio, calculado_em, cadastro, rateio)
select v.competencia::date, p.id, 'historico', v.bruto, v.descontos, 'ok', 'gerado', 'enviado', (v.competencia::date + 27)::timestamptz,
       jsonb_build_object('codigo', p.codigo, 'nome', p.nome, 'empresa', p.empresa, 'email', v.email, 'razaoSocial', v.razao, 'cnpj', v.cnpj), '[]'::jsonb
  from (values
${[...env.values()].map((e) => `(${q(e.comp)},${q(e.codigo)},${e.bruto},${e.descontos},${q(e.email)},${q(e.razao)},${q(e.cnpj)})`).join(',\n')}
  ) v(competencia, codigo, bruto, descontos, email, razao, cnpj)
  join public.pj_prestadores p on p.codigo = v.codigo
on conflict (competencia, prestador_id) do nothing;
`);

add(`insert into public.pj_importacoes (tipo, competencia, arquivo, linhas, localizados, bruto, descontos, liquido, resumo, importado_por)
select 'historico', c.competencia, 'pj_fechamento.html (histórico da planilha)', c.prestadores, c.prestadores, c.bruto, c.descontos, c.liquido,
       '{"origem":"carga do protótipo"}'::jsonb, null
  from public.pj_competencias c
 where c.origem = 'historico'
   and not exists (select 1 from public.pj_importacoes i where i.tipo = 'historico' and i.competencia = c.competencia);

insert into public.pj_auditoria (acao, detalhe)
select 'Carga inicial', ${q(`${prestadores.size} prestadores, ${comps.length} competências históricas, ${fornecedores.length} fornecedores RM`)}
 where not exists (select 1 from public.pj_auditoria where acao = 'Carga inicial');

commit;
`);

fs.writeFileSync(SAIDA, out.join('\n'));
console.log(`OK: ${path.relative(RAIZ, SAIDA)}`);
console.log(`  prestadores ${prestadores.size} (ativos ${[...prestadores.values()].filter((p) => p.situacao === 'ativo').length})`);
console.log(`  envelopes históricos ${env.size} em ${comps.length} competências`);
console.log(`  fornecedores ${fornecedores.length} (com código RM ${fornecedores.filter((f) => f.codigo_rm).length})`);
console.log(`  rateio: ${grupos.size} prestadores, ${linhasRateio.length} linhas; nomes sem prestador: ${new Set(semRateio).size}`);
