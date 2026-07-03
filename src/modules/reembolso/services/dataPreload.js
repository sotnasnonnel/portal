import { isSupabaseConfigured } from "../lib/supabase.js";
import { listGestores, listReimbursements } from "./reimbursements.js";

// Aquece o cache logo após o login (em tempo ocioso), antes de o usuário navegar:
// a lista (compartilhada por reembolso/adiantamento) e o diretório de gestores.
let started = false;

function runWhenIdle(cb) {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) window.requestIdleCallback(cb, { timeout: 1500 });
  else window.setTimeout(cb, 300); // fallback (ex.: Safari)
}

export function preloadReembolsoData() {
  if (started || !isSupabaseConfigured) return;
  started = true;
  runWhenIdle(() => {
    // allSettled: se uma falhar, a outra segue. Não bloqueia a UI.
    Promise.allSettled([listReimbursements({}), listGestores()]);
  });
}

// Permite re-aquecer no próximo login (chamado no logout).
export function resetPreload() {
  started = false;
}
