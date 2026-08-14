// ============================================================================
// Campos do apontamento configurados POR EQUIPE.
// ----------------------------------------------------------------------------
// Cada gerência monta os campos que a sua gente preenche antes de dar play no
// cronômetro: rótulo, tipo (lista suspensa com opções livres | texto livre) e se
// é obrigatório. A configuração vive em horas_campos_apontamento; o que foi
// preenchido é gravado no próprio apontamento, em jsonb:
//
//   [{ id: '<uuid do campo>', label: 'Sigla', valor: 'PTA' }, ...]
//
// O RÓTULO vai junto em snapshot, de propósito: renomear ou apagar um campo
// depois não reescreve o histórico, e os relatórios (CSV, Excel, gráficos)
// agrupam pelo rótulo GRAVADO — que é o que faz sentido quando a listagem
// mistura equipes com configurações diferentes.
//
// Substituiu o catálogo fixo da empresa (sigla/tarefa/etiqueta/tarefa 2, ver
// catalogoTarefas.js, que virou só o modelo padrão sugerido na configuração).
// Apontamento antigo continua legível: `camposDoApontamento` cai nas colunas
// legadas quando `campos` está vazio.
//
// Módulo puro (sem I/O), roda no node:test — ver camposEquipe.test.js.
// ============================================================================

export const TIPOS = [
  { valor: 'dropdown', label: 'Lista suspensa' },
  { valor: 'texto', label: 'Texto livre' },
];

export const tipoLabel = (tipo) => TIPOS.find((t) => t.valor === tipo)?.label || tipo;

const texto = (v) => (v == null ? '' : String(v));
const trim = (v) => texto(v).trim();

// Rótulos comparam-se sem caixa/espaço nas pontas: "Sigla" e "sigla " são o
// mesmo campo para o banco (índice único) e para os relatórios.
export const chaveLabel = (label) => trim(label).toLocaleLowerCase('pt-BR');

// ---- Configuração ---------------------------------------------------------

export function normalizarCampo(row = {}) {
  return {
    id: row.id,
    gerenciaId: row.gerencia_id ?? row.gerenciaId ?? null,
    ordem: Number(row.ordem) || 0,
    label: texto(row.label),
    tipo: row.tipo === 'texto' ? 'texto' : 'dropdown',
    opcoes: limparOpcoes(row.opcoes),
    obrigatorio: !!row.obrigatorio,
  };
}

// Opções de uma lista suspensa: sem vazios, sem repetidas, ordem preservada.
export function limparOpcoes(opcoes) {
  if (!Array.isArray(opcoes)) return [];
  const vistos = new Set();
  const out = [];
  for (const o of opcoes) {
    const v = trim(o);
    if (!v || vistos.has(v)) continue;
    vistos.add(v);
    out.push(v);
  }
  return out;
}

// A tela edita as opções como texto, uma por linha — é o jeito mais rápido de
// colar uma lista pronta de planilha.
export const parseOpcoes = (txt) => limparOpcoes(texto(txt).split('\n'));
export const opcoesTexto = (opcoes) => limparOpcoes(opcoes).join('\n');

// Campo pronto para o banco (nomes das colunas). `texto` livre não guarda opções.
export function paraBanco(campo, gerenciaId) {
  const tipo = campo.tipo === 'texto' ? 'texto' : 'dropdown';
  return {
    ...(gerenciaId ? { gerencia_id: gerenciaId } : {}),
    label: trim(campo.label),
    tipo,
    opcoes: tipo === 'texto' ? [] : limparOpcoes(campo.opcoes),
    obrigatorio: !!campo.obrigatorio,
    ordem: Number(campo.ordem) || 0,
  };
}

// Mensagem de erro da configuração (ou '' se está válida). Espelha as duas
// travas do banco — rótulo único por equipe e lista suspensa com opção — para o
// gestor ler um aviso em português em vez de um erro de constraint.
export function erroDeConfiguracao(campo, outros = []) {
  const label = trim(campo.label);
  if (!label) return 'Dê um nome ao campo.';
  if (outros.some((c) => c.id !== campo.id && chaveLabel(c.label) === chaveLabel(label))) {
    return `Já existe um campo chamado "${label}" nesta equipe.`;
  }
  if (campo.tipo !== 'texto' && !limparOpcoes(campo.opcoes).length) {
    return 'Uma lista suspensa precisa de pelo menos uma opção.';
  }
  return '';
}

