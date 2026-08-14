/**
 * Linha do tempo do chamado: eventos (gravados por trigger) e mensagens da
 * conversa, numa lista só, em ordem cronológica.
 *
 * É o que responde "minha solicitação andou?" sem ninguém precisar escrever
 * mensagem: aprovação, atribuição e mudança de status aparecem como texto.
 *
 * Lógica pura — sem Supabase, sem React — para poder ser testada.
 */

const STATUS_LABEL = {
  aguardando_aprovacao: 'Aguardando aprovação',
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  aguardando_solicitante: 'Aguardando solicitante',
  fechado: 'Fechado',
  reprovado: 'Reprovado',
  cancelado: 'Cancelado',
};

const por = (nome) => (nome ? ` por ${nome}` : '');

/**
 * Frase de uma mudança de status. O par (de → para) importa: sair de "fechado"
 * é reabertura, e sair de "aguardando_aprovacao" para "aberto" é liberação —
 * as duas cairiam em "status alterado" se olhássemos só o destino.
 */
function textoDeStatus(ev, autor) {
  const { de, para } = ev;
  if (de === 'fechado') return `Chamado reaberto${por(autor)}`;
  if (de === 'aguardando_aprovacao' && para === 'aberto') return 'Aprovação concluída — liberado para atendimento';

  switch (para) {
    case 'em_atendimento': return `Atendimento iniciado${por(autor)}`;
    case 'aguardando_solicitante': return 'Aguardando resposta do solicitante';
    case 'fechado': return `Chamado fechado${por(autor)}`;
    case 'reprovado': return `Chamado reprovado${por(autor)}`;
    case 'cancelado': return `Chamado cancelado${por(autor)}`;
    default: return `Status alterado para ${STATUS_LABEL[para] || para}`;
  }
}

/**
 * Texto de um evento. `nomes` resolve id → nome (o autor e, na atribuição, o
 * técnico que entrou ou saiu).
 */
export function textoDoEvento(ev, nomes = {}) {
  const autor = nomes[ev.autor_id] || '';

  switch (ev.tipo) {
    case 'criado':
      return `Chamado aberto${por(autor)}`;

    case 'atribuido': {
      const novo = nomes[ev.para] || '';
      if (!ev.para) return `Responsável removido${por(autor)}`;
      return `Atribuído a ${novo || 'um técnico'}`;
    }

    case 'aprovado':
      return `Aprovado${por(autor)}`;

    case 'reprovado': {
      const motivo = ev.dados?.justificativa;
      return `Reprovado${por(autor)}${motivo ? ` — ${motivo}` : ''}`;
    }

    case 'avaliado': {
      const n = Number(ev.para);
      if (!Number.isFinite(n)) return `Atendimento avaliado (${ev.para})`;
      return `Atendimento avaliado com ${n} ${n === 1 ? 'estrela' : 'estrelas'}`;
    }

    case 'status':
      return textoDeStatus(ev, autor);

    default:
      return 'Movimentação no chamado';
  }
}

/**
 * Mescla eventos e mensagens em ordem cronológica.
 *
 * Empate de horário resolve com o EVENTO antes da mensagem: quando alguém
 * responde e o status muda no mesmo instante, ler "atendimento iniciado" e
 * depois a resposta faz mais sentido que o contrário.
 */
export function montarLinhaDoTempo({ eventos = [], mensagens = [] } = {}) {
  const itens = [
    ...eventos.map((e) => ({ tipo: 'evento', em: e.created_at, dado: e })),
    ...mensagens.map((m) => ({ tipo: 'mensagem', em: m.created_at, dado: m })),
  ];
  return itens.sort((a, b) => {
    const t = new Date(a.em) - new Date(b.em);
    if (t !== 0) return t;
    if (a.tipo === b.tipo) return 0;
    return a.tipo === 'evento' ? -1 : 1;
  });
}
