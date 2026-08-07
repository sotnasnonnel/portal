import { supabase } from '../../../services/supabase';
// Reaproveita o upload das Requisições DP: ele carrega o tratamento de arquivo
// "só na nuvem" (OneDrive) e o retry de rede, que custaram caro para acertar.
// Duplicar aqui seria perder isso silenciosamente.
import { enviarArquivo } from '../../../pages/Gestor/requisicoes/uploadAnexo';

export const BUCKET_ADM = 'chamados-adm-anexos';

/**
 * Configuração do par (classe, serviço): atendente padrão, SLA e alçada.
 * Serviço ainda não cadastrado cai no padrão neutro — o chamado abre sem
 * técnico e sem prazo em vez de dar erro na cara do solicitante.
 */
export async function buscarConfigServico(classe, servico) {
  const { data, error } = await supabase
    .from('chamados_adm_config')
    .select('atendente_id, sla_horas, exige_aprovacao, aprovadores, campos_extras')
    .eq('classe', classe)
    .eq('servico', servico)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível ler a configuração do serviço: ${error.message}`);
  return data || {
    atendente_id: null, sla_horas: null, exige_aprovacao: false, aprovadores: [], campos_extras: [],
  };
}

/** Todas as configurações de uma vez — a tela de cadastro lista serviço a serviço. */
export async function listarConfigs() {
  const { data, error } = await supabase
    .from('chamados_adm_config')
    .select('classe, servico, atendente_id, sla_horas, exige_aprovacao, aprovadores, campos_extras');
  if (error) throw new Error(`Não foi possível carregar as configurações: ${error.message}`);
  return data || [];
}

/**
 * Pessoas para escolher como atendente/aprovador. Vem por RPC porque a policy
 * de colaboradores não deixaria o admin do Adm listar a empresa inteira.
 */
export async function listarPessoas() {
  const { data, error } = await supabase.rpc('chamados_adm_pessoas');
  if (error) throw new Error(`Não foi possível carregar as pessoas: ${error.message}`);
  return data || [];
}

/** Grava (ou cria) a configuração do serviço. Só admin do Adm passa pela RLS. */
export async function salvarConfigServico(classe, servico, dados) {
  const { error } = await supabase
    .from('chamados_adm_config')
    .upsert({ classe, servico, ...dados, updated_at: new Date().toISOString() },
      { onConflict: 'classe,servico' });
  if (error) throw new Error(`Não foi possível salvar: ${error.message}`);
}

/**
 * Quem aprova é o superior direto do solicitante (mesma regra das horas extras),
 * lido da hierarquia da Gestão de Pessoas — não há cadeia cadastrada por serviço.
 * A policy colaboradores_select libera a própria linha, então o solicitante
 * consegue ler o próprio superior_id sem RPC.
 */
export async function buscarSuperior(solicitanteId) {
  const { data, error } = await supabase
    .from('colaboradores').select('superior_id').eq('id', solicitanteId).maybeSingle();
  if (error) throw new Error(`Não foi possível identificar o aprovador: ${error.message}`);
  return data?.superior_id || null;
}

// A trava do POP 9.1 chega como violação de RLS, que é ilegível para o usuário.
const traduzirErroInsert = (msg) => (
  /row-level security/i.test(msg || '')
    ? 'Você tem um chamado fechado esperando avaliação. Avalie-o para poder abrir um novo.'
    : `Não foi possível abrir o chamado: ${msg}`
);

/**
 * Abre o chamado: sobe os anexos, grava o envelope e monta a cadeia de
 * aprovação quando o serviço tem alçada.
 *
 * O SLA segue o POP (passo 10): serviço COM alçada nasce 'aguardando_aprovacao'
 * e o relógio só começa na decisão do gerente; sem alçada, o chamado já nasce
 * 'aberto' e o vencimento conta da criação.
 *
 * Devolve { chamado, atendenteNome } — o nome alimenta o aviso do passo 5.
 */
export async function criarChamado({
  classe, servico, assunto, natureza, descricao, campos = {}, arquivos = [], solicitanteId,
  config = null,
}) {
  // O formulário já carregou a config para desenhar os campos extras; reusar
  // evita uma segunda ida ao banco no momento do envio.
  const cfg = config || await buscarConfigServico(classe, servico);

  const anexos = [];
  for (const file of arquivos) {
    // Sequencial de propósito: o upload já tem retry próprio e subir tudo de uma
    // vez atrapalha quem está em VPN/link fraco de obra.
    anexos.push(await enviarArquivo(BUCKET_ADM, file));
  }

  // Serviço com alçada só segura o chamado se houver a quem mandar: solicitante
  // sem superior (topo do organograma) abriria um chamado preso para sempre,
  // então nesse caso ele entra direto na fila.
  const aprovadorId = cfg.exige_aprovacao === true ? await buscarSuperior(solicitanteId) : null;
  const exigeAprovacao = !!aprovadorId;
  const agora = new Date();
  const vence = (!exigeAprovacao && cfg.sla_horas)
    ? new Date(agora.getTime() + cfg.sla_horas * 3600 * 1000).toISOString()
    : null;

  const { data: chamado, error } = await supabase
    .from('chamados_adm')
    .insert({
      classe,
      servico,
      assunto,
      natureza,
      descricao: descricao.trim(),
      campos,
      anexos,
      solicitante_id: solicitanteId,
      atendente_id: cfg.atendente_id,
      exige_aprovacao: exigeAprovacao,
      status: exigeAprovacao ? 'aguardando_aprovacao' : 'aberto',
      sla_vence_em: vence,
    })
    .select('id, numero, status, atendente_id')
    .single();
  if (error) throw new Error(traduzirErroInsert(error.message));

  // Etapa única: o superior direto. A tabela aceita cadeia com várias ordens,
  // caso a regra mude para alçada por valor mais tarde.
  if (exigeAprovacao) {
    const { error: erroEtapas } = await supabase.from('chamados_adm_etapas').insert({
      chamado_id: chamado.id,
      ordem: 1,
      aprovador_id: aprovadorId,
    });
    // O chamado já existe; falhar aqui deixaria um chamado sem quem aprovar,
    // então avisamos em vez de fingir sucesso.
    if (erroEtapas) {
      throw new Error(
        `O chamado #${chamado.numero} foi aberto, mas a cadeia de aprovação não foi criada `
        + `(${erroEtapas.message}). Avise o time do Administrativo.`,
      );
    }
  }

  // Pela RPC, não por select direto: a policy colaboradores_select só libera a
  // própria linha e a equipe, então o solicitante comum não leria o nome do
  // técnico — e o aviso do passo 5 sairia sem o nome, calado.
  let atendenteNome = '';
  if (chamado.atendente_id) {
    const { data } = await supabase.rpc('nomes_colaboradores', { p_ids: [chamado.atendente_id] });
    atendenteNome = data?.[0]?.nome || '';
  }

  return { chamado, atendenteNome };
}

