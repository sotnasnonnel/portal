// Foto do usuário vinda do Microsoft 365 (Microsoft Graph).
//
// O login Microsoft (Supabase OAuth "azure") devolve junto com a sessão um
// access token do Graph em session.provider_token — mas só no RETORNO DO LOGIN:
// o refresh do token do Supabase (~1h) não renova esse token e ele some. Por
// isso a foto é baixada uma vez, virada data URL e guardada no localStorage; nas
// aberturas seguintes a bolinha pinta a partir do cache, que só é renovado num
// novo login depois de VALIDADE_MS.
//
// Requer a permissão delegada User.Read no app do Entra ID (e o scope pedido no
// signInWithMicrosoft, ver AuthContext).

const PREFIXO = 'phd:foto-ms:';
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

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

export async function carregarFotoMicrosoft(session) {
  const authId = session?.user?.id;
  if (!authId) return null;

  const cache = lerCache(authId);
  if (cache && Date.now() - (cache.em || 0) < VALIDADE_MS) return cache.dataUrl || null;

  const token = session.provider_token;
  // Sem token do Graph nesta sessão (recarregou a página, token expirado): fica
  // com o que já tem até o próximo login trazer um token novo.
  if (!token) return cache?.dataUrl || null;

  let dataUrl;
  try {
    dataUrl = await baixarDoGraph(token);
  } catch {
    return cache?.dataUrl || null; // rede fora não invalida o cache
  }
  if (dataUrl === undefined) return cache?.dataUrl || null;

  gravarCache(authId, { dataUrl, em: Date.now() });
  return dataUrl;
}
