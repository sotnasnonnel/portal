// Adaptador: expõe o shape que as páginas do reembolso esperam, em cima do auth unificado.
import { useMemo } from 'react';
import { useAuth as useUnifiedAuth } from '../../../contexts/AuthContext';

export const DEMO_MODE = false;
export const DEMO_LOGINS = [];

export function useAuth() {
  const { session, user, reembolsoProfile, loading, logout, refreshReembolsoProfile } = useUnifiedAuth();

  // O time do Financeiro (colaboradores.financeiro_role = 'admin') tem a mesma
  // visão do admin do reembolso: vê todos os pedidos, agenda pagamento e gera o
  // PDF com as notas. O papel real (role) é preservado — quem é gestor continua
  // aprovando a equipe e quem é solicitante continua abrindo os próprios pedidos.
  // A visibilidade em si é garantida pela RLS (reembolso_private.is_admin()).
  const profile = useMemo(() => {
    const finAdmin = user?.financeiroRole === 'admin';
    const base =
      reembolsoProfile ??
      (finAdmin && session?.user
        ? { id: session.user.id, full_name: user?.nome ?? '', email: user?.email ?? '', role: 'solicitante' }
        : null);
    if (!base) return null;
    return { ...base, isAdmin: base.role === 'admin' || finAdmin };
  }, [reembolsoProfile, session, user]);

  return {
    session,
    profile,
    loading,
    signOut: logout,
    refreshProfile: refreshReembolsoProfile,
    demoMode: false,
  };
}