/**
 * Chamados do solicitante. `fechados` separa as duas listas do POP
 * (passos 6 e 7), que têm colunas diferentes.
 */
export async function listarMeusChamados(solicitanteId, { fechados = false } = {}) {
  const query = supabase
    .from('chamados_adm')
    .select('id, numero, classe, servico, assunto, status, criado_em, analise_em, sla_vence_em, fechado_em, atendente_id')
    .eq('solicitante_id', solicitanteId);

  const { data, error } = fechados
    ? await query.eq('status', 'fechado').order('fechado_em', { ascending: false })
    : await query.neq('status', 'fechado').order('criado_em', { ascending: false });
  if (error) throw new Error(`Não foi possível carregar seus chamados: ${error.message}`);

  // Nome do técnico (coluna "Técnico" nas duas listas). Tem que sair pela RPC
  // nomes_colaboradores: o atendente não é subordinado do solicitante, então a
  // policy colaboradores_select devolveria nada e a coluna ficaria vazia.
  const ids = [...new Set((data || []).map((c) => c.atendente_id).filter(Boolean))];
  const nomes = new Map();
  if (ids.length) {
    const { data: pessoas } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
    (pessoas || []).forEach((p) => nomes.set(p.id, p.nome));
  }
  return (data || []).map((c) => ({ ...c, atendenteNome: nomes.get(c.atendente_id) || '' }));
}

/**
 * Chamados esperando a MINHA aprovação (POP, passo 10).
 *
 * Duas consultas em vez de um join: a lista sai das etapas (onde está o meu
 * nome), e o envelope vem depois por id. Buscar direto em chamados_adm com
 * status 'aguardando_aprovacao' traria também os meus próprios pedidos — a RLS
 * me deixa ver o que eu abri.
 */
