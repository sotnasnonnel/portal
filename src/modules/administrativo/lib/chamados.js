import { supabase } from '../../../services/supabase';
// Reaproveita o upload das Requisições DP: ele carrega o tratamento de arquivo
// "só na nuvem" (OneDrive) e o retry de rede, que custaram caro para acertar.
// Duplicar aqui seria perder isso silenciosamente.
import { enviarArquivo } from '../../../pages/Gestor/requisicoes/uploadAnexo';
import { resolverPapeis, PapelNaoAtribuidoError } from '../../../services/alcadas';
import { avaliarAlcada, PAPEL_LABEL } from '../../../config/alcadas';
import {
  decidirAprovacao, cadeiaDoFluxo, juntarCadeias, papeisForaDaCadeia,
} from './alcadaAdm';
import { proximoStatusAoResponder } from './statusChamado';
import { venceEmISO } from './prazo';
import { contarNaoLidas } from './painel';
import { temAvaliacao } from './satisfacao';
import { desdobrarMobilizacao } from './desdobramento';
import { getServico } from '../../../config/administrativo';
import { notificarChamadoAdm } from '../../../services/notificarChamadoAdm';

export const BUCKET_ADM = 'chamados-adm-anexos';

/** Rótulo do serviço no catálogo — o assunto do chamado, como no resto do módulo. */
const rotuloDoServico = (classe, servico) => getServico(classe, servico)?.label || servico;

/**
 * Configuração do par (classe, serviço): atendente padrão, SLA e alçada.
 * Serviço ainda não cadastrado cai no padrão neutro — o chamado abre sem
 * técnico e sem prazo em vez de dar erro na cara do solicitante.
 */
