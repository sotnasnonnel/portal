/* Gera o SQL de carga de colaboradores a partir de docs/colab.xlsx.
   Saída: docs/carga_colaboradores.sql (aplicado no banco compartilhado).
   Regras detalhadas no spec docs/superpowers/specs/2026-06-19-formato-superior-colaboradores-design.md */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DOM = '@phdengenharia.eng.br';

// COO PHD (nome curto) -> e-mail do gestor.
const COO_EMAIL = {
  'Jarbas Junior': 'jarbas.junior', 'Mateus Corradi': 'mateus.corradi',
  'Luciana Ferreira': 'luciana.ferreira', 'Ana Regina': 'ana.caldeira',
  'Daniel Almeida': 'daniel.almeida', 'Pedro Morais': 'pedro.morais',
  'Julio Cesar': 'julio.cesar', 'Alex Silva': 'alex.silva',
  'Ronaldo Machado': 'ronaldo.machado', 'Alessandro Moreira': 'alessandro.moreira',
  'Gabriel Abud': 'gabriel.abud', 'Thales Padua': 'thales.padua',
  'Tulio Morais': 'tulio.rafael', 'Eduardo Eler': 'eduardo.eler',
  'Bruno Azevedo': 'bruno.azevedo', 'Diogo Soares': 'diogo.soares',
  'Andre Guimaraes': 'andre.guimaraes', 'Paulo Paiva': 'paulo.paiva',
  'Pedro Nery': 'pedro.nery', 'Vinicius Costa': 'vinicius.costa',
  'Diego Bernardes': 'diego.bernardes', 'Nilton Netto': 'nilton.netto',
};

// As 16 pessoas que ainda NAO existem no banco (precisam de INSERT).
const NOVAS = new Set([
  'michel.santos','joao.catarino','ryan.arrais','alessandro.moreira','alexandre.moreira',
  'fernando.menezes','igor.guilherme','carlos.vasconcelos','felipe.costanzi','yitalon.brito',
  'wanderson.silva','marcos.chaves','mylena.zoqbi','ramon.medeiros','matheus.morais','andre.campos',
]);

// COO que existem mas nao sao gestores -> promover.
const PROMOVER_GESTOR = ['alex.silva','gabriel.abud','nilton.netto'];

const mapFormato = (f) => {
  const v = String(f || '').trim().toUpperCase();
  if (v === 'CLT') return 'CLT';
  if (v === 'CNPJ' || v === 'PJ') return 'PJ';
  if (v === 'SOCIO COTISTA') return 'Sócio Cotista';
  if (v === 'DIRETORIA') return 'Diretoria';
  return null;
};

// serial Excel -> ISO (UTC, sem drift de fuso).
const excelToISO = (serial) => {
  if (serial == null || serial === '') return null;
  const n = Number(serial);
  if (!Number.isFinite(n)) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
};

const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const localPart = (email) => String(email).toLowerCase().split('@')[0];

const wb = XLSX.readFile(path.join(__dirname, 'colab.xlsx'));
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

const lines = [];
lines.push('-- Carga gerada por docs/gerar_carga_colaboradores.cjs');
lines.push('-- NAO editar a mao; regenerar a partir da planilha.');
lines.push('begin;');
lines.push('');

// 1) INSERT das 16 novas
lines.push('-- 1) Inserir colaboradores novos (socio/PJ/CNPJ)');
const novasWarn = [];
rows.forEach((r) => {
  const email = String(r['email (PHD)'] || '').trim().toLowerCase();
  if (!email || !NOVAS.has(localPart(email))) return;
  const lp = localPart(email);
  const nome = (r['NOME COMPLETO'] || '').toString().trim();
  const funcao = (r['CARGO'] || '').toString().trim() || null;
  const adm = excelToISO(r['DATA ADMISSÃO']);
  const nasc = excelToISO(r['DATA NASCIMENTO']);
  const formato = mapFormato(r['FORMATO']);
  const perfil = (lp === 'alessandro.moreira') ? 'gestor' : 'usuario'; // COO -> gestor
  lines.push(
    `insert into colaboradores (nome, email, funcao, data_admissao, data_nascimento, formato, perfil, ativo) ` +
    `values (${q(nome)}, ${q(email)}, ${q(funcao)}, ${adm ? q(adm) : 'null'}, ${nasc ? q(nasc) : 'null'}, ${q(formato)}, ${q(perfil)}, true) ` +
    `on conflict (email) do nothing;`
  );
});
lines.push('');

// 2) UPDATE formato em todos (match por e-mail)
lines.push('-- 2) Preencher formato em todos');
rows.forEach((r) => {
  const email = String(r['email (PHD)'] || '').trim().toLowerCase();
  if (!email) return;
  const formato = mapFormato(r['FORMATO']);
  if (!formato) return;
  lines.push(`update colaboradores set formato = ${q(formato)} where lower(email) = ${q(email)};`);
});
lines.push('');

// 3) Promover COO nao-gestores
lines.push('-- 3) Promover COO que nao sao gestores');
PROMOVER_GESTOR.forEach((lp) => {
  lines.push(`update colaboradores set perfil = 'gestor' where lower(email) = ${q(lp + DOM)};`);
});
lines.push('');

// 4) superior_id a partir do COO PHD
lines.push('-- 4) Definir superior_id (COO PHD)');
rows.forEach((r) => {
  const email = String(r['email (PHD)'] || '').trim().toLowerCase();
  if (!email) return;
  const coo = String(r['COO PHD'] || '').trim();
  if (!coo || coo === '0') return;            // COO vazio -> nao mexe
  const supLocal = COO_EMAIL[coo];
  if (!supLocal) { novasWarn.push(`COO sem mapeamento: "${coo}" (${email})`); return; }
  const supEmail = supLocal + DOM;
  if (localPart(email) === supLocal) return;  // auto-referencia -> deixa nulo
  lines.push(
    `update colaboradores set superior_id = (select id from colaboradores where lower(email) = ${q(supEmail)}) ` +
    `where lower(email) = ${q(email)};`
  );
});
lines.push('');
lines.push('commit;');

fs.writeFileSync(path.join(__dirname, 'carga_colaboradores.sql'), lines.join('\n'));
console.log('SQL gerado: docs/carga_colaboradores.sql');
console.log('Linhas SQL:', lines.length);
if (novasWarn.length) { console.log('AVISOS:'); novasWarn.forEach((w) => console.log(' -', w)); }
