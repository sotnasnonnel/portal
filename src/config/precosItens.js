/**
 * Catálogos de itens precificáveis da seção "Ajustes de Valores" (módulo DP).
 * As listas de itens são DERIVADAS dos schemas dos formulários (fonte única),
 * para nunca divergirem das opções realmente oferecidas nas requisições.
 *
 * Preços ficam na tabela global `precos_itens` (catalogo, item, preco).
 */
import { EQUIPAMENTOS } from './novaVaga.js';
import { CAMPOS as CAMPOS_CONTRATACAO } from './formularioContratacao.js';

// Opções "escape" (campo livre) não são precificáveis.
const IGNORAR = new Set(['Outra', 'Outro']);

const opcoesDe = (id) =>
  (CAMPOS_CONTRATACAO.find((c) => c.id === id)?.opcoes || []).filter((o) => !IGNORAR.has(o));

/**
 * Catálogos na ordem de exibição.
 * - key:    valor gravado em precos_itens.catalogo.
 * - origem: formulário onde o item aparece (mostrado como contexto na tela).
 * - singular: nome do item no botão "Adicionar …".
 * - itens:  rótulos exatos das opções (batem com o valor gravado nas requisições).
 */
export const CATALOGOS = [
  { key: 'equipamento', label: 'Equipamentos', singular: 'equipamento', origem: 'Nova Vaga', itens: EQUIPAMENTOS.filter((o) => !IGNORAR.has(o)) },
  { key: 'software', label: 'Softwares Extras', singular: 'software', origem: 'Contratação', itens: opcoesDe('softwares_extras') },
  { key: 'epi', label: 'EPIs', singular: 'EPI', origem: 'Contratação', itens: opcoesDe('epis') },
  { key: 'beneficio', label: 'Benefícios', singular: 'benefício', origem: 'Contratação', itens: opcoesDe('beneficios') },
];

/**
 * Lista de opções de um campo com os itens cadastrados em Ajustes de Valores.
 * Os cadastrados entram depois dos fixos e antes de "Outra"/"Outro", que
 * continua sendo a última opção. Nome repetido (sem diferenciar maiúsculas)
 * não entra duas vezes.
 */
export function comItensExtras(opcoes, extras) {
  if (!extras?.length) return opcoes;
  const fixos = opcoes.filter((o) => !IGNORAR.has(o));
  const escape = opcoes.filter((o) => IGNORAR.has(o));
  const vistos = new Set(fixos.map(normalizarItem));
  const novos = [];
  for (const e of extras) {
    const k = normalizarItem(e);
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    novos.push(e);
  }
  return [...fixos, ...novos, ...escape];
}

/** Forma de comparar nomes de item: sem espaços sobrando e sem caixa. */
export const normalizarItem = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

/** Chave única de um item no mapa de preços carregado do banco. */
export const chavePreco = (catalogo, item) => `${catalogo}::${item}`;

const FMT_BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Número => "R$ 3.500,00". null/'' => ''. */
export function formatarPreco(n) {
  if (n == null || n === '' || !Number.isFinite(Number(n))) return '';
  return FMT_BRL.format(Number(n));
}