export const campoNovo = (ordem = 0) => ({
  id: null,
  label: '',
  tipo: 'dropdown',
  opcoes: [],
  obrigatorio: true,
  ordem,
});

// A tela edita as opções num textarea, e o texto CRU precisa sobreviver à
// digitação: se limpássemos a cada tecla, apertar Enter para começar a próxima
// opção apagaria a linha em branco antes de o gestor escrever nela. O rascunho
// carrega `opcoesTxt`; `deRascunho` é quem transforma em lista, na hora de
// validar e salvar.
export const paraRascunho = (campo) => ({ ...campo, opcoesTxt: opcoesTexto(campo.opcoes) });
export const deRascunho = (rascunho) => ({
  ...rascunho,
  opcoes: parseOpcoes(rascunho.opcoesTxt),
});

// ---- Preenchimento (tela de apontar / lançamento manual) ------------------

// Valores por id do campo: { '<uuid>': 'PTA' }.
export function valoresIniciais(campos = [], persistidos = []) {
  const porId = new Map(lerPersistidos(persistidos).map((c) => [c.id, c.valor]));
  const out = {};
  for (const c of campos) out[c.id] = porId.get(c.id) || '';
  return out;
}

// Rótulos dos campos obrigatórios que ainda estão em branco.
export function faltando(campos = [], valores = {}) {
  return campos.filter((c) => c.obrigatorio && !trim(valores[c.id])).map((c) => c.label);
}

export const preenchimentoValido = (campos, valores) => faltando(campos, valores).length === 0;

// O que vai para o banco. Campo em branco não é gravado — ausência é ausência,
// não string vazia, e assim o CSV de um campo opcional sai limpo.
export function paraPersistencia(campos = [], valores = {}) {
  return campos
    .map((c) => ({ id: c.id, label: trim(c.label), valor: trim(valores[c.id]) }))
    .filter((c) => c.valor);
}

export function lerPersistidos(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c === 'object')
    .map((c) => ({ id: c.id ?? null, label: texto(c.label), valor: texto(c.valor) }))
    .filter((c) => c.valor);
}

// ---- Leitura de um apontamento (inclui os dois legados) -------------------

// Rótulos das colunas do catálogo fixo, que valeu para a empresa toda antes de
// os campos virarem configuráveis por equipe.
const LEGADO_CATALOGO = [
  ['sigla', 'Sigla'],
  ['tarefa', 'Tarefa'],
  ['etiqueta', 'Etiqueta'],
  ['tarefa2', 'Tarefa 2'],
];

// Os campos de um apontamento, na ordem em que devem aparecer. Cai no legado
// quando o registro é antigo: primeiro o catálogo fixo (4 colunas), depois as
// "atividades controladas" (array posicional `ativ`, o legado mais antigo).
export function camposDoApontamento(row = {}) {
  const novos = lerPersistidos(row.campos);
  if (novos.length) return novos;

  const doCatalogo = LEGADO_CATALOGO.filter(([chave]) => trim(row[chave])).map(([chave, label]) => ({
    id: null,
    label,
    valor: trim(row[chave]),
  }));
  if (doCatalogo.length) return doCatalogo;

  return (Array.isArray(row.ativ) ? row.ativ : [])
    .map((v, i) => ({ id: null, label: `Atividade ${i + 1}`, valor: trim(v) }))
    .filter((c) => c.valor);
}

// Rótulos presentes numa lista de apontamentos, na ordem em que aparecem. É o
// que vira coluna do CSV/Excel e opção de quebra dos gráficos — feito a partir
// dos DADOS, não da configuração atual, para a listagem de um gestor que vê
// várias equipes (ou o histórico do catálogo antigo) não perder coluna.
export function labelsUsados(list = []) {
  const out = [];
  const vistos = new Set();
  for (const a of list) {
    for (const c of a.campos || []) {
      const k = chaveLabel(c.label);
      if (!k || vistos.has(k)) continue;
      vistos.add(k);
      out.push(c.label);
    }
  }
  return out;
}

// Valor de um campo pelo RÓTULO (o id muda de equipe para equipe).
export function valorDoCampo(apont = {}, label) {
  const k = chaveLabel(label);
  return (apont.campos || []).find((c) => chaveLabel(c.label) === k)?.valor || '';
}
