import { supabase } from '../../../services/supabase';
import { notificarPrograma } from '../../../services/notificarPrograma';
import { getTermosPrograma } from '../../../config/programasTermos';
import { avaliarElegibilidade } from './elegibilidade';

/**
 * Acesso a dados do programa Alavanca PHD.
 *
 * A RLS decide o recorte sozinha: quem indicou enxerga as próprias indicações,
 * o time comercial enxerga todas. Por isso as duas telas (Minhas indicações e
 * Painel do comercial) usam a MESMA consulta — não há filtro por papel aqui, o
 * que evita o clássico "esqueci o filtro no lugar novo".
 */

const COLUNAS = `
  id, numero, oportunidade, descricao, empresa,
  contato_nome, contato_cargo, contato_telefone, contato_email, tratativas,
  indicado_por, status, comentario,
  elegibilidade, elegibilidade_motivo, elegibilidade_em,
  valor_contrato, valor_premio, pago_em, concluida_em, criado_em, updated_at
`;

/**
 * Quem indicou, pela RPC `nomes_colaboradores`. Select direto em colaboradores
 * não serve: a RLS de lá só libera a própria linha e os subordinados, e o
 * comercial precisa nomear indicações vindas de qualquer área da empresa.
 */
async function anexarIndicadores(linhas) {
  const ids = [...new Set(linhas.map((l) => l.indicado_por).filter(Boolean))];
  if (!ids.length) return linhas.map((l) => ({ ...l, indicadorNome: '' }));
  const { data } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
  const nomes = new Map((data || []).map((p) => [p.id, p.nome]));
  return linhas.map((l) => ({ ...l, indicadorNome: nomes.get(l.indicado_por) || '' }));
}

export async function listarIndicacoes() {
  const { data, error } = await supabase
    .from('programas_alavanca')
    .select(COLUNAS)
    .order('criado_em', { ascending: false });
  if (error) throw new Error(`Não foi possível carregar as indicações: ${error.message}`);
  return anexarIndicadores(data || []);
}

/**
 * Grava a indicação e devolve o veredito de elegibilidade junto — é o que a
 * planilha pede ("aparecer mensagem de elegibilidade logo após o envio").
 *
 * A checagem roda ANTES do insert para que o resultado já nasça na linha: se
 * fosse depois, uma falha entre as duas chamadas deixaria a indicação eterna em
 * 'pendente' sem ninguém saber.
 *
 * Indicação não elegível continua sendo gravada, e de propósito: o comercial
 * precisa enxergar o que foi barrado e por quê, e quem indicou merece a
 * explicação em vez de um formulário que "não deixou enviar".
 */