export async function buscarConfigServico(classe, servico) {
  const { data, error } = await supabase
    .from('chamados_adm_config')
    .select('atendente_id, sla_dias_uteis, exige_aprovacao, aprovadores, campos_extras')
    .eq('classe', classe)
    .eq('servico', servico)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível ler a configuração do serviço: ${error.message}`);
  return data || {
    atendente_id: null, sla_dias_uteis: null, exige_aprovacao: false, aprovadores: [], campos_extras: [],
  };
}

/** Todas as configurações de uma vez — a tela de cadastro lista serviço a serviço. */
export async function listarConfigs() {
  const { data, error } = await supabase
    .from('chamados_adm_config')
    .select('classe, servico, atendente_id, sla_dias_uteis, exige_aprovacao, aprovadores, campos_extras');
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
 * Tipo do Gestão de Pessoas usado como cadeia base do Administrativo.
 *
 * Lá o fluxo é por DOCUMENTO, não por pessoa: cada um tem uma cadeia por tipo.
 * `ajuda_custo` é o análogo mais próximo de um pedido de despesa, então é ele
 * que serve de base aqui. Uma constante para a troca ser de uma linha.
 */
export const TIPO_RH_BASE = 'ajuda_custo';

/**
 * Cadeia do solicitante no Gestão de Pessoas.
 *
 * Decisão da diretoria: o Adm não mantém cadeia própria, usa a que já existe
 * lá — assim quem muda de gestor não precisa ser recadastrado em dois lugares.
 * Quem não tem fluxo no RH cai no superior direto (105 das 134 pessoas hoje).
 */
export async function buscarFluxoRh(solicitanteId) {
  const { data, error } = await supabase
    .from('solicitacoes_rh_fluxos')
    .select('aprovadores')
    .eq('solicitante_id', solicitanteId)
    .eq('tipo', TIPO_RH_BASE)
    .maybeSingle();
  if (error) return [];               // silencioso: o superior direto cobre
  const lista = data?.aprovadores;
  return Array.isArray(lista) ? lista.filter(Boolean) : [];
}

/**
 * Nome da gerência do solicitante — o centro de custo do chamado.
 *
 * Vem do organograma (colaboradores.horas_gerencia_id), não do teclado: a
 * pessoa digitava o CC à mão em quase todo formulário e cada um escrevia de um
 * jeito, o que inviabiliza qualquer relatório por centro de custo depois.
 *
 * Devolve '' quando a pessoa não tem gerência (6 dos 134 hoje) — nesse caso o
 * campo volta a ser editável, em vez de travar num valor vazio.
 */
export async function buscarCentroDeCusto(gerenciaId) {
  if (!gerenciaId) return '';
  const { data, error } = await supabase
    .from('horas_gerencias')
    .select('nome')
    .eq('id', gerenciaId)
    .maybeSingle();
  if (error) return '';
  return data?.nome || '';
}

/** Cadeias cadastradas do solicitante (a geral e as por classe). */
export async function buscarFluxos(solicitanteId) {
  const { data, error } = await supabase
    .from('chamados_adm_fluxos')
    .select('classe, aprovadores')
    .eq('solicitante_id', solicitanteId);
  if (error) throw new Error(`Não foi possível ler o fluxo de aprovação: ${error.message}`);
  return data || [];
}

/**
 * Erro de cadeia vazia. Tipado para a tela poder tratar diferente de uma falha
 * de rede: aqui não adianta tentar de novo, alguém precisa cadastrar.
 */
export class SemAprovadorError extends Error {
  constructor() {
    super('Este serviço exige aprovação, mas não há aprovador definido para você. '
      + 'Peça ao Administrativo para cadastrar seu fluxo ou seu gestor no organograma.');
    this.name = 'SemAprovadorError';
  }
}

/**
 * A faixa exige um papel que não existe acima do solicitante no organograma.
 *
 * Diferente de "papel sem ninguém": aqui existe gente com o cargo, só não na
 * cadeia desta pessoa. Cair nela seria mandar a compra para um gestor de outra
 * área — por isso bloqueia, e a mensagem diz que o conserto é no organograma.
 */
export class PapelForaDaCadeiaError extends Error {
  constructor(papeis = []) {
    const nomes = papeis.map((p) => PAPEL_LABEL[p] || p).join(', ');
    super(`Este pedido precisa da aprovação de ${nomes}, mas não há ninguém com essa `
      + 'função acima de você no organograma. Peça ao Administrativo para ajustar '
      + 'o organograma antes de reenviar.');
    this.name = 'PapelForaDaCadeiaError';
  }
}

/**
 * Superior direto, tirado do organograma pela mesma RPC que a alçada usa.
 * Acompanha troca de gestor sozinho — cadastro pessoa a pessoa ficaria
 * desatualizado no primeiro remanejamento.
 */
async function superiorDireto(solicitanteId) {
  const { etapas } = await resolverPapeis(solicitanteId, ['GERENTE']);
  return etapas.map((e) => e.aprovadorId || e.candidatos?.[0]?.id).filter(Boolean);
}

/**
 * Quem aprova ANTES de qualquer papel de alçada, em três degraus:
 *
 *   1. cadeia própria do Adm, quando alguém cadastrou uma exceção;
 *   2. cadeia do Gestão de Pessoas — a decisão é usar a que já existe lá, para
 *      ninguém manter a mesma informação em dois lugares;
 *   3. superior direto do organograma, que cobre quem não tem nenhuma das duas
 *      (hoje 105 das 134 pessoas não têm fluxo no RH).
 */
async function cabecaDaCadeia(solicitanteId, classe) {
  // Exceção cadastrada no próprio Adm manda em tudo: alguém a criou de
  // propósito para esta pessoa.
  const doAdm = cadeiaDoFluxo(await buscarFluxos(solicitanteId), classe);
  if (doAdm.length) return { ids: doAdm, origem: 'adm' };

  const [gerente, doRh] = await Promise.all([
    superiorDireto(solicitanteId),
    buscarFluxoRh(solicitanteId),
  ]);

  // O gerente entra SEMPRE na frente, mesmo quando a cadeia do RH existe.
  // Em 9 das 23 pessoas com fluxo de ajuda de custo a cadeia do RH começa por
  // outra pessoa, e sem isto o gestor direto deixaria de ver o pedido do
  // próprio time. Quando os dois coincidem, a dedução resolve.
  if (doRh.length) return { ids: juntarCadeias(gerente, doRh), origem: 'rh' };

  return { ids: gerente, origem: 'superior' };
}

/**
 * Quem está no topo da hierarquia não tem superior — e não é uma lacuna de
 * cadastro, é o fim da linha. Exigir aprovador dele travaria o CEO com um
 * "peça para cadastrar seu gestor" que ninguém pode atender.
 *
 * Checado pelo papel na tabela de alçadas, não por nome ou e-mail: quando a
 * cadeira trocar de ocupante, isto acompanha sozinho.
 */
async function ehTopoDaHierarquia(solicitanteId) {
  const { etapas } = await resolverPapeis(solicitanteId, ['CEO']);
  return etapas.some((e) => e.aprovadorId === solicitanteId
    || e.candidatos?.some((c) => c.id === solicitanteId));
}

/**
 * Cadeia efetiva do solicitante, COM NOMES — para a tela de fluxos mostrar o
 * que valeria hoje, e não uma promessa que o motor não cumpre.
 *
 * Usa exatamente a mesma `cabecaDaCadeia` da criação do chamado: se as duas
 * lógicas divergissem, a tela viraria documentação errada de si mesma.
 */
export async function previewCadeiaEfetiva(solicitanteId, classe) {
  const { ids, origem } = await cabecaDaCadeia(solicitanteId, classe);
  if (!ids.length) return { origem, pessoas: [] };

  const { data } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
  const nomes = new Map((data || []).map((p) => [p.id, p.nome]));
  return { origem, pessoas: ids.map((id) => ({ id, nome: nomes.get(id) || '—' })) };
}

/**
 * Resolve QUEM aprova, nas duas dinâmicas do portal:
 * serviço com gasto → alçada por valor; os demais → fluxo cadastrado, e na
 * falta dele o superior direto.
 *
 * Devolve a lista ordenada de ids. Lança com mensagem pronta quando a alçada
 * exige um papel que não tem ninguém atrás — deixar passar seria pior do que
 * bloquear, porque o chamado seguiria sem a aprovação que a regra exige.
 */
export async function resolverAprovadores({ classe, servico, campos, exigeAprovacao, solicitanteId }) {
  const decisao = decidirAprovacao({ classe, servico, campos, exigeAprovacao });
  if (decisao.modo === 'nenhum') return { aprovadores: [], decisao };
  if (decisao.erro) throw new Error(decisao.erro);

  if (decisao.modo === 'fluxo') {
    const { ids: aprovadores, origem } = await cabecaDaCadeia(solicitanteId, classe);

    if (!aprovadores.length) {
      // Topo da hierarquia decide sozinho; qualquer outro sem cadeia é lacuna
      // de cadastro e o chamado NÃO abre. Deixar seguir transformaria "exige
      // aprovação" em letra morta, que é justamente o furo que isto corrige.
      if (await ehTopoDaHierarquia(solicitanteId)) {
        return { aprovadores: [], decisao: { ...decisao, origem: 'topo' } };
      }
      throw new SemAprovadorError();
    }
    return { aprovadores, decisao: { ...decisao, origem } };
  }

  // Alçada: o motor devolve PAPÉIS; a RPC traduz papel → pessoa subindo a cadeia.
  const avaliacao = avaliarAlcada({ tabela: decisao.tabela, valor: decisao.valor });
  const { etapas, lacunas } = await resolverPapeis(solicitanteId, avaliacao.papeis);
  if (lacunas.length) throw new PapelNaoAtribuidoError(lacunas);

  // Papel de cadeia resolvido fora dela é pior do que papel não resolvido: o
  // chamado seguiria para alguém de outra área, com aparência de normalidade.
  const foraDaCadeia = papeisForaDaCadeia(etapas);
  if (foraDaCadeia.length) throw new PapelForaDaCadeiaError(foraDaCadeia);

  // Papel de GRUPO volta com aprovadorId nulo (qualquer um do grupo agiria).
  // Aqui ele colapsa na primeira pessoa, como o DP faz hoje — a tabela de
  // etapas do Adm exige um aprovador nomeado.
  const daAlcada = etapas.map((e) => e.aprovadorId || e.candidatos?.[0]?.id).filter(Boolean);

  // O fluxo da pessoa decide ANTES da faixa: quem responde por ela avaliza o
  // pedido, e só então ele sobe para quem responde pelo valor. Abaixo de
  // R$ 20.000 a faixa não pede ninguém, então a cadeia é só o fluxo.
  //
  // Ausência de cabeça NÃO bloqueia aqui — diferente do fluxo comum: acima de
  // R$ 20.000 a faixa já garante aprovador, e exigir gestor travaria justamente
  // quem está no topo da hierarquia.
  const cabeca = await cabecaDaCadeia(solicitanteId, classe);
  const aprovadores = juntarCadeias(cabeca.ids, daAlcada);

  if (!aprovadores.length && !(await ehTopoDaHierarquia(solicitanteId))) {
    throw new SemAprovadorError();
  }
  return {
    aprovadores,
    decisao: { ...decisao, papeis: avaliacao.papeis, rotulo: avaliacao.rotulo, origem: cabeca.origem },
  };
}

/**
 * A trava do POP 9.1 chega como violação de RLS, que é ilegível para o usuário.
 * Mas a policy tem DUAS condições — a avaliação pendente e o solicitante ser
 * você mesmo — e antes qualquer violação virava "avalie o chamado anterior",
 * mandando a pessoa procurar uma avaliação que podia não existir.
 *
 * Por isso a pendência é confirmada antes de acusá-la, e o número entra na
 * mensagem: sem ele, não dá para saber qual chamado avaliar.
 */
async function traduzirErroInsert(msg, solicitanteId) {
  if (!/row-level security/i.test(msg || '')) {
    return `Não foi possível abrir o chamado: ${msg}`;
  }
  const pendente = await buscarAvaliacaoPendente(solicitanteId);
  if (pendente) {
    return `O chamado #${pendente.numero} foi fechado e ainda espera sua avaliação. `
      + 'Avalie-o em Meus chamados para poder abrir um novo.';
  }
  return 'Não foi possível abrir o chamado: seu usuário não tem permissão para '
    + 'abrir chamados em nome de outra pessoa. Se o erro persistir, avise o Administrativo.';
}

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
  config = null, origemChamadoId = null,
}) {
  // O formulário já carregou a config para desenhar os campos extras; reusar
  // evita uma segunda ida ao banco no momento do envio.
  const cfg = config || await buscarConfigServico(classe, servico);

  // Cadeia de aprovação: alçada por valor nos serviços de gasto, fluxo
  // cadastrado (ou o superior direto) nos demais. Serviço que exige aprovação e
  // não tem ninguém atrás lança — a lista só chega aqui vazia quando o serviço
  // realmente dispensa aprovação.
  //
  // Resolvido ANTES do upload de propósito: barrar depois de subir os arquivos
  // deixaria anexo órfão no bucket e teria feito quem está em link de obra
  // esperar o upload inteiro para só então ouvir que o chamado não abre.
  const { aprovadores } = await resolverAprovadores({
    classe, servico, campos, exigeAprovacao: cfg.exige_aprovacao === true, solicitanteId,
  });
  const exigeAprovacao = aprovadores.length > 0;

  const anexos = [];
  for (const file of arquivos) {
    // Sequencial de propósito: o upload já tem retry próprio e subir tudo de uma
    // vez atrapalha quem está em VPN/link fraco de obra.
    anexos.push(await enviarArquivo(BUCKET_ADM, file));
  }

  const agora = new Date();
  const vence = exigeAprovacao ? null : venceEmISO(agora, cfg.sla_dias_uteis);

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
      // Só vai no insert quando existe: chamado avulso não tem origem, e mandar
      // a coluna com null em todo insert acoplaria o fluxo comum a esta feature.
      ...(origemChamadoId ? { origem_chamado_id: origemChamadoId } : {}),
    })
    .select('id, numero, status, atendente_id')
    .single();
  if (error) throw new Error(await traduzirErroInsert(error.message, solicitanteId));

  // A cadeia inteira, na ordem: quem vem primeiro decide primeiro, e o chamado
  // só é liberado quando não sobrar etapa pendente.
  if (exigeAprovacao) {
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

  // Pela RPC, não por select direto: a policy colaboradores_select só libera a
  // própria linha e a equipe, então o solicitante comum não leria o nome do
  // técnico — e o aviso do passo 5 sairia sem o nome, calado.
  //
  // Técnico e cadeia de aprovação vão na MESMA chamada: são a mesma pergunta
  // ("como se chamam estas pessoas?") e separá-las custaria uma ida a mais.
  const paraNomear = [chamado.atendente_id, ...aprovadores].filter(Boolean);
  const nomes = new Map();
  if (paraNomear.length) {
    const { data } = await supabase.rpc('nomes_colaboradores', { p_ids: paraNomear });
    (data || []).forEach((p) => nomes.set(p.id, p.nome));
  }
  const atendenteNome = nomes.get(chamado.atendente_id) || '';
  // Na ordem em que vão decidir — quem abriu precisa saber por quem o pedido
  // passa, e em que sequência. Sem isso, dois pedidos parecidos com valores
  // diferentes caem em aprovadores diferentes e parece defeito do sistema.
  const aprovadoresNomes = aprovadores.map((id) => nomes.get(id)).filter(Boolean);

  // Aviso ao aprovador da vez: sem e-mail, ele só descobriria se abrisse a tela.
  if (exigeAprovacao) notificarChamadoAdm(chamado.id, 'aprovacao');

  return { chamado, atendenteNome, aprovadoresNomes };
}

