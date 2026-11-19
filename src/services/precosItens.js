import { supabase } from './supabase';
import { chavePreco } from '../config/precosItens';

/**
 * Carrega o catálogo inteiro de precos_itens:
 * - precos: mapa plano { 'catalogo::item': preco } (itens sem preço não entram);
 * - extras: { catalogo: [item, ...] } — itens cadastrados na tela Ajustes de
 *   Valores, que não existem na lista fixa do código (coluna `extra`).
 */
export async function carregarCatalogoPrecos() {
  const { data, error } = await supabase
    .from('precos_itens')
    .select('catalogo, item, preco, extra')
    .order('item');
  if (error) throw error;
  const precos = {};
  const extras = {};
  for (const r of data || []) {
    if (r.preco != null) precos[chavePreco(r.catalogo, r.item)] = Number(r.preco);
    if (r.extra) (extras[r.catalogo] ||= []).push(r.item);
  }
  return { precos, extras };
}

/**
 * Salva (upsert) o preço de um item. `preco` null apaga o valor mas mantém a
 * linha. `updatedBy` = id do colaborador logado (auditoria).
 */
export async function salvarPreco(catalogo, item, preco, updatedBy) {
  const { error } = await supabase
    .from('precos_itens')
    .upsert(
      { catalogo, item, preco, updated_by: updatedBy ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'catalogo,item' }
    );
  if (error) throw error;
}

/** Cadastra um item novo no catálogo (aparece nos formulários de requisição). */
export async function adicionarItem(catalogo, item, preco, updatedBy) {
  const { error } = await supabase
    .from('precos_itens')
    .insert({ catalogo, item, preco, extra: true, updated_by: updatedBy ?? null });
  if (error) {
    if (error.code === '23505') throw new Error(`"${item}" já está na lista.`);
    throw error;
  }
}

/**
 * Remove um item cadastrado pela tela. Só apaga linha `extra`: os itens do
 * código não saem por aqui. Requisições antigas guardam o nome como texto,
 * então continuam mostrando o item.
 */
export async function removerItem(catalogo, item) {
  const { error } = await supabase
    .from('precos_itens')
    .delete()
    .eq('catalogo', catalogo)
    .eq('item', item)
    .eq('extra', true);
  if (error) throw error;
}
