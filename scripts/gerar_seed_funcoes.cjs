// Gera scripts/seed_funcoes.sql a partir de funcoes_extraidas.json (deduplicado, primeira ocorrência).
const fs = require('fs');
const path = require('path');

const dados = require('./funcoes_extraidas.json');
const seen = new Map();
for (const r of dados) {
  const k = r.nome.toUpperCase();
  if (!seen.has(k)) seen.set(k, r);
}
const rows = [...seen.values()].sort((a, b) => a.nome.localeCompare(b.nome));
const esc = (s) => s.replace(/'/g, "''");
const values = rows.map((r) => `  (${r.codigo ?? 'null'}, '${esc(r.nome)}')`).join(',\n');
const sql = `insert into public.funcoes (codigo, nome) values\n${values}\non conflict do nothing;\n`;
fs.writeFileSync(path.join(__dirname, 'seed_funcoes.sql'), sql, 'utf8');
console.log('linhas:', rows.length);
