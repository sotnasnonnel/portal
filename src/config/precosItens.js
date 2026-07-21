/**
 * Catálogos de itens precificáveis da seção "Ajustes de Valores" (módulo DP).
 * As listas de itens são DERIVADAS dos schemas dos formulários (fonte única),
 * para nunca divergirem das opções realmente oferecidas nas requisições.
 *
 * Preços ficam na tabela global `precos_itens` (catalogo, item, preco).
 */
import { EQUIPAMENTOS } from './novaVaga';
import { CAMPOS as CAMPOS_CONTRATACAO } from './formularioContratacao';

// Opções "escape" (campo livre) não são precificáveis.
const IGNORAR = new Set(['Outra', 'Outro']);

const opcoesDe = (id) =>
  (CAMPOS_CONTRATACAO.find((c) => c.id === id)?.opcoes || []).filter((o) => !IGNORAR.has(o));

/**
 * Catálogos na ordem de exibição.
 * - key:    valor gravado em precos_itens.catalogo.
 * - origem: formulário onde o item aparece (mostrado como contexto na tela).
 * - itens:  rótulos exatos das opções (batem com o valor gravado nas requisições).
 */
export const CATALOGOS = [
  { key: 'equipamento', label: 'Equipamentos', origem: 'Nova Vaga', itens: EQUIPAMENTOS.filter((o) => !IGNORAR.has(o)) },
  { key: 'software', label: 'Softwares Extras', origem: 'Contratação', itens: opcoesDe('softwares_extras') },
  { key: 'epi', label: 'EPIs', origem: 'Contratação', itens: opcoesDe('epis') },
  { key: 'beneficio', label: 'Benefícios', origem: 'Contratação', itens: opcoesDe('beneficios') },
];

/** Chave única de um item no mapa de preços carregado do banco. */
export const chavePreco = (catalogo, item) => `${catalogo}::${item}`;

const FMT_BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Número => "R$ 3.500,00". null/'' => ''. */
export function formatarPreco(n) {
  if (n == null || n === '' || !Number.isFinite(Number(n))) return '';
  return FMT_BRL.format(Number(n));
}
