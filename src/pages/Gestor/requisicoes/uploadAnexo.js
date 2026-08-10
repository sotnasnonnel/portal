import { supabase } from '../../../services/supabase';

/**
 * Upload de anexo de requisição — ponto único usado pelo hook de múltiplos
 * anexos (useAnexos) e pelo formulário de Ajuda de Custo.
 *
 * O "Failed to fetch" que aparecia no envio não vem do Supabase: é o fetch do
 * navegador morrendo antes de chegar ao servidor. Duas causas, tratadas aqui:
 *
 * 1) O File escolhido é só um ponteiro para o disco. Se o arquivo foi movido,
 *    renomeado, sobrescrito (Excel salva por cima) ou está "somente na nuvem"
 *    no OneDrive, a leitura só falha na hora do POST — e o erro chega como
 *    "Failed to fetch", sem pista nenhuma. Lemos o arquivo para a memória antes
 *    de subir: o problema aparece cedo e com mensagem que o usuário entende.
 * 2) Queda de rede/VPN/proxy no meio do POST. Aí vale repetir — e repetir a
 *    partir do buffer em memória, sem tocar no disco de novo.
 */

export const sanitizarNome = (nome) => nome
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9._-]/g, '_'); // após NFD, acentos viram combinantes e caem aqui

const TENTATIVAS = 3;

// Erro de rede (o POST nem chegou) vs. erro de regra (413/415/403) — só o
// primeiro vale repetir.
const eFalhaDeRede = (e) => e instanceof TypeError
  || /failed to fetch|networkerror|load failed|network request failed/i.test(e?.message || '');

const espera = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Lê o arquivo inteiro para a memória (o limite de 10 MB já foi validado antes).
const lerParaMemoria = async (file) => {
  try {
    const buffer = await file.arrayBuffer();
    return new Blob([buffer], { type: file.type || 'application/octet-stream' });
  } catch {
    throw new Error(
      `Não foi possível ler "${file.name}". O arquivo pode ter sido movido, renomeado, `
      + 'alterado depois de selecionado ou estar apenas na nuvem (OneDrive). '
      + 'Abra-o uma vez no computador, selecione novamente e tente de novo.',
    );
  }
};

/**
 * Sobe um arquivo e devolve { path, nome }. Lança Error com mensagem pronta
 * para exibir ao usuário.
 */
export async function enviarArquivo(bucket, file) {
  if (!file.type) {
    throw new Error(
      `Não foi possível identificar o tipo do arquivo "${file.name}". `
      + 'Use PDF, Word, Excel ou imagem (PNG/JPG).',
    );
  }
  const blob = await lerParaMemoria(file);
  const path = `${crypto.randomUUID()}/${sanitizarNome(file.name)}`;

  let ultimo = null;
  for (let i = 0; i < TENTATIVAS; i += 1) {
    try {
      const { error } = await supabase.storage.from(bucket)
        .upload(path, blob, { contentType: blob.type });
      if (!error) return { path, nome: file.name };
      // O path é um UUID novo: "já existe" só acontece se a tentativa anterior
      // tiver subido e a resposta se perdido — ou seja, deu certo.
      if (/already exists|duplicate/i.test(error.message || '')) return { path, nome: file.name };
      if (!eFalhaDeRede(error)) throw new Error(`Falha ao enviar o anexo "${file.name}": ${error.message}`);
      ultimo = error;
    } catch (e) {
      if (!eFalhaDeRede(e)) throw e;
      ultimo = e;
    }
    if (i < TENTATIVAS - 1) await espera(800 * (i + 1));
  }

  throw new Error(
    `Não foi possível enviar o anexo "${file.name}": a conexão com o servidor falhou `
    + `(${ultimo?.message || 'erro de rede'}). Verifique a internet/VPN e tente novamente.`,
  );
}