/**
 * Abre a mobilização e, junto, os chamados dos adicionais escolhidos.
 *
 * A mobilização continua inteira, como foi preenchida. Os adicionais viram
 * pedidos próprios no serviço de TI ou de Saúde e segurança, para que quem
 * aprova equipamento não precise abrir mobilizações de pessoa para achar o que
 * lhe cabe.
 *
 * TUDO é validado antes de qualquer gravação. Não há transação entre inserts
 * pelo cliente, então a única defesa contra "mobilização gravada e filhos pela
 * metade" é descobrir cedo que um deles não passaria — tipicamente por falta de
 * aprovador. Se algo escapar mesmo assim, o pai já existe e o erro diz quais
 * filhos ficaram de fora, com o número do pai para não perdê-lo de vista.
 *
 * @returns {{chamado, atendenteNome, filhos: Array<{numero, classe, servico}>}}
 */
export async function criarMobilizacaoComAdicionais({
  assunto, natureza, descricao, campos = {}, solicitanteId, config = null,
}) {
  const filhos = desdobrarMobilizacao(campos);

  // Configuração de cada filho, buscada uma vez só e reaproveitada no insert.
  const preparados = [];
  for (const filho of filhos) {
    const cfg = await buscarConfigServico(filho.classe, filho.servico);
    // Lança quando falta aprovador — de propósito, ANTES de gravar o pai.
    await resolverAprovadores({
      classe: filho.classe,
      servico: filho.servico,
      campos: filho.campos,
      exigeAprovacao: cfg.exige_aprovacao === true,
      solicitanteId,
    });
    preparados.push({ ...filho, config: cfg });
  }

  const pai = await criarChamado({
    classe: 'mobilizacao',
    servico: 'mobilizacao',
    assunto,
    natureza,
    descricao,
    campos,
    arquivos: [],          // mobilização não tem anexo
    solicitanteId,
    config,
  });

  const criados = [];
  const falhas = [];
  for (const filho of preparados) {
    try {
      const { chamado } = await criarChamado({
        classe: filho.classe,
        servico: filho.servico,
        assunto: rotuloDoServico(filho.classe, filho.servico),
        natureza,
        descricao: filho.descricao,
        campos: filho.campos,
        arquivos: [],
        solicitanteId,
        config: filho.config,
        origemChamadoId: pai.chamado.id,
      });
      criados.push({ numero: chamado.numero, classe: filho.classe, servico: filho.servico });
    } catch (e) {
      falhas.push(`${rotuloDoServico(filho.classe, filho.servico)} (${e.message})`);
    }
  }

  if (falhas.length) {
    throw new Error(
      `A mobilização foi aberta com o número #${pai.chamado.numero}, mas estes pedidos `
      + `não puderam ser abertos junto: ${falhas.join('; ')}. `
      + 'Abra-os pelo catálogo ou avise o time do Administrativo.',
    );
  }

  return { ...pai, filhos: criados };
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
  const naoLidas = await contarNaoLidasPorChamado(
    (data || []).map((c) => c.id), { meuId: solicitanteId, souSolicitante: true },
  );
  return (data || []).map((c) => ({
    ...c, atendenteNome: nomes.get(c.atendente_id) || '', naoLidas: naoLidas[c.id] || 0,
  }));
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
  const { data: minhas, error } = await supabase
    .from('chamados_adm_etapas')
    .select('id, ordem, chamado_id')
    .eq('aprovador_id', colaboradorId)
    .eq('status', 'pendente');
  if (error) throw new Error(`Não foi possível carregar as aprovações: ${error.message}`);
  if (!minhas?.length) return [];

  // Numa cadeia, só é a minha vez se não houver etapa pendente ANTES da minha —
  // senão o segundo aprovador veria o chamado antes de o primeiro decidir.
  const { data: pendentes } = await supabase
    .from('chamados_adm_etapas')
    .select('chamado_id, ordem')
    .in('chamado_id', minhas.map((e) => e.chamado_id))
    .eq('status', 'pendente');
  const menorPendente = new Map();
  (pendentes || []).forEach((e) => {
    const atual = menorPendente.get(e.chamado_id);
    if (atual === undefined || e.ordem < atual) menorPendente.set(e.chamado_id, e.ordem);
  });
  const etapas = minhas.filter((e) => menorPendente.get(e.chamado_id) === e.ordem);
  if (!etapas.length) return [];

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
    notificarChamadoAdm(chamadoId, 'decidido');
    return { status: 'reprovado' };
  }

  // Cadeia com mais de uma etapa: só libera quando não sobrar pendente.
  const { data: pendentes } = await supabase
    .from('chamados_adm_etapas')
    .select('id')
    .eq('chamado_id', chamadoId)
    .eq('status', 'pendente');
  // Ainda há etapa adiante: avisa o PRÓXIMO aprovador, não o solicitante.
  if (pendentes?.length) {
    notificarChamadoAdm(chamadoId, 'aprovacao');
    return { status: 'aguardando_aprovacao' };
  }

  const { data: chamado } = await supabase
    .from('chamados_adm').select('classe, servico').eq('id', chamadoId).maybeSingle();
  const cfg = chamado ? await buscarConfigServico(chamado.classe, chamado.servico) : null;
  const vence = venceEmISO(agora, cfg?.sla_dias_uteis);

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
  notificarChamadoAdm(chamadoId, 'decidido');
  return { status: 'aberto' };
}

