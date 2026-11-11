import { supabase } from '../../../services/supabase';
import { supabaseBackoffice } from '../../../services/supabaseBackoffice';
import { criarResolvedorProjeto } from './projetos';

// Colunas de detalhe que a lista precisa (função, projeto, profissional).
// Não traz a linha inteira: isso continua no "Ver respostas".
const DETALHE_LISTA = {
  formulario_contratacao: { tabela: 'formularios_contratacao', colunas: 'solicitacao_id, codigo_proposta_projeto, cargo_nivel, nome_profissional' },
  nova_vaga: { tabela: 'vagas', colunas: 'solicitacao_id, funcao' },
  mapeamento: { tabela: 'mapeamentos', colunas: 'solicitacao_id, funcao' },
};

// IDs vão na URL do PostgREST: em lotes para não estourar o tamanho dela.
const LOTE = 80;

/**
 * Detalhes por requisição: { [solicitacao_id]: { cargo_nivel, funcao, ... } }.
 * Best-effort: se uma tabela falhar, a lista só fica sem aquela informação.
 */
export async function carregarDetalhesLista(sols) {
  const porTipo = {};
  for (const s of sols) {
    if (!DETALHE_LISTA[s.tipo]) continue;
    (porTipo[s.tipo] ||= []).push(s.id);
  }
  const consultas = [];
  for (const [tipo, ids] of Object.entries(porTipo)) {
    const { tabela, colunas } = DETALHE_LISTA[tipo];
    for (let i = 0; i < ids.length; i += LOTE) {
      consultas.push(supabase.from(tabela).select(colunas).in('solicitacao_id', ids.slice(i, i + LOTE)));
    }
  }
  const mapa = {};
  for (const { data, error } of await Promise.all(consultas)) {
    if (error) { console.warn('Detalhe da requisição:', error.message); continue; }
    for (const r of data || []) mapa[r.solicitacao_id] = r;
  }
  return mapa;
}

/**
 * Resolvedor código -> { completo, cliente }. Junta os projetos do portal
 * (cliente) e as obras do organograma no Backoffice (código completo). Sem
 * chave estrangeira entre os bancos: o vínculo é pelo texto do código.
 * Falha de rede numa fonte não derruba a tela: ela só deixa de completar.
 */
export async function carregarResolvedorProjeto() {
  const [proj, obras] = await Promise.all([
    supabase.from('horas_projetos').select('nome, cliente, origem_cod_phd'),
    supabaseBackoffice.from('portal_organograma_obra').select('cod_phd, cod_ct'),
  ].map((p) => Promise.resolve(p).catch((e) => ({ data: null, error: e }))));
  if (proj.error) console.warn('Projetos do portal:', proj.error.message);
  if (obras.error) console.warn('Obras do organograma:', obras.error.message);
  return criarResolvedorProjeto({ projetos: proj.data || [], obras: obras.data || [] });
}
