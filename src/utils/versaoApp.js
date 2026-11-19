// ---------------------------------------------------------------------------
// versaoApp.js — regra do aviso "saiu uma versão nova, atualize a página".
//
// Cada build grava a versão em dois lugares (plugin em vite.config.js):
//   - dentro do JavaScript da página, em import.meta.env.VITE_VERSAO_APP;
//   - num arquivo solto, version.json, enviado ao servidor junto com o site
//     (deploy/portal.sftp).
// A página aberta relê o version.json de tempos em tempos. Se o número de lá
// for diferente do que ela carregou, houve publicação depois que a pessoa
// abriu a aba, e ela precisa dar F5.
// Mesma regra do app-phd (src/utils/versaoApp.js de lá).
// ---------------------------------------------------------------------------

/** De quanto em quanto tempo a página confere se saiu versão nova. */
export const INTERVALO_CHECAGEM_MS = 5 * 60 * 1000;

/** Quanto tempo o "Depois" esconde o aviso. */
export const ADIAR_MS = 30 * 60 * 1000;

/**
 * true quando o servidor tem uma versão diferente da que está rodando.
 * Qualquer dado faltando ou estranho devolve false: na dúvida, não incomoda.
 *
 * @param {string|undefined} versaoAtual  a versão embutida nesta página
 * @param {unknown} resposta              o JSON lido de version.json
 */
export function haVersaoNova(versaoAtual, resposta) {
  const remota = resposta?.versao;
  if (!versaoAtual || typeof remota !== 'string' || remota === '') return false;
  return remota !== versaoAtual;
}
