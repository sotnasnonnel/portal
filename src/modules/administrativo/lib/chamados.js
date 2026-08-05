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
    .select('atendente_id, sla_horas, exige_aprovacao, aprovadores')
    .eq('classe', classe)
    .eq('servico', servico)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível ler a configuração do serviço: ${error.message}`);
  return data || { atendente_id: null, sla_horas: null, exige_aprovacao: false, aprovadores: [] };
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
}) {
  const cfg = await buscarConfigServico(classe, servico);

  const anexos = [];
  for (const file of arquivos) {
    // Sequencial de propósito: o upload já tem retry próprio e subir tudo de uma
    // vez atrapalha quem está em VPN/link fraco de obra.
    anexos.push(await enviarArquivo(BUCKET_ADM, file));
  }

  const exigeAprovacao = cfg.exige_aprovacao === true;
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

  // Cadeia de aprovação, na ordem cadastrada.
  const aprovadores = exigeAprovacao ? (cfg.aprovadores || []) : [];
  if (aprovadores.length) {
    const { error: erroEtapas } = await supabase.from('chamados_adm_etapas').insert(
      aprovadores.map((aprovadorId, i) => ({
        chamado_id: chamado.id,
        ordem: i + 1,
        aprovador_id: aprovadorId,
      })),
    );
    // O chamado já existe; falhar aqui deixaria um chamado sem quem aprovar,
    // então avisamos em vez de fingir sucesso.
    if (erroEtapas) {
      throw new Error(
        `O chamado #${chamado.numero} foi aberto, mas a cadeia de aprovação não foi criada `
        + `(${erroEtapas.message}). Avise o time do Administrativo.`,
      );
    }
  }

  let atendenteNome = '';
  if (chamado.atendente_id) {
    const { data: atendente } = await supabase
      .from('colaboradores').select('nome').eq('id', chamado.atendente_id).maybeSingle();
    atendenteNome = atendente?.nome || '';
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

  // Nome do técnico: a coluna "Técnico" aparece nas duas listas. Uma consulta
  // só para todos os ids, em vez de join (a RLS de colaboradores é permissiva
  // para leitura de nome, mas o join encareceria a policy do chamado).
  const ids = [...new Set((data || []).map((c) => c.atendente_id).filter(Boolean))];
  const nomes = new Map();
  if (ids.length) {
    const { data: pessoas } = await supabase.from('colaboradores').select('id, nome').in('id', ids);
    (pessoas || []).forEach((p) => nomes.set(p.id, p.nome));
  }
  return (data || []).map((c) => ({ ...c, atendenteNome: nomes.get(c.atendente_id) || '' }));
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