/** Um chamado com tudo que a tela de detalhe mostra. */
export async function buscarChamado(id) {
  const { data, error } = await supabase
    .from('chamados_adm')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível abrir o chamado: ${error.message}`);
  if (!data) return null;

  const ids = [data.solicitante_id, data.atendente_id].filter(Boolean);
  const nomes = new Map();
  if (ids.length) {
    const { data: pessoas } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
    (pessoas || []).forEach((p) => nomes.set(p.id, p.nome));
  }
  const { data: avaliacao } = await supabase
    .from('chamados_adm_avaliacoes').select('*').eq('chamado_id', id).maybeSingle();

  return {
    ...data,
    solicitanteNome: nomes.get(data.solicitante_id) || '',
    atendenteNome: nomes.get(data.atendente_id) || '',
    avaliacao: avaliacao || null,
  };
}

/**
 * Fila do time do Adm. `apenasMeus` filtra pelos que estão no meu nome; sem
 * isso, mostra tudo que ainda não fechou — inclusive o que não tem atendente,
 * que é justamente o que ninguém está olhando.
 */
export async function listarFila(colaboradorId, { apenasMeus = false } = {}) {
  let q = supabase
    .from('chamados_adm')
    .select('id, numero, classe, servico, assunto, status, criado_em, sla_vence_em, solicitante_id, atendente_id')
    .neq('status', 'fechado')
    .neq('status', 'cancelado')
    .order('criado_em', { ascending: true });
  if (apenasMeus) q = q.eq('atendente_id', colaboradorId);

  const { data, error } = await q;
  if (error) throw new Error(`Não foi possível carregar a fila: ${error.message}`);

  const ids = [...new Set((data || []).flatMap((c) => [c.solicitante_id, c.atendente_id]).filter(Boolean))];
  const nomes = new Map();
  if (ids.length) {
    const { data: pessoas } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
    (pessoas || []).forEach((p) => nomes.set(p.id, p.nome));
  }
  const naoLidas = await contarNaoLidasPorChamado(
    (data || []).map((c) => c.id), { meuId: colaboradorId, souSolicitante: false },
  );
  return (data || []).map((c) => ({
    ...c,
    solicitanteNome: nomes.get(c.solicitante_id) || '',
    atendenteNome: nomes.get(c.atendente_id) || '',
    naoLidas: naoLidas[c.id] || 0,
  }));
}

/**
 * Quantas mensagens de cada chamado ainda não foram lidas por mim.
 *
 * Uma consulta só para a lista inteira: uma por chamado transformaria a fila
 * em dezenas de idas ao banco. A RLS já esconde a nota interna de quem é
 * solicitante, então o número sai certo para os dois lados.
 */
export async function contarNaoLidasPorChamado(chamadoIds, { meuId, souSolicitante }) {
  if (!chamadoIds?.length) return {};
  const { data, error } = await supabase
    .from('chamados_adm_interacoes')
    .select('chamado_id, autor_id, lida_solicitante_em, lida_atendente_em')
    .in('chamado_id', chamadoIds);
  if (error) return {};   // contador é enfeite: não vale derrubar a lista por ele

  const porChamado = {};
  for (const id of chamadoIds) {
    porChamado[id] = contarNaoLidas(
      (data || []).filter((i) => i.chamado_id === id),
      { meuId, souSolicitante },
    );
  }
  return porChamado;
}

/**
 * Chamados do quadro. Diferente da fila, traz também os encerrados — a coluna
 * "Concluído" existe para mostrar o que saiu, mas limitada aos recentes, senão
 * ela cresce para sempre e domina a tela.
 */
export async function listarQuadro(colaboradorId, { apenasMeus = false, souTime = false, diasConcluidos = 15 } = {}) {
  const corte = new Date(Date.now() - diasConcluidos * 24 * 3600 * 1000).toISOString();
  let q = supabase
    .from('chamados_adm')
    // `campos` vem junto por causa do CC, que mora dentro dele (chave 'cc').
    .select('id, numero, classe, servico, assunto, status, criado_em, sla_vence_em, fechado_em, solicitante_id, atendente_id, campos')
    .or(`status.not.in.(fechado,reprovado,cancelado),updated_at.gte.${corte}`)
    .order('criado_em', { ascending: true });
  if (apenasMeus) q = q.eq('atendente_id', colaboradorId);

  const { data, error } = await q;
  if (error) throw new Error(`Não foi possível carregar o quadro: ${error.message}`);

  const ids = [...new Set((data || []).flatMap((c) => [c.atendente_id, c.solicitante_id]).filter(Boolean))];
  const nomes = new Map();
  if (ids.length) {
    const { data: pessoas } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
    (pessoas || []).forEach((p) => nomes.set(p.id, p.nome));
  }
  // Quem não é do time do Adm está olhando o quadro como SOLICITANTE: a coluna
  // de leitura a consultar é a outra.
  const naoLidas = await contarNaoLidasPorChamado(
    (data || []).map((c) => c.id), { meuId: colaboradorId, souSolicitante: !souTime },
  );
  return (data || []).map((c) => ({
    ...c,
    atendenteNome: nomes.get(c.atendente_id) || '',
    solicitanteNome: nomes.get(c.solicitante_id) || '',
    cc: c.campos?.cc || '',
    naoLidas: naoLidas[c.id] || 0,
  }));
}

/**
 * Cadeia de aprovação do chamado, com os nomes resolvidos. A RLS já libera a
 * cadeia inteira para quem participa dela — solicitante, aprovadores e time do Adm.
 */
export async function listarEtapas(chamadoId) {
  const { data, error } = await supabase
    .from('chamados_adm_etapas')
    .select('id, ordem, aprovador_id, status, justificativa, decidido_em')
    .eq('chamado_id', chamadoId)
    .order('ordem', { ascending: true });
  if (error) throw new Error(`Não foi possível carregar o fluxo de aprovação: ${error.message}`);

  const ids = [...new Set((data || []).map((e) => e.aprovador_id).filter(Boolean))];
  const nomes = {};
  if (ids.length) {
    const { data: pessoas } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
    (pessoas || []).forEach((p) => { nomes[p.id] = p.nome; });
  }
  return { etapas: data || [], nomes };
}

/** Conversa do chamado. A RLS já esconde a nota interna de quem é solicitante. */
export async function listarInteracoes(chamadoId) {
  const { data, error } = await supabase
    .from('chamados_adm_interacoes')
    .select('*')
    .eq('chamado_id', chamadoId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Não foi possível carregar as mensagens: ${error.message}`);

  const ids = [...new Set((data || []).map((i) => i.autor_id))];
  const nomes = new Map();
  if (ids.length) {
    const { data: pessoas } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
    (pessoas || []).forEach((p) => nomes.set(p.id, p.nome));
  }
  return (data || []).map((i) => ({ ...i, autorNome: nomes.get(i.autor_id) || '' }));
}

