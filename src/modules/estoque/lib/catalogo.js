// Regras de leitura do catálogo: como nomear, ordenar, filtrar e classificar uma
// variante. Sem React e sem Supabase, para rodar sob `node --test`.
//
// As constantes de domínio moram AQUI e não em config/estoque.js porque aquele
// arquivo importa ícones do lucide-react e não roda fora do bundler; config as
// reexporta para as telas.

/**
 * Tamanhos de vestuário na ordem da tabela de medidas. Ordem alfabética poria
 * GG antes de M, e a tela de saída ficaria inutilizável.
 */
export const TAMANHOS_ALFA = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];

/**
 * Chave de ordenação de tamanho. Convive com os dois sistemas da planilha:
 * vestuário (P..XXG) e calçado (35..48). Numérico vai depois do alfabético
 * porque nenhum item usa os dois ao mesmo tempo — o que importa é cada grupo
 * ficar coerente consigo.
 */
export function ordemTamanho(tamanho) {
  const t = String(tamanho ?? '').trim().toUpperCase();
  if (!t) return -1;
  const i = TAMANHOS_ALFA.indexOf(t);
  if (i >= 0) return i;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? 100 + n : 999;
}

/** Acentos e caixa fora: a planilha mistura "Camisa social Branca" e "Camisa Social Branca". */
export const normalizar = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

const LABEL_GENERO = { masculino: 'Masculino', feminino: 'Feminino', unisex: 'Unissex' };
const LABEL_SETOR = { sede: 'Sede', obra: 'Obra', coordenacao: 'Coordenação' };

/**
 * Só os atributos que distinguem esta variante das irmãs, na ordem em que
 * importam para quem separa o item na prateleira: tamanho primeiro, CA por
 * último (é dado de conformidade, não de escolha).
 */
export function detalheVariante(v) {
  return [
    v?.tamanho,
    LABEL_GENERO[v?.genero],
    LABEL_SETOR[v?.setor],
    v?.ca ? `CA ${v.ca}` : '',
  ].filter(Boolean).join(' · ');
}

/** Nome completo para leitura: "BOTINA COM METATARSO · 42 · CA 48582". */
export function rotuloVariante(v) {
  const det = detalheVariante(v);
  return det ? `${v?.descricao ?? ''} · ${det}` : String(v?.descricao ?? '');
}

/**
 * Mesma chave do índice único do banco (estoque_variantes_chave). Serve para o
 * import saber se a linha da planilha cria ou atualiza, sem ida ao servidor.
 */
export const chaveVariante = (v) => [
  normalizar(v?.categoria), normalizar(v?.descricao), normalizar(v?.tamanho),
  normalizar(v?.ca), normalizar(v?.genero), normalizar(v?.setor),
].join('|');

/**
 * Espelha o CASE da view estoque_posicao. Existe em JS porque o carrinho precisa
 * antever a situação DEPOIS do lançamento ("vai ficar abaixo do mínimo"), coisa
 * que a view, olhando o saldo atual, não responde.
 */
export function situacaoDoSaldo({ saldo, estoque_minimo: min = 0, estoque_maximo: max = null }) {
  const s = Number(saldo) || 0;
  if (s === 0) return 'sem_estoque';
  if (s < (Number(min) || 0)) return 'abaixo_minimo';
  if (max !== null && max !== undefined && max !== '' && s > Number(max)) return 'acima_maximo';
  return 'ok';
}

export const EM_ALERTA = new Set(['sem_estoque', 'abaixo_minimo']);

/** Ordena por categoria, descrição e, dentro do item, pela tabela de tamanhos. */
export function compararVariantes(a, b) {
  const porCat = normalizar(a?.categoria).localeCompare(normalizar(b?.categoria));
  if (porCat) return porCat;
  const porDesc = normalizar(a?.descricao).localeCompare(normalizar(b?.descricao));
  if (porDesc) return porDesc;
  const porTam = ordemTamanho(a?.tamanho) - ordemTamanho(b?.tamanho);
  if (porTam) return porTam;
  return normalizar(a?.ca).localeCompare(normalizar(b?.ca));
}

/**
 * Filtro da tela de posição e do seletor de itens. O termo casa contra o rótulo
 * inteiro (descrição + tamanho + CA + gênero + setor), então buscar "botina 42"
 * ou "45021" encontra — é como as pessoas procuram no almoxarifado.
 */
export function filtrarPosicao(lista, { termo = '', categoria = '', apenasAlerta = false } = {}) {
  const t = normalizar(termo);
  const termos = t ? t.split(' ').filter(Boolean) : [];
  return (lista || []).filter((v) => {
    if (categoria && v.categoria !== categoria) return false;
    if (apenasAlerta && !EM_ALERTA.has(v.situacao || situacaoDoSaldo(v))) return false;
    if (!termos.length) return true;
    const alvo = normalizar(rotuloVariante(v));
    return termos.every((p) => alvo.includes(p));
  }).sort(compararVariantes);
}
