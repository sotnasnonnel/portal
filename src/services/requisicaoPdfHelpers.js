// Helpers puros do PDF de requisição. SEM jsPDF/asset/React/CSS — roda em `node --test`.
import { formatarMoeda, parseDesligamento } from '../utils/formatters.js';
import { TIPO_LABEL_CURTO } from '../config/aprovacao.js';

export const STATUS_LABEL = {
  pendente: 'Em andamento',
  concluida: 'Concluída',
  reprovada: 'Reprovada',
};

const sanitizar = (s) => String(s ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')   // remove acentos
  .replace(/[^a-zA-Z0-9]+/g, '');    // remove espaços e especiais

/** Requisicao_{TipoCurto}_{Colaborador}_{AAAA-MM-DD}.pdf */
export function nomeArquivoRequisicao(sol, nomeColaborador) {
  const tipo = sanitizar(TIPO_LABEL_CURTO[sol?.tipo] || sol?.tipo || 'Requisicao');
  const nome = sanitizar(nomeColaborador || 'Colaborador') || 'Colaborador';
  const data = (sol?.created_at ? String(sol.created_at).slice(0, 10) : '') || '0000-00-00';
  return `Requisicao_${tipo}_${nome}_${data}.pdf`;
}

/** Linhas [label, valor] para os tipos que não têm DETALHE (config). */
export function linhasDiretas(sol) {
  if (sol?.tipo === 'desligamento') {
    const { data, texto } = parseDesligamento(sol.justificativa);
    const linhas = [];
    if (data) linhas.push(['Data sugerida para desligamento', data]);
    if (texto) linhas.push(['Justificativa', texto]);
    return linhas;
  }
  // aumento_salario (Alteração de Cargo / Função)
  const linhas = [];
  if (sol?.colaborador?.salario != null) linhas.push(['Valor atual', formatarMoeda(sol.colaborador.salario)]);
  if (sol?.salario_proposto != null) linhas.push(['Valor proposto', formatarMoeda(sol.salario_proposto)]);
  if (sol?.funcao_proposta) linhas.push(['Função proposta', String(sol.funcao_proposta)]);
  if (sol?.cargo_proposto) linhas.push(['Cargo proposto', String(sol.cargo_proposto)]);
  if (sol?.justificativa) linhas.push(['Justificativa', String(sol.justificativa)]);
  return linhas;
}
