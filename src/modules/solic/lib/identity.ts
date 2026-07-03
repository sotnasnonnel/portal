import { supabase } from './supabase';

type SolicProfile = { id: string; auth_id: string | null; email: string | null; name: string | null; role: string | null };

// Cache por auth user: trocar de conta sem recarregar a página não vaza o perfil anterior.
let cached: { authId: string; profile: SolicProfile | null } | null = null;

// Perfil do módulo Solicitações do usuário logado. created_by das surveys aponta
// para solic_profiles.id (uuid do banco ANTIGO), nunca para auth.uid().
export async function getMySolicProfile(): Promise<SolicProfile | null> {
  // getSession é local (sem round-trip ao servidor de auth, ao contrário de getUser).
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;
  if (cached && cached.authId === user.id) return cached.profile;
  let { data } = await supabase.from('solic_profiles').select('*').eq('auth_id', user.id).maybeSingle();
  if (!data && user.email) {
    const { data: byEmail } = await supabase
      .from('solic_profiles').select('*').ilike('email', user.email).maybeSingle();
    data = byEmail ?? null;
  }
  cached = { authId: user.id, profile: data };
  return data;
}

export function clearSolicIdentity() { cached = null; }
