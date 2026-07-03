// Cliente único do shell — evita segundo GoTrueClient no mesmo projeto.
export { supabase } from '../../../services/supabase';
export const isSupabaseConfigured = true;