export async function criarIndicacao(valores, autorId) {
  const empresa = (valores.empresa || '').trim();
  const veredito = await avaliarElegibilidade({
    empresa,
    contato: (valores.contato_nome || '').trim(),
    email: (valores.contato_email || '').trim(),
  });

  const linha = {
    oportunidade: (valores.oportunidade || '').trim(),
    descricao: (valores.descricao || '').trim(),
    empresa,
    contato_nome: (valores.contato_nome || '').trim(),
    contato_cargo: (valores.contato_cargo || '').trim(),
    contato_telefone: (valores.contato_telefone || '').trim(),
    contato_email: (valores.contato_email || '').trim(),
    tratativas: (valores.tratativas || '').trim(),
    indicado_por: autorId,
    // Barrada na checagem automática já entra fechada: deixá-la "em análise"
    // faria o comercial reavaliar na mão algo que o sistema já respondeu.
    status: veredito.elegibilidade === 'nao_elegivel' ? 'nao_elegivel' : 'em_analise',
    elegibilidade: veredito.elegibilidade,
    elegibilidade_motivo: veredito.motivo,
    elegibilidade_em: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('programas_alavanca')
    .insert([linha])
    .select('id, numero, status, elegibilidade, elegibilidade_motivo')
    .single();
  if (error) throw new Error(`Não foi possível registrar a indicação: ${error.message}`);

  await supabase.from('programas_alavanca_eventos').insert([
    { indicacao_id: data.id, tipo: 'criada', autor_id: autorId, para: linha.status },
    {
      indicacao_id: data.id,
      tipo: 'elegibilidade',
      autor_id: autorId,
      para: veredito.elegibilidade,
      texto: veredito.motivo,
    },
  ]);

  // Log do aceite das REGRAS (quem + quando + qual programa).
  const { error: eAceite } = await supabase.from('programas_termos_aceites').insert([{
    indicacao_id: data.id,
    colaborador_id: autorId,
    programa: 'alavanca',
    titulo: getTermosPrograma('alavanca')?.titulo ?? null,
    aceito_em: valores.aceite_em || new Date().toISOString(),
  }]);
  if (eAceite) console.warn('[alavanca] log do aceite falhou:', eAceite.message);

  // Dois avisos, com destinatários diferentes: a diretoria e o comercial
  // precisam saber que chegou indicação nova, e quem indicou precisa do
  // veredito de elegibilidade que a tela acabou de mostrar.
  notificarPrograma('alavanca_nova', { indicacao_id: data.id });
  notificarPrograma('alavanca_retorno', { indicacao_id: data.id });

  return { ...data, veredito };
}

/**
 * Atualização do "mapa geral" pelo time comercial: status, comentário e
 * premiação.
 *
 * Um método só para as três coisas porque elas viajam juntas na tela — o
 * diálogo de avaliação grava as três de uma vez — e porque o CHECK do banco
 * exige o valor do prêmio junto da conclusão: em chamadas separadas, uma delas
 * quebraria.
 */
export async function atualizarIndicacao(indicacao, mudancas, autorId) {
  const patch = { updated_at: new Date().toISOString() };
  if (mudancas.status !== undefined) patch.status = mudancas.status;
  if (mudancas.comentario !== undefined) patch.comentario = (mudancas.comentario || '').trim() || null;
  if (mudancas.valor_contrato !== undefined) patch.valor_contrato = mudancas.valor_contrato ?? null;
  if (mudancas.valor_premio !== undefined) patch.valor_premio = mudancas.valor_premio ?? null;
  if (mudancas.pago_em !== undefined) patch.pago_em = mudancas.pago_em || null;
  // Elegibilidade é automática (ver elegibilidade.js), mas o comercial pode
  // sobrepor: "Depende do comercial" existe justamente porque a máquina não
  // sabe se a oportunidade já tinha sido mapeada, e sem esta escrita a
  // indicação ficava presa nesse estado para sempre. O trigger do banco já
  // deixava a coluna fora das duas travas, à espera disto.
  if (mudancas.elegibilidade !== undefined) patch.elegibilidade = mudancas.elegibilidade;
  if (mudancas.elegibilidade_motivo !== undefined) {
    patch.elegibilidade_motivo = (mudancas.elegibilidade_motivo || '').trim() || null;
  }

  const concluindo = patch.status === 'concluida' && indicacao.status !== 'concluida';
  if (concluindo) patch.concluida_em = new Date().toISOString();

  // Carimbo de QUANDO a elegibilidade foi decidida. Sem isto a linha do tempo
  // continuaria mostrando a data da checagem automática que o comercial acabou
  // de contrariar.
  if (patch.elegibilidade !== undefined && patch.elegibilidade !== indicacao.elegibilidade) {
    patch.elegibilidade_em = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('programas_alavanca')
    .update(patch)
    .eq('id', indicacao.id)
    .select(COLUNAS)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível atualizar a indicação: ${error.message}`);
  if (!data) throw new Error('Só o time comercial pode atualizar o mapa de indicações.');

  // O que mudou de fato. Comparado campo a campo contra a indicação que veio da
  // tela, e não pelo "o campo foi enviado?": o diálogo manda os cinco campos
  // sempre, inclusive os que o comercial só olhou.
  const mudou = (campo, comparar = (a, b) => a !== b) =>
    patch[campo] !== undefined && comparar(patch[campo], indicacao[campo]);
  const comoNumero = (a, b) => Number(a || 0) !== Number(b || 0);

  const mudouStatus = mudou('status');
  const mudouComentario = mudou('comentario');
  const mudouPremio = mudou('valor_premio', comoNumero);
  const mudouContrato = mudou('valor_contrato', comoNumero);
  const mudouPagamento = mudou('pago_em');
  // O motivo entra junto: é ele que o e-mail mostra como "Motivo:", então
  // corrigir só a explicação — mantendo o veredito — também é notícia.
  const mudouElegibilidade = mudou('elegibilidade') || mudou('elegibilidade_motivo');

  const eventos = [];
  if (mudouElegibilidade) {
    eventos.push({
      indicacao_id: indicacao.id, tipo: 'elegibilidade', autor_id: autorId,
      de: indicacao.elegibilidade, para: patch.elegibilidade ?? indicacao.elegibilidade,
      texto: `Decidida pelo comercial. ${patch.elegibilidade_motivo ?? indicacao.elegibilidade_motivo ?? ''}`.trim(),
    });
  }
  if (mudouStatus) {
    eventos.push({
      indicacao_id: indicacao.id, tipo: 'status', autor_id: autorId,
      de: indicacao.status, para: patch.status,
    });
  }
  if (mudouComentario) {
    eventos.push({
      indicacao_id: indicacao.id, tipo: 'comentario', autor_id: autorId, texto: patch.comentario,
    });
  }
  // Premiação vira evento sempre que o valor muda, e não só na conclusão: o
  // valor passou a ser editável em qualquer status, e uma correção de prêmio
  // sem registro é exatamente o tipo de mudança que ninguém consegue explicar
  // depois. A data de pagamento entra no mesmo evento — é o outro lado do
  // dinheiro, e um evento por campo encheria a linha do tempo de ruído.
  if (concluindo || mudouPremio || mudouContrato || mudouPagamento) {
    const premio = Number(patch.valor_premio ?? indicacao.valor_premio ?? 0)
      .toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const quando = patch.pago_em ?? indicacao.pago_em;
    eventos.push({
      indicacao_id: indicacao.id, tipo: 'premiacao', autor_id: autorId,
      texto: `Prêmio de R$ ${premio}${quando ? ` · pagamento em ${quando}` : ''}`,
    });
  }
  if (eventos.length) await supabase.from('programas_alavanca_eventos').insert(eventos);

  // O retorno sai a cada salvamento do diálogo de avaliação, e não só na troca
  // de status. O comentário é o que EXPLICA a decisão: com o e-mail preso ao
  // status, quem indicou recebia "Em evolução" sem uma linha de contexto, e o
  // comentário escrito em seguida não chegava nunca.
  //
  // Vale para os valores também. Presa ao status, a data de pagamento era
  // preenchida em silêncio — e ela é justamente a notícia que quem indicou está
  // esperando. Salvar sem mexer em nada continua não mandando nada.
  //
  // O ruído que a regra antiga evitava morreu junto com a edição em três
  // lugares: agora é uma sentada de trabalho, um salvar, um e-mail — e o
  // diálogo avisa que ele vai sair (ver AvaliarIndicacao.jsx).
  if (eventos.length) {
    notificarPrograma('alavanca_retorno', { indicacao_id: indicacao.id });
  }

  return { ...data, indicadorNome: indicacao.indicadorNome };
}

/**
 * Edição pelo autor, a partir do popup de detalhe.
 *
 * Só os campos do formulário: status, comentário e premiação são do comercial,
 * e um trigger no banco (alavanca_protege_avaliacao) rejeita a escrita neles —
 * a tela não é a única guarda. A RLS ainda limita a edição a indicações que
 * seguem `em_analise`; depois que o comercial mexeu, os fatos travam.
 *
 * Mudou empresa, contato ou e-mail, a elegibilidade é RECALCULADA. Sem isso a
 * pessoa poderia trocar a empresa recusada por outra e manter o veredito de
 * "elegível" que a primeira tinha recebido.
 */
export async function editarIndicacao(indicacao, valores, autorId) {
  const empresa = (valores.empresa || '').trim();
  const contato = (valores.contato_nome || '').trim();
  const email = (valores.contato_email || '').trim();

  const mudouAlvo = empresa !== indicacao.empresa
    || contato !== indicacao.contato_nome
    || email !== indicacao.contato_email;

  const patch = {
    oportunidade: (valores.oportunidade || '').trim(),
    descricao: (valores.descricao || '').trim(),
    empresa,
    contato_nome: contato,
    contato_cargo: (valores.contato_cargo || '').trim(),
    contato_telefone: (valores.contato_telefone || '').trim(),
    contato_email: email,
    tratativas: (valores.tratativas || '').trim(),
    updated_at: new Date().toISOString(),
  };

  let veredito = null;
  if (mudouAlvo) {
    veredito = await avaliarElegibilidade({ empresa, contato, email });
    patch.elegibilidade = veredito.elegibilidade;
    patch.elegibilidade_motivo = veredito.motivo;
    patch.elegibilidade_em = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('programas_alavanca')
    .update(patch)
    .eq('id', indicacao.id)
    .select(COLUNAS)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível salvar: ${error.message}`);
  if (!data) {
    throw new Error(
      'Não é mais possível editar esta indicação: o time comercial já começou a trabalhá-la.'
    );
  }

  if (veredito) {
    await supabase.from('programas_alavanca_eventos').insert([{
      indicacao_id: indicacao.id, tipo: 'elegibilidade', autor_id: autorId,
      para: veredito.elegibilidade, texto: `Reavaliada após edição. ${veredito.motivo}`,
    }]);
  }

  return { ...data, indicadorNome: indicacao.indicadorNome };
}

/**
 * Exclusão. A RLS libera para o autor enquanto a indicação não estiver
 * concluída — concluída tem prêmio calculado e às vezes já pago, e apagá-la
 * sumiria com a linha do mapa de vencedores. Nessas, só o admin do módulo.
 */
export async function excluirIndicacao(id) {
  const { data, error } = await supabase
    .from('programas_alavanca')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw new Error(`Não foi possível excluir: ${error.message}`);
  if (!data?.length) {
    throw new Error(
      'Você não pode excluir esta indicação. Indicação concluída só o administrador do módulo apaga.'
    );
  }
}
