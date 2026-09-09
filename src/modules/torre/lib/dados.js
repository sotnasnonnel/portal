import { supabase } from '../../../services/supabase';

/**
 * A leitura da Torre — e o motivo de ela não usar as consultas dos módulos.
 *
 * A Torre é para coordenador, gerente e diretoria. A RLS das tabelas de origem
 * não sabe disso: `chamados_adm_select` libera solicitante, atendente, aprovador
 * e time do Adm, e mais ninguém. Um gerente de fora do Adm consultando as
 * tabelas direto via 22 chamados e ZERO mobilizações — a tela abria quase vazia
 * e sem dizer que faltava coisa.
 *
 * Alargar a RLS era o caminho óbvio, e foi descartado: `chamados_adm.campos`
 * guarda CPF, RG e data de nascimento (chamados de hospedagem precisam disso
 * para reservar), e RLS é linha, não coluna — liberar a linha libera o jsonb
 * inteiro. Daria documento de colega a 39 pessoas para resolver um problema de
 * filtro.
 *
 * Então a Torre lê por RPCs SECURITY DEFINER que devolvem só as colunas que ela
 * desenha (supabase_migration_torre_leitura.sql). `campos` não sai do Adm.
 *
 * Nenhuma paginação aqui: RPC não passa pelo corte de 1000 linhas do PostgREST,
 * que é o que obrigou fila e matriz a paginar.
 */

const chamar = async (fn, args, oQue) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(`Não foi possível carregar ${oQue}: ${error.message}`);
  return data || [];
};

/** Nomes das pessoas, pelo mesmo RPC que o resto do portal usa. */
async function nomesDe(ids) {
  const unicos = [...new Set(ids.filter(Boolean))];
  const mapa = new Map();
  if (!unicos.length) return mapa;
  const { data } = await supabase.rpc('nomes_colaboradores', { p_ids: unicos });
  (data || []).forEach((p) => mapa.set(p.id, p.nome));
  return mapa;
}

/** Quadro: as duas origens unificadas, com o responsável pelo contrato já resolvido. */
export async function lerQuadro() {
  const lista = await chamar('torre_quadro', {}, 'a torre');
  const nomes = await nomesDe(lista.map((i) => i.responsavel_id));
  return lista
    .map((i) => ({ ...i, responsavelNome: nomes.get(i.responsavel_id) || '' }))
    .sort((a, b) => String(a.prazo || '9999').localeCompare(String(b.prazo || '9999')));
}

/**
 * Etapas de mobilização com o contexto do processo.
 *
 * Os campos saem achatados no próprio objeto (numero, fluxo, processoTitulo)
 * porque é assim que a lógica pura da lista e da matriz os espera — o mesmo
 * formato que listarEtapasDoQuadro entrega no módulo de Mobilização.
 */
export async function lerEtapas() {
  const lista = await chamar('torre_etapas', {}, 'as etapas');
  const nomes = await nomesDe(lista.map((e) => e.responsavel_id));
  return lista.map((e) => ({
    ...e,
    responsavelNome: nomes.get(e.responsavel_id) || '',
    processoTitulo: e.processo_titulo,
    processoStatus: e.processo_status,
    cc: e.cod_ct || '',
  }));
}

/** Processos em andamento: as linhas da matriz do Mapa. */
export async function lerProcessos() {
  const lista = await chamar('torre_processos', {}, 'os processos');
  const nomes = await nomesDe(lista.map((p) => p.responsavel_id));
  return lista.map((p) => ({ ...p, responsavelNome: nomes.get(p.responsavel_id) || '' }));
}

/** Chamados do Adm, sem o conteúdo do formulário. */
export async function lerChamados({ diasFechados = 15 } = {}) {
  const lista = await chamar('torre_chamados', { p_dias_fechados: diasFechados }, 'os chamados');
  const nomes = await nomesDe(lista.map((c) => c.atendente_id));
  return lista.map((c) => ({ ...c, atendenteNome: nomes.get(c.atendente_id) || '' }));
}

/**
 * A matriz precisa de processos E de TODAS as etapas deles.
 *
 * Filtra as etapas pelos processos em andamento no cliente, e não no banco,
 * porque torre_etapas() já traz tudo numa ida só — pedir de novo com um filtro
 * seria uma segunda viagem para recortar o que já está na mão.
 */
export async function lerParaMatriz() {
  const [processos, etapas] = await Promise.all([lerProcessos(), lerEtapas()]);
  const abertos = new Set(processos.map((p) => p.id));
  return { processos, etapas: etapas.filter((e) => abertos.has(e.processo_id)) };
}
