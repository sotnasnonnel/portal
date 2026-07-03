// Acessos de leitura cacheados (ver supabaseCache.ts + estrategia-carregamento-supabase-sem-delay.md).
// Mantém as MESMAS queries das telas, só que passando por cachedQuery para
// navegação instantânea. Escritas devem chamar invalidateCache(['surveys:']) etc.

import { supabase } from "@/lib/supabase";
import { cachedQuery } from "@/lib/supabaseCache";
import { getMySolicProfile } from "@/lib/identity";

export type MyProfile = {
  userId: string | null;
  email: string;
  name: string | null;
  role: string | null;
};

type QueryResult<T> = { data: T | null; error: { message: string } | null };

// Perfil/role do usuário logado — usado em Sidebar, Topbar, guards e páginas.
// IMPORTANTE: userId é solic_profiles.id (uuid do banco antigo), que é o valor
// usado em surveys.created_by — NUNCA o auth.uid() do projeto compartilhado.
export async function fetchMyProfile(): Promise<MyProfile> {
  const prof = await getMySolicProfile();
  if (!prof) return { userId: null, email: "", name: null, role: null };

  return {
    userId: prof.id,
    email: (prof.email || "").toLowerCase(),
    name: prof.name ?? null,
    role: prof.role ?? null,
  };
}

// Lista de solicitações do Dashboard (mesmo select/ordem de antes).
export function fetchSurveysDashboard(): Promise<QueryResult<any[]>> {
  return cachedQuery<QueryResult<any[]>>(
    "surveys:list:dashboard",
    async () => {
      const r = await supabase
        .from("solic_surveys")
        .select(
          "id,status,created_by,requester,needed_date,admin_deadline,completed_at,assets:solic_assets(code,title),urgent"
        )
        .order("needed_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      return { data: r.data as any[] | null, error: r.error };
    },
    { ttlMs: 45_000, staleTtlMs: 10 * 60_000 }
  );
}
