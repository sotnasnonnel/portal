import { supabaseBackoffice } from '../../../../services/supabaseBackoffice';
import { distinctMonths, resolveDefaultMonth } from '../../../../pages/Gestor/organograma/organogramaData';

// Os "contratos" (CC) do formulário de Cartão Virtual vêm do ORGANOGRAMA, que
// mora no projeto backoffice_phd (banco separado, cliente read-only próprio).
// Contrato = organograma_alocacao.obra_cod_phd. A lista é ABERTA (todos os
// contratos do mês), não filtrada por usuário.

/**
 * Todos os contratos (obra_cod_phd) do mês vigente do organograma.
 * Mês: corrente se existir, senão o mais recente com dados (mesma regra da
 * Consulta Organograma). Retorna array ordenado (pt-BR).
 * Lança em erro de rede/consulta — o chamador distingue "erro" de "vazio".
 */
export async function listarTodosContratos() {
  const { data: mesesRows, error: eMeses } = await supabaseBackoffice
    .from('organograma_meses').select('mes');
  if (eMeses) throw eMeses;
  const mes = resolveDefaultMonth(distinctMonths(mesesRows), new Date());
  if (!mes) return [];

  const { data, error } = await supabaseBackoffice
    .from('organograma_alocacao')
    .select('obra_cod_phd')
    .eq('mes', mes);
  if (error) throw error;

  const contratos = new Set();
  for (const r of data || []) {
    if (r.obra_cod_phd) contratos.add(r.obra_cod_phd);
  }
  return [...contratos].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
