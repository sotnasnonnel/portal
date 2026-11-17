import { createClient } from '@supabase/supabase-js';
import { RPCS_LEITURA } from '../config/verComo';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase variables in .env');
}

// ---------------------------------------------------------------------------
// "Ver como" (config/verComo.js): enquanto o super admin vê o portal como outra
// pessoa, o cliente fica SOMENTE LEITURA, para nada ser gravado no nome de
// ninguém por engano. A sessão do banco continua sendo a dele, então qualquer
// escrita sairia como ele, e o motivo de travar é não haver efeito colateral
// nenhum de uma simulação.
//
// Trava por LISTA DO QUE PASSA, e não do que barra: RPC fora de RPCS_LEITURA
// é bloqueada. RPC nova que ninguém classificou cai bloqueada, e o pior caso é
// uma tela vazia no ver como, nunca uma gravação.
// ---------------------------------------------------------------------------
let verComoAtivo = false;
export function setSupabaseVerComo(v) { verComoAtivo = Boolean(v); }

const ERRO_VER_COMO = {
  message: 'Ver como: o portal está em somente leitura. Saia do "ver como" para alterar.',
  code: 'VER_COMO',
};

// Imita o PostgrestBuilder: encadeável (.select().eq().single()...) e aguardável,
// resolvendo para { data: null, error }. Assim o try/catch de cada tela trata.
function bloqueado() {
  const resultado = { data: null, error: ERRO_VER_COMO, count: null, status: 403, statusText: 'Forbidden' };
  const proxy = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return (resolve, reject) => Promise.resolve(resultado).then(resolve, reject);
      if (prop === 'catch') return () => proxy;
      if (prop === 'finally') return (cb) => { if (typeof cb === 'function') cb(); return proxy; };
      return () => proxy;
    },
    apply() { return proxy; },
  });
  return proxy;
}

const ESCRITA_TABELA = ['insert', 'update', 'delete', 'upsert'];
const ESCRITA_STORAGE = ['upload', 'update', 'remove', 'move', 'copy', 'createSignedUploadUrl', 'uploadToSignedUrl'];

function travarNoVerComo(client) {
  const fromOriginal = client.from.bind(client);
  client.from = (tabela) => {
    const qb = fromOriginal(tabela);
    if (verComoAtivo) for (const m of ESCRITA_TABELA) qb[m] = () => bloqueado();
    return qb;
  };

  const rpcOriginal = client.rpc.bind(client);
  client.rpc = (fn, params, opts) => {
    if (verComoAtivo && !RPCS_LEITURA.has(fn)) return bloqueado();
    return rpcOriginal(fn, params, opts);
  };

  const storageFrom = client.storage.from.bind(client.storage);
  client.storage.from = (bucket) => {
    const sb = storageFrom(bucket);
    if (verComoAtivo) {
      for (const m of ESCRITA_STORAGE) {
        if (typeof sb[m] === 'function') sb[m] = async () => ({ data: null, error: ERRO_VER_COMO });
      }
    }
    return sb;
  };

  // Edge Functions mandam e-mail e gravam: nenhuma roda no ver como.
  // `functions` é um GETTER no supabase-js que cria um cliente novo a cada
  // acesso; trocar o `invoke` de uma instância se perderia na próxima leitura.
  // Por isso a trava envolve o próprio getter.
  const getterFunctions = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(client), 'functions')?.get;
  if (getterFunctions) {
    Object.defineProperty(client, 'functions', {
      configurable: true,
      get() {
        const fc = getterFunctions.call(client);
        const invokeOriginal = fc.invoke.bind(fc);
        fc.invoke = (nome, opts) => (verComoAtivo
          ? Promise.resolve({ data: null, error: ERRO_VER_COMO })
          : invokeOriginal(nome, opts));
        return fc;
      },
    });
  }

  return client;
}

// PKCE: o retorno do OAuth vem em ?code= (query string), sem colidir com o
// fragmento do HashRouter como no flow implícito (#access_token=...).
export const supabase = travarNoVerComo(createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'pkce' },
}));
