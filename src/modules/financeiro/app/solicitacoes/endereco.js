/**
 * Endereço de entrega do cartão físico.
 *
 * O formulário coleta em campos separados (CEP, logradouro, número...) porque
 * endereço digitado num campo único chega ao Financeiro sem número, sem CEP ou
 * com tudo embolado — e é ele que preenche o pedido na operadora. O banco
 * continua guardando UMA string (solicitacoes_financeiro.endereco_entrega),
 * montada aqui em 3 linhas legíveis.
 */

import { mascaraCep, cepValido } from '../../../../services/cep.js';

// Reexportadas porque o formulário do cartão as importa daqui: a máscara e a
// conferência do CEP viraram serviço compartilhado quando o Atendimento passou
// a pedir endereço de entrega, e duas cópias da mesma regra é uma a mais do que
// precisa existir.
export { mascaraCep, cepValido };

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export const ENDERECO_VAZIO = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
};

/** Campos sem os quais o cartão não chega: o complemento é opcional. */
export function faltasEndereco(e) {
  const falta = [];
  if (!cepValido(e.cep)) falta.push('cep');
  if (!e.logradouro?.trim()) falta.push('logradouro');
  if (!e.numero?.trim()) falta.push('numero');
  if (!e.bairro?.trim()) falta.push('bairro');
  if (!e.cidade?.trim()) falta.push('cidade');
  if (!e.uf) falta.push('uf');
  return falta;
}

export const enderecoCompleto = (e) => faltasEndereco(e).length === 0;

/**
 * Monta a string guardada no banco:
 *   Rua das Acácias, 120 — Apto 302
 *   Savassi
 *   Belo Horizonte/MG — CEP 30140-070
 */
export function formatarEnderecoEntrega(e) {
  const linha1 = [
    [e.logradouro?.trim(), e.numero?.trim()].filter(Boolean).join(', '),
    e.complemento?.trim(),
  ].filter(Boolean).join(' — ');
  const linha3 = [
    [e.cidade?.trim(), e.uf].filter(Boolean).join('/'),
    cepValido(e.cep) ? `CEP ${mascaraCep(e.cep)}` : '',
  ].filter(Boolean).join(' — ');
  return [linha1, e.bairro?.trim(), linha3].filter(Boolean).join('\n');
}
