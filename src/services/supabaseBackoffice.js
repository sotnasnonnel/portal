import { createClient } from '@supabase/supabase-js';

// Cliente somente-leitura para o projeto backoffice_phd (dvvqgoxqawyhycakppps),
// origem dos dados do Organograma. É um projeto Supabase diferente do shell,
// então usa envs próprias e NÃO persiste sessão — assim não abre um segundo
// GoTrueClient competindo com o login (Microsoft) do Portal.
const url = import.meta.env.VITE_BACKOFFICE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_BACKOFFICE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing VITE_BACKOFFICE_SUPABASE_* variables in .env');
}

export const supabaseBackoffice = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
