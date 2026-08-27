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
 * Atualização do "mapa geral" pelo time comercial: status, comentário e, na
 * conclusão, a premiação.
 *
 * Um método só para as três coisas porque elas viajam juntas na tela (a linha
 * do mapa é editada de uma vez) e porque o CHECK do banco exige o valor do
 * prêmio junto da conclusão — em chamadas separadas, uma delas quebraria.
 */
export async function atualizarIndicacao(indicacao, mudancas, autorId) {
  const patch = { updated_at: new Date().toISOString() };
  if (mudancas.status !== undefined) patch.status = mudancas.status;
  if (mudancas.comentario !== undefined) patch.comentario = (mudancas.comentario || '').trim() || null;
  if (mudancas.valor_contrato !== undefined) patch.valor_contrato = mudancas.valor_contrato ?? null;
  if (mudancas.valor_premio !== undefined) patch.valor_premio = mudancas.valor_premio ?? null;
  if (mudancas.pago_em !== undefined) patch.pago_em = mudancas.pago_em || null;

  const concluindo = patch.status === 'concluida' && indicacao.status !== 'concluida';
  if (concluindo) patch.concluida_em = new Date().toISOString();

  const { data, error } = await supabase
    .from('programas_alavanca')
    .update(patch)
    .eq('id', indicacao.id)
    .select(COLUNAS)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível atualizar a indicação: ${error.message}`);
  if (!data) throw new Error('Só o time comercial pode atualizar o mapa de indicações.');

  const eventos = [];
  if (patch.status && patch.status !== indicacao.status) {
    eventos.push({
      indicacao_id: indicacao.id, tipo: 'status', autor_id: autorId,
      de: indicacao.status, para: patch.status,
    });
  }
  if (patch.comentario !== undefined && patch.comentario !== indicacao.comentario) {
    eventos.push({
      indicacao_id: indicacao.id, tipo: 'comentario', autor_id: autorId, texto: patch.comentario,
    });
  }
  if (concluindo) {
    eventos.push({
      indicacao_id: indicacao.id, tipo: 'premiacao', autor_id: autorId,
      texto: `Prêmio de R$ ${Number(patch.valor_premio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    });
  }
  if (eventos.length) await supabase.from('programas_alavanca_eventos').insert(eventos);

  // Só avisa quando algo mudou de verdade para quem indicou. Comentário interno
  // sem troca de status não gera e-mail — viraria ruído.
  if (patch.status && patch.status !== indicacao.status) {
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
