// Adaptador: expõe o shape que as páginas do reembolso esperam, em cima do auth unificado.
import { useAuth as useUnifiedAuth } from '../../../contexts/AuthContext';

export const DEMO_MODE = false;
export const DEMO_LOGINS = [];

export function useAuth() {
  const { session, reembolsoProfile, loading, logout, refreshReembolsoProfile } = useUnifiedAuth();
  return {
    session,
    profile: reembolsoProfile,
    loading,
    signOut: logout,
    refreshProfile: refreshReembolsoProfile,
    demoMode: false,
  };
}