export async function listarAprovacoesPendentes(colaboradorId) {
  const { data: etapas, error } = await supabase
    .from('chamados_adm_etapas')
    .select('id, ordem, chamado_id')
    .eq('aprovador_id', colaboradorId)
    .eq('status', 'pendente');
  if (error) throw new Error(`Não foi possível carregar as aprovações: ${error.message}`);
  if (!etapas?.length) return [];

  const { data: chamados, error: erroChamados } = await supabase
    .from('chamados_adm')
    .select('id, numero, classe, servico, assunto, descricao, campos, anexos, criado_em, solicitante_id, status')
    .in('id', etapas.map((e) => e.chamado_id))
    .eq('status', 'aguardando_aprovacao')
    .order('criado_em', { ascending: true });
  if (erroChamados) throw new Error(`Não foi possível carregar os chamados: ${erroChamados.message}`);

  const ids = [...new Set((chamados || []).map((c) => c.solicitante_id))];
  const nomes = new Map();
  if (ids.length) {
    const { data: pessoas } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
    (pessoas || []).forEach((p) => nomes.set(p.id, p.nome));
  }

  const etapaPorChamado = new Map(etapas.map((e) => [e.chamado_id, e]));
  return (chamados || []).map((c) => ({
    ...c,
    etapaId: etapaPorChamado.get(c.id)?.id,
    solicitanteNome: nomes.get(c.solicitante_id) || '',
  }));
}

/**
 * Decide a etapa e move o chamado. É aqui que o relógio do SLA começa: o POP é
 * explícito em que o prazo conta a partir da aprovação, não da abertura.
 *
 * UPDATE barrado pela RLS não dá erro no Postgres — dá zero linhas. Por isso
 * todo update abaixo usa .select() e trata lista vazia como falha; sem isso o
 * aprovador veria "aprovado" com o chamado intacto.
 */
export async function decidirChamado({ chamadoId, etapaId, aprovar, justificativa = '' }) {
  const agora = new Date();
  const { data: etapaOk, error: erroEtapa } = await supabase
    .from('chamados_adm_etapas')
    .update({
      status: aprovar ? 'aprovada' : 'reprovada',
      justificativa: justificativa.trim() || null,
      decidido_em: agora.toISOString(),
    })
    .eq('id', etapaId)
    .select('id');
  if (erroEtapa) throw new Error(`Não foi possível registrar a decisão: ${erroEtapa.message}`);
  if (!etapaOk?.length) throw new Error('A decisão não foi registrada — você não é o aprovador desta etapa.');

  // Reprovou: encerra o chamado, sem prazo a contar.
  if (!aprovar) {
    const { data, error } = await supabase
      .from('chamados_adm')
      .update({ status: 'reprovado', analise_em: agora.toISOString(), updated_at: agora.toISOString() })
      .eq('id', chamadoId)
      .select('id');
    if (error) throw new Error(`Não foi possível reprovar o chamado: ${error.message}`);
    if (!data?.length) throw new Error('A reprovação não foi gravada no chamado.');
    return { status: 'reprovado' };
  }

  // Cadeia com mais de uma etapa: só libera quando não sobrar pendente.
  const { data: pendentes } = await supabase
    .from('chamados_adm_etapas')
    .select('id')
    .eq('chamado_id', chamadoId)
    .eq('status', 'pendente');
  if (pendentes?.length) return { status: 'aguardando_aprovacao' };

  const { data: chamado } = await supabase
    .from('chamados_adm').select('classe, servico').eq('id', chamadoId).maybeSingle();
  const cfg = chamado ? await buscarConfigServico(chamado.classe, chamado.servico) : null;
  const vence = cfg?.sla_horas
    ? new Date(agora.getTime() + cfg.sla_horas * 3600 * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('chamados_adm')
    .update({
      status: 'aberto',
      analise_em: agora.toISOString(),
      sla_vence_em: vence,
      updated_at: agora.toISOString(),
    })
    .eq('id', chamadoId)
    .select('id');
  if (error) throw new Error(`Não foi possível liberar o chamado: ${error.message}`);
  if (!data?.length) throw new Error('A aprovação não foi gravada no chamado.');
  return { status: 'aberto' };
}

/** Chamado fechado e ainda não avaliado trava a abertura de novos (POP 9.1). */
export async function buscarAvaliacaoPendente(solicitanteId) {
  const { data, error } = await supabase
    .from('chamados_adm')
    .select('id, numero, assunto, fechado_em, chamados_adm_avaliacoes(id)')
    .eq('solicitante_id', solicitanteId)
    .eq('status', 'fechado')
    .order('fechado_em', { ascending: true });
  if (error) return null;
  return (data || []).find((c) => !c.chamados_adm_avaliacoes?.length) || null;
}