/**
 * Eventos do chamado (gravados por trigger). Resolve os nomes num lote só:
 * o autor de cada evento e, na atribuição, o técnico que entrou.
 */
export async function listarEventos(chamadoId) {
  const { data, error } = await supabase
    .from('chamados_adm_eventos')
    .select('*')
    .eq('chamado_id', chamadoId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Não foi possível carregar o histórico: ${error.message}`);

  const ehUuid = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
  const ids = [...new Set((data || []).flatMap((e) => [
    e.autor_id,
    // Em 'atribuido' o de/para guardam ids; nos demais eventos são status.
    e.tipo === 'atribuido' ? e.para : null,
    e.tipo === 'atribuido' ? e.de : null,
  ]).filter(ehUuid))];

  const nomes = {};
  if (ids.length) {
    const { data: pessoas } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
    (pessoas || []).forEach((p) => { nomes[p.id] = p.nome; });
  }
  return { eventos: data || [], nomes };
}

export async function enviarInteracao({ chamadoId, autorId, mensagem, interna = false, arquivos = [] }) {
  const anexos = [];
  for (const file of arquivos) anexos.push(await enviarArquivo(BUCKET_ADM, file));

  const { data, error } = await supabase
    .from('chamados_adm_interacoes')
    .insert({ chamado_id: chamadoId, autor_id: autorId, mensagem: mensagem.trim(), interna, anexos })
    .select('id')
    .single();
  if (error) throw new Error(`Não foi possível enviar a mensagem: ${error.message}`);
  return data;
}

/**
 * Envia a mensagem e move o chamado de estado: responder passa a bola.
 *
 * A mudança de estado é secundária — se ela falhar, a mensagem já foi enviada e
 * não faz sentido derrubar a ação inteira por causa do status.
 */
export async function responder({ chamado, autorId, mensagem, interna = false, arquivos = [], souSolicitante }) {
  await enviarInteracao({ chamadoId: chamado.id, autorId, mensagem, interna, arquivos });

  if (!interna) notificarChamadoAdm(chamado.id, 'mensagem');

  const novo = proximoStatusAoResponder({ statusAtual: chamado.status, souSolicitante, interna });
  if (!novo) return { status: chamado.status };

  const { data } = await supabase
    .from('chamados_adm')
    .update({ status: novo, updated_at: new Date().toISOString() })
    .eq('id', chamado.id)
    .select('id');
  return { status: data?.length ? novo : chamado.status };
}

/** Marca como lidas as mensagens do outro lado. Silencioso: é conveniência. */
export async function marcarLidas(chamadoId, { souSolicitante }) {
  const campo = souSolicitante ? 'lida_solicitante_em' : 'lida_atendente_em';
  await supabase
    .from('chamados_adm_interacoes')
    .update({ [campo]: new Date().toISOString() })
    .eq('chamado_id', chamadoId)
    .is(campo, null);
}

// UPDATE barrado pela RLS não dá erro, dá zero linhas — por isso todo update
// abaixo confere o retorno em vez de confiar na ausência de erro.
const exigirLinha = (data, erro, mensagem) => {
  if (erro) throw new Error(`${mensagem}: ${erro.message}`);
  if (!data?.length) throw new Error(`${mensagem}: você não tem permissão para esta ação.`);
};

/** O atendente puxa o chamado para si (ou o admin reatribui). */
export async function assumirChamado(chamadoId, atendenteId) {
  const { data, error } = await supabase
    .from('chamados_adm')
    .update({ atendente_id: atendenteId, updated_at: new Date().toISOString() })
    .eq('id', chamadoId)
    .select('id');
  exigirLinha(data, error, 'Não foi possível assumir o chamado');
}

/** Fechamento com a "Resolução da solicitação" do passo 9 do POP. */
export async function fecharChamado(chamadoId, resolucao) {
  const agora = new Date().toISOString();
  const { data, error } = await supabase
    .from('chamados_adm')
    .update({ status: 'fechado', fechado_em: agora, resolucao: resolucao.trim(), updated_at: agora })
    .eq('id', chamadoId)
    .select('id');
  exigirLinha(data, error, 'Não foi possível fechar o chamado');
  notificarChamadoAdm(chamadoId, 'fechado');
}

/** Reabertura pelo solicitante. O prazo de 3 dias é garantido por trigger. */
export async function reabrirChamado(chamadoId, reaberturas = 0) {
  const agora = new Date().toISOString();
  const { data, error } = await supabase
    .from('chamados_adm')
    .update({
      status: 'aberto', fechado_em: null, reaberto_em: agora,
      reaberturas: reaberturas + 1, updated_at: agora,
    })
    .eq('id', chamadoId)
    .select('id');
  if (error && /3 dias/i.test(error.message)) {
    throw new Error('O prazo de 3 dias para reabrir este chamado já passou.');
  }
  exigirLinha(data, error, 'Não foi possível reabrir o chamado');
}

/** Pesquisa de satisfação (POP 9). Nota ruim exige comentário — o banco confere. */
export async function avaliarChamado(chamadoId, nota, comentario = '') {
  const { error } = await supabase
    .from('chamados_adm_avaliacoes')
    .insert({ chamado_id: chamadoId, nota, comentario: comentario.trim() || null });
  if (error) {
    if (/comentario_obrigatorio/i.test(error.message)) {
      throw new Error('Para esta nota é obrigatório escrever um comentário.');
    }
    throw new Error(`Não foi possível registrar a avaliação: ${error.message}`);
  }
}

/** Bucket é privado: o download sai por URL assinada, não por link público. */
export async function urlDoAnexo(path, segundos = 120) {
  const { data, error } = await supabase.storage.from(BUCKET_ADM).createSignedUrl(path, segundos);
  if (error) throw new Error(`Não foi possível abrir o anexo: ${error.message}`);
  return data.signedUrl;
}

/**
 * Todas as avaliações, com a classe e o serviço do chamado — a RLS já limita ao
 * time do Adm e aos envolvidos, e a tela que consome isto é só de admin.
 */
export async function listarAvaliacoes() {
  const { data, error } = await supabase
    .from('chamados_adm_avaliacoes')
    .select('nota, comentario, avaliado_em, chamados_adm(classe, servico)')
    .order('avaliado_em', { ascending: false });
  if (error) throw new Error(`Não foi possível carregar as avaliações: ${error.message}`);
  return (data || []).map((a) => ({
    nota: a.nota,
    comentario: a.comentario,
    avaliado_em: a.avaliado_em,
    classe: a.chamados_adm?.classe || '',
    servico: a.chamados_adm?.servico || '',
  }));
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
  return (data || []).find((c) => !temAvaliacao(c.chamados_adm_avaliacoes)) || null;
}
