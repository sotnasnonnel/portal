// Foto do usuário vinda do Microsoft 365 — por dois caminhos.
//
// 1) Microsoft Graph. O login Microsoft (Supabase OAuth "azure") devolve junto
//    com a sessão um access token do Graph em session.provider_token — mas só
//    no RETORNO DO LOGIN: o refresh do token do Supabase (~1h) não renova esse
//    token e ele some. Por isso a foto é baixada uma vez, virada data URL e
//    guardada no localStorage; nas aberturas seguintes a bolinha pinta a partir
//    do cache, que só é renovado num novo login depois de VALIDADE_MS.
//    Requer a permissão delegada User.Read no app do Entra ID (e o scope pedido
//    no signInWithMicrosoft, ver AuthContext).
//
// 2) O hub (Edge Function minha-foto). Quem entrou antes de a bolinha existir,
//    ou cujo login não trouxe o token do Graph, ficava nas iniciais mesmo tendo
//    foto sincronizada no hub — a MESMA que a lista de aniversariantes da Home
//    mostra (pedido do usuário, 19/10/2026: "a foto tem que aparecer lá
//    também"). O plano B cobre quem está no hub; quem não está segue nas
//    iniciais até um login novo trazer a foto do Graph.

import { supabase } from './supabase';

const PREFIXO = 'phd:foto-ms:';
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;  // 7 dias com foto
// "Não achei em lugar nenhum" vale menos: um dia depois vale tentar de novo (a
// foto pode ter acabado de ser sincronizada no hub).
const VALIDADE_VAZIO_MS = 24 * 60 * 60 * 1000;

const chave = (authId) => PREFIXO + authId;

function lerCache(authId) {
  try {
    const cru = localStorage.getItem(chave(authId));
    return cru ? JSON.parse(cru) : null;
  } catch {
    return null;
  }
}

function gravarCache(authId, dados) {
  try {
    localStorage.setItem(chave(authId), JSON.stringify(dados));
  } catch {
    // quota estourada / navegação privada: segue sem cache (rebaixa no próximo login)
  }
}

// Leitura síncrona, para a bolinha já nascer com a foto em vez de piscar iniciais.
export function fotoEmCache(authId) {
  if (!authId) return null;
  return lerCache(authId)?.dataUrl || null;
}

// Chamado no logout: a foto é dado pessoal e a máquina pode ser compartilhada.
export function limparFotoMicrosoft() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIXO))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // sem localStorage: nada a limpar
  }
}

function blobParaDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

// 96x96 é o tamanho que a bolinha usa (a maior tem 36px, com telas 2x); se o
// Graph não tiver essa versão da foto, cai para a original.
const ENDPOINTS = [
  'https://graph.microsoft.com/v1.0/me/photos/96x96/$value',
  'https://graph.microsoft.com/v1.0/me/photo/$value',
];

// null = a pessoa não tem foto no Microsoft 365 (cacheável).
// undefined = não deu para saber (401/403/500) — não vira "sem foto".
async function baixarDoGraph(token) {
  for (const url of ENDPOINTS) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) return blobParaDataUrl(await res.blob());
    if (res.status !== 404) return undefined;
  }
  return null;
}

// A foto que o hub já sincronizou do Microsoft 365, pela Edge Function.
// null = não tem foto lá, o nome não casou ou a função falhou.
async function baixarDoHub() {
  try {
    const { data, error } = await supabase.functions.invoke('minha-foto', { body: {} });
    return error ? null : (data?.dataUrl || null);
  } catch {
    return null;
  }
}

export async function carregarFotoMicrosoft(session) {
  const authId = session?.user?.id;
  if (!authId) return null;

  const cache = lerCache(authId);
  const validade = cache?.dataUrl ? VALIDADE_MS : VALIDADE_VAZIO_MS;
  if (cache && Date.now() - (cache.em || 0) < validade) return cache.dataUrl || null;

  // 1) O Graph, quando o login desta sessão trouxe o token. Sem token
  //    (recarregou a página, token expirado) parte direto para o hub.
  let dataUrl;
  if (session.provider_token) {
    try {
      dataUrl = await baixarDoGraph(session.provider_token);
    } catch {
      return cache?.dataUrl || null; // rede fora não invalida o cache
    }
  }

  // 2) Nada no Graph (sem token, sem foto no perfil ou erro de permissão): o hub.
  if (!dataUrl) {
    const doHub = await baixarDoHub();
    if (doHub) {
      gravarCache(authId, { dataUrl: doHub, em: Date.now() });
      return doHub;
    }
    // Nem o Graph deu para consultar (undefined) nem o hub tinha: uma foto boa
    // já em cache vale mais que um "não achei".
    if (dataUrl === undefined && cache?.dataUrl) return cache.dataUrl;
    // Guarda o "não achei" por VALIDADE_VAZIO_MS: sem isso a Edge Function
    // seria chamada a cada abertura de página de quem não tem foto.
    gravarCache(authId, { dataUrl: null, em: Date.now() });
    return null;
  }

  gravarCache(authId, { dataUrl, em: Date.now() });
  return dataUrl;
}
