// Extrai pares codigo+nome da FUNÇÃO.xlsx (já expandida em %TEMP%\funcao_x) para JSON.
const fs = require('fs');
const path = require('path');

const dir = path.join(process.env.TEMP, 'funcao_x');
const ss = fs.readFileSync(path.join(dir, 'xl', 'sharedStrings.xml'), 'utf8');
const strings = [...ss.matchAll(/<si><t[^>]*>([\s\S]*?)<\/t><\/si>/g)]
  .map((m) => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));

const sh = fs.readFileSync(path.join(dir, 'xl', 'worksheets', 'sheet1.xml'), 'utf8');
const rows = [...sh.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)].map((m) => {
  const cells = [...m[1].matchAll(/<c r="([A-Z]+)\d+"( t="s")?><v>([^<]+)<\/v><\/c>/g)];
  const o = {};
  for (const c of cells) o[c[1]] = c[2] ? strings[Number(c[3])] : Number(c[3]);
  return o;
});

const out = rows
  .slice(1) // pula cabeçalho (Codigo / FUNÇÃO)
  .map((r) => ({ codigo: r.A ?? null, nome: String(r.B ?? '').trim() }))
  .filter((r) => r.nome);

fs.writeFileSync(path.join(__dirname, 'funcoes_extraidas.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('total:', out.length);
console.log('nomes unicos:', new Set(out.map((r) => r.nome.toUpperCase())).size);
console.log(JSON.stringify(out.slice(0, 5), null, 2));
