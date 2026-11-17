import { schemaDoServico } from '../app/novo/formularios/schemas.js';

/**
 * Valores iniciais de um chamado vindos da URL (?numero_serie=...&tipo=...).
 * Existe para outro módulo abrir o chamado já preenchido: o TI manda quem só
 * consulta os equipamentos para "Troca de equipamentos" com o número de série e
 * o tipo do equipamento escolhido.
 *
 * Só entram chaves que o serviço tem, de texto ou de seleção, e a seleção só se
 * o valor for uma das opções: a URL não consegue criar campo nem opção.
 */
export function valoresDaUrl(classe, servico, params) {
  const schema = schemaDoServico(classe, servico) || [];
  const out = {};
  for (const campo of schema) {
    const v = params?.get?.(campo.chave);
    if (v == null || v === '') continue;
    if (campo.tipo === 'texto') out[campo.chave] = v.slice(0, 200);
    else if (campo.tipo === 'selecao' && (campo.opcoes || []).includes(v)) out[campo.chave] = v;
  }
  return out;
}
