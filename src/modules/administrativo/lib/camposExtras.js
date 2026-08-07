/**
 * Campos extras dos chamados — a 2ª aba do Milldesk.
 *
 * A definição NÃO vive no código: é cadastrada por serviço pelo time do Adm e
 * guardada em chamados_adm_config.campos_extras. Este arquivo é só o contrato
 * entre quem cadastra (tela de configuração) e quem preenche (formulário).
 *
 * Cada campo: { chave, rotulo, tipo, obrigatorio, opcoes[] }
 * O preenchimento é opcional por padrão — só é exigido quando quem cadastrou
 * marcou `obrigatorio`.
 */

export const TIPOS_CAMPO = [
  { valor: 'texto', label: 'Texto' },
  { valor: 'texto_longo', label: 'Texto longo' },
  { valor: 'numero', label: 'Número' },
  { valor: 'data', label: 'Data' },
  { valor: 'selecao', label: 'Lista de opções' },
  { valor: 'sim_nao', label: 'Sim / Não' },
];

export const rotuloTipo = (tipo) => TIPOS_CAMPO.find((t) => t.valor === tipo)?.label || tipo;

/**
 * Chave de armazenamento derivada do rótulo. É o nome da propriedade dentro de
 * `chamados_adm.campos`, então precisa ser estável: renomear o rótulo depois
 * NÃO muda a chave (a tela só gera a chave na criação do campo), senão os
 * chamados antigos perderiam o valor.
 */
export const chaveDoRotulo = (rotulo) => (rotulo || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 40);

/** Garante chave única dentro do serviço (dois campos podem ter rótulo parecido). */
export function chaveUnica(rotulo, existentes = []) {
  const base = chaveDoRotulo(rotulo) || 'campo';
  if (!existentes.includes(base)) return base;
  let i = 2;
  while (existentes.includes(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

const vazio = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim());

/**
 * Valida o preenchimento contra a definição cadastrada.
 * Devolve '' quando está tudo certo, ou a mensagem do primeiro problema.
 */
export function validarCamposExtras(definicao = [], valores = {}) {
  for (const campo of definicao) {
    const v = valores[campo.chave];
    if (campo.obrigatorio && vazio(v)) {
      return `Preencha o campo "${campo.rotulo}".`;
    }
    if (!vazio(v) && campo.tipo === 'numero' && Number.isNaN(Number(v))) {
      return `O campo "${campo.rotulo}" deve ser um número.`;
    }
  }
  return '';
}

/**
 * Descarta os campos não preenchidos antes de gravar: guardar chave com string
 * vazia só polui o jsonb e atrapalha quem for consultar depois.
 */
export function limparValores(definicao = [], valores = {}) {
  const saida = {};
  for (const campo of definicao) {
    const v = valores[campo.chave];
    if (vazio(v)) continue;
    saida[campo.chave] = campo.tipo === 'numero' ? Number(v) : v;
  }
  return saida;
}
