/**
 * O chamado em um olhar: com quem está a bola e o que a pessoa logada tem a
 * fazer agora.
 *
 * Só DESCREVE o que as regras da tela já decidiram: quem pode assumir, fechar ou
 * avaliar continua sendo calculado por quem chama, e chega aqui como booleano.
 * Assim a frase nunca oferece uma ação que o botão não oferece.
 *
 * Lógica pura para poder ser testada.
 */

const ANDAMENTO = new Set(['aberto', 'em_atendimento', 'aguardando_solicitante']);

/** A etapa da vez é a menor ordem ainda pendente, a mesma régua do FluxoAprovacao. */
function aprovadorDaVez(etapas, nomes) {
  const pendentes = etapas.filter((e) => e.status === 'pendente');
  if (!pendentes.length) return null;
  const vez = pendentes.reduce((a, b) => ((b.ordem || 0) < (a.ordem || 0) ? b : a));
  return { id: vez.aprovador_id, nome: nomes[vez.aprovador_id] || 'Aprovador' };
}

function comQuemEsta({
  status, meuId, souSolicitante, atendenteId, atendenteNome, solicitanteNome, etapas, nomesEtapas,
  temAvaliacao,
}) {
  if (status === 'aguardando_aprovacao') {
    const quem = aprovadorDaVez(etapas, nomesEtapas);
    if (!quem) return 'Sem aprovador registrado';
    return quem.id === meuId ? 'Você, para aprovar' : `${quem.nome}, para aprovar`;
  }
  if (status === 'aguardando_solicitante') {
    return souSolicitante ? 'Você' : (solicitanteNome || 'Solicitante');
  }
  if (ANDAMENTO.has(status)) {
    if (!atendenteId) return 'Fila, sem responsável';
    return atendenteId === meuId ? 'Você' : (atendenteNome || 'Responsável');
  }
  if (status === 'fechado' && !temAvaliacao) {
    return souSolicitante ? 'Você, para avaliar' : `${solicitanteNome || 'Solicitante'}, para avaliar`;
  }
  // Encerrado e sem pendência: a bola não está com ninguém, e dizer um nome aqui
  // faria o chamado parecer vivo.
  return null;
}

function proximoPasso({
  status, meuId, souSolicitante, atendenteId, souTime, minhaEtapa, precisaAvaliar, podeAssumir,
  podeReabrir, semAprovadores,
}) {
  const sua = (texto) => ({ texto, suaVez: true });
  const nada = (texto) => ({ texto, suaVez: false });
  const emAndamento = ANDAMENTO.has(status);

  if (minhaEtapa) return sua('Decida este pedido: aprove ou reprove.');
  if (precisaAvaliar) return sua('Avalie o atendimento. Sem isso, você não abre novos chamados.');
  if (semAprovadores && souTime) return sua('Libere o chamado: nenhum aprovador foi registrado.');
  if (status === 'aguardando_solicitante' && souSolicitante) {
    return sua('Responda na conversa para o pedido voltar a andar.');
  }
  if (emAndamento && !atendenteId && podeAssumir) {
    return sua('Assuma o chamado para começar o atendimento.');
  }
  if (emAndamento && atendenteId === meuId) {
    return sua(status === 'aguardando_solicitante'
      ? 'Aguarde a resposta do solicitante, ou feche o chamado se já resolveu.'
      : 'Responda na conversa, ou feche o chamado se já resolveu.');
  }
  if (emAndamento && podeAssumir) return nada('Está com outra pessoa. Assuma se precisar atuar.');
  if (souSolicitante && status === 'aguardando_aprovacao') {
    return nada('Nada a fazer agora: o pedido espera a aprovação.');
  }
  if (souSolicitante && emAndamento) {
    return nada('Nada a fazer agora. Use a conversa se quiser complementar o pedido.');
  }
  if (podeReabrir) return nada('Nada a fazer. Se o problema voltar, você pode reabrir o chamado.');
  if (status === 'reprovado') return nada('Pedido reprovado. O motivo está no fluxo de aprovação.');
  if (status === 'cancelado') return nada('Pedido cancelado. Não há mais nada a fazer.');
  return nada('Nenhuma ação pendente para você.');
}

/**
 * @returns {{ comQuem: string|null, passo: { texto: string, suaVez: boolean } }}
 */
export function situacaoDoChamado({
  status, meuId, souSolicitante = false, souTime = false,
  atendenteId = null, atendenteNome = '', solicitanteNome = '',
  etapas = [], nomesEtapas = {}, minhaEtapa = null,
  temAvaliacao = false, precisaAvaliar = false, podeAssumir = false, podeReabrir = false,
}) {
  return {
    comQuem: comQuemEsta({
      status, meuId, souSolicitante, atendenteId, atendenteNome, solicitanteNome, etapas, nomesEtapas,
      temAvaliacao,
    }),
    passo: proximoPasso({
      status, meuId, souSolicitante, atendenteId, souTime, minhaEtapa, precisaAvaliar, podeAssumir,
      podeReabrir,
      semAprovadores: status === 'aguardando_aprovacao' && !etapas.length,
    }),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ehIdCru = (valor) => UUID.test(String(valor));

/**
 * Valor de um campo que guarda um id, para leitura. O nome vem resolvido do banco;
 * quando não vem (colaborador removido, por exemplo), um id cru na tela não diz
 * nada a ninguém. Texto solto de chamado antigo continua aparecendo como está.
 */
export function nomeDoCampoPessoa(valor, nomes = {}) {
  if (nomes[valor]) return nomes[valor];
  return ehIdCru(valor) ? 'Não identificado' : valor;
}

/** Acima disto, os dados do pedido nascem recolhidos: empurravam a conversa para fora da tela. */
export const CAMPOS_VISIVEIS = 8;

/**
 * Quantos dados do pedido mostrar de início. Quem vai aprovar vê todos: decidir
 * sobre um pedido pela metade não pode ser o caminho mais curto.
 */
export function camposVisiveis(total, { expandido = false, vaiDecidir = false } = {}) {
  // Esconder um dado só custaria mais espaço, no link, do que mostrá-lo.
  if (expandido || vaiDecidir || total <= CAMPOS_VISIVEIS + 1) return total;
  return CAMPOS_VISIVEIS;
}
