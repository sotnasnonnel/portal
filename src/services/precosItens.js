import { supabase } from './supabase';
import { chavePreco } from '../config/precosItens';

/**
 * Carrega todos os preços configurados como um mapa plano
 * { 'catalogo::item': preco }. Itens sem linha simplesmente não aparecem.
 */
export async function carregarPrecosMap() {
  const { data, error } = await supabase
    .from('precos_itens')
    .select('catalogo, item, preco');
  if (error) throw error;
  const mapa = {};
  for (const r of data || []) {
    if (r.preco != null) mapa[chavePreco(r.catalogo, r.item)] = Number(r.preco);
  }
  return mapa;
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
