/**
 * Consulta de CEP (ViaCEP).
 *
 * Endereço digitado à mão chega torto: "Av." num pedido e "Avenida" no outro,
 * cidade sem acento, bairro em branco — e quem recebe o chamado é que descobre
 * depois, perguntando por fora. Com o CEP, rua, bairro, cidade e estado vêm
 * prontos e escritos igual em todo chamado.
 *
 * Serviço público, sem chave e com CORS liberado: dá para chamar direto do
 * navegador. Quando ele cai (ou a máquina está sem rede) a consulta falha e os
 * campos continuam editáveis à mão — nenhuma abertura de chamado trava por
 * causa dele.
 */

export const soDigitosCep = (valor) => (valor || '').replace(/\D/g, '').slice(0, 8);

/** Máscara 00000-000 (só dígitos, hífen entrando sozinho). */
export function mascaraCep(valor) {
  const d = soDigitosCep(valor);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export const cepValido = (valor) => soDigitosCep(valor).length === 8;

const FORA_DO_AR = 'Não foi possível consultar o CEP agora. Preencha o endereço à mão.';

/**
 * Endereço de um CEP.
 *
 * @param {string} cep com ou sem máscara.
 * @returns {Promise<{logradouro: string, bairro: string, cidade: string, uf: string}>}
 * @throws quando o CEP está incompleto, não existe ou a consulta não responde.
 */
export async function buscarCep(cep) {
  const digitos = soDigitosCep(cep);
  if (digitos.length !== 8) throw new Error('Informe os oito dígitos do CEP.');

  let resposta;
  try {
    resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
      // Sem teto, o ViaCEP lento deixa o campo girando para sempre e a pessoa
      // fica sem saber se pode digitar o resto do endereço.
      signal: AbortSignal.timeout?.(8000),
    });
  } catch {
    throw new Error(FORA_DO_AR);
  }
  if (!resposta.ok) throw new Error(FORA_DO_AR);

  let dados;
  try {
    dados = await resposta.json();
  } catch {
    throw new Error(FORA_DO_AR);
  }

  // CEP inexistente não vem como 404: o ViaCEP responde 200 com { erro: true }.
  if (!dados || dados.erro) throw new Error('CEP não encontrado. Confira o número digitado.');

  return {
    logradouro: dados.logradouro || '',
    bairro: dados.bairro || '',
    cidade: dados.localidade || '',
    uf: dados.uf || '',
  };
}
