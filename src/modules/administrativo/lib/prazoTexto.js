/**
 * O prazo em palavras: "vence hoje às 16:30", "venceu há 2 dias".
 *
 * A data completa responde "quando?", mas quem abre a fila quer saber "quanto
 * falta?", e fazer essa conta de cabeça em cada linha é o que torna a lista
 * lenta de ler. A data exata continua disponível no `title` de quem usa isto.
 *
 * Conta em dias de CALENDÁRIO, não úteis: é uma leitura de relance, e "vence
 * amanhã" numa sexta precisa dizer sábado se o prazo cair no sábado. Quem conta
 * dia útil é quem calcula o vencimento (utils/diasUteis.js).
 *
 * Lógica pura para poder ser testada.
 */

const inicioDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const DIA_MS = 24 * 3600 * 1000;

const hora = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function descreverPrazo(iso, agora = Date.now()) {
  if (!iso) return 'Sem prazo';
  const alvo = new Date(iso);
  const instante = alvo.getTime();
  if (Number.isNaN(instante)) return 'Sem prazo';

  // Arredonda: a virada de horário de verão (dia de 23h ou 25h) não pode virar
  // um dia a mais ou a menos na conta.
  const dias = Math.round((inicioDoDia(alvo) - inicioDoDia(new Date(agora))) / DIA_MS);

  if (instante < agora) {
    if (dias === 0) return `Venceu hoje às ${hora(alvo)}`;
    if (dias === -1) return 'Venceu ontem';
    return `Venceu há ${-dias} dias`;
  }
  if (dias === 0) return `Vence hoje às ${hora(alvo)}`;
  if (dias === 1) return `Vence amanhã às ${hora(alvo)}`;
  return `Vence em ${dias} dias`;
}
