import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { clearSupabaseCache as clearReembolsoCache } from '../modules/reembolso/lib/supabaseCache.js';
import { resetPreload } from '../modules/reembolso/services/dataPreload.js';
import { clearSolicIdentity } from '../modules/solic/lib/identity.ts';
import { clearSupabaseCache as clearSolicCache } from '../modules/solic/lib/supabaseCache.ts';

const AuthContext = createContext(null);

// Papéis do Controle de Horas (colaboradores.horas_role). Ver modules.horas abaixo.
const HORAS_ROLES = ['usuario', 'gerente', 'diretoria'];

// Limpa o ?code= do retorno OAuth da URL (PKCE + HashRouter).
function cleanOAuthParams() {
  if (window.location.search.includes('code=')) {
    window.history.replaceState(null, '', window.location.origin + window.location.pathname + window.location.hash);
  }
}

// Resolve o colaborador mestre: 1º por auth_id, senão por e-mail (e grava o auth_id).
// Erro de rede/banco NÃO pode virar "bloqueado": retorna { error } pra UI pedir retry.
async function resolveColaborador(authUser) {
  const byAuthId = await supabase
    .from('colaboradores').select('*').eq('auth_id', authUser.id).maybeSingle();
  if (byAuthId.error) return { error: byAuthId.error };
  let colab = byAuthId.data;
  if (!colab) {
    const byEmail = await supabase
      .from('colaboradores').select('*').ilike('email', authUser.email).maybeSingle();
    if (byEmail.error) return { error: byEmail.error };
    if (byEmail.data) {
      // Vincula o auth_id pela RPC SECURITY DEFINER (a RLS bloqueia UPDATE direto
      // de colaboradores para quem não é admin — inclusive no 1º login de admins).
      await supabase.rpc('link_my_auth');
      colab = { ...byEmail.data, auth_id: authUser.id };
    }
  }
  if (!colab) {
    // 1º login de quem ainda não está cadastrado: provisiona "Sem acesso" (perfil
    // nulo) para a pessoa aparecer nas listas (Gerenciar acessos / Listagem DP),
    // e re-resolve. RPC SECURITY DEFINER (a RLS só deixa admin inserir).
    await supabase.rpc('provisionar_meu_colaborador');
    const novo = await supabase
      .from('colaboradores').select('*').eq('auth_id', authUser.id).maybeSingle();
    if (novo.error) return { error: novo.error };
    colab = novo.data;
  }
  return { colab: colab ?? null };
}

// Perfil do módulo Solicitações: 1º por auth_id, senão por e-mail (e grava o auth_id).
async function resolveSolicProfile(authUser) {
  let { data } = await supabase
    .from('solic_profiles').select('*').eq('auth_id', authUser.id).maybeSingle();
  if (!data) {
    const { data: byEmail } = await supabase
      .from('solic_profiles').select('*').ilike('email', authUser.email).maybeSingle();
    if (byEmail) {
      await supabase.from('solic_profiles').update({ auth_id: authUser.id }).eq('id', byEmail.id);
      data = { ...byEmail, auth_id: authUser.id };
    }
  }
  return data ?? null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);          // colaborador (formato legado: id, nome, email, perfil, funcao, dataAdmissao)
  const [reembolsoProfile, setReembolsoProfile] = useState(null);
  const [solicProfile, setSolicProfile] = useState(null);
  const [blocked, setBlocked] = useState(null);    // e-mail sem cadastro em colaboradores
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session ?? null);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => {
      setSession(next ?? null);
      if (!next) {
        setUser(null); setReembolsoProfile(null); setSolicProfile(null);
        setLoading(false);
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    // TOKEN_REFRESHED (~1h) entrega um novo objeto de sessão p/ o mesmo usuário:
    // não re-resolver perfis nem flipar loading (desmontaria a árvore inteira no meio de um form).
    if (user && user.authId === session.user.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const authUser = session.user;
      const [colabRes, reemRes, solic] = await Promise.all([
        resolveColaborador(authUser),
        supabase.from('reembolso_profiles').select('*').eq('id', authUser.id).maybeSingle(),
        resolveSolicProfile(authUser),
      ]);
      if (cancelled) return;
      if (colabRes.error) {
        // Falha transitória de rede/banco: não bloquear nem derrubar a sessão.
        setError('Não foi possível carregar seu cadastro. Tente entrar novamente.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
      const colab = colabRes.colab;
      if (!colab || colab.ativo === false) {
        setBlocked(authUser.email);
        cleanOAuthParams();
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
      setBlocked(null);
      const rhDp = colab.rh_dp === true;
      // Perfil efetivo no DP: RH que não é gestor/admin navega como 'rh' (perfil real fica no banco).
      const perfilEfetivo = (rhDp && !['gestor', 'admin', 'coordenador'].includes(colab.perfil)) ? 'rh' : colab.perfil;
      setUser({
        id: colab.id,
        nome: colab.nome,
        email: colab.email,
        perfil: perfilEfetivo,
        rhDp,
        solicVistoEm: colab.solic_visto_em || null,
        funcao: colab.funcao || null,
        dataAdmissao: colab.data_admissao || null,
        horasRole: colab.horas_role || 'usuario',   // usuario | gerente | diretoria
        horasGerenciaId: colab.horas_gerencia_id || null,  // escopo do gerente
        authId: authUser.id,
      });
      setReembolsoProfile(reemRes.data ?? null);
      setSolicProfile(solic);
      setLoading(false);
      cleanOAuthParams();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- user lido só p/ short-circuit do refresh
  }, [session]);

  const signInWithMicrosoft = useCallback(async () => {
    setError(''); setBlocked(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'openid profile email',
        redirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) setError('Erro ao iniciar login Microsoft: ' + error.message);
  }, []);

  const logout = useCallback(async () => {
    // Limpa caches dos módulos antes de encerrar a sessão para evitar
    // dados obsoletos se outro usuário fizer login na mesma aba.
    clearReembolsoCache();
    resetPreload();
    clearSolicIdentity();
    clearSolicCache();
    await supabase.auth.signOut();
    setUser(null); setReembolsoProfile(null); setSolicProfile(null);
  }, []);

  const refreshReembolsoProfile = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('reembolso_profiles').select('*').eq('id', session.user.id).maybeSingle();
    setReembolsoProfile(data ?? null);
  }, [session]);

  const markSolicVisto = useCallback(async () => {
    const agora = new Date().toISOString();
    await supabase.rpc('solic_marcar_visto');
    setUser((u) => (u ? { ...u, solicVistoEm: agora } : u));
    window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
  }, []);

  // Recarrega o papel/gerência do Controle de Horas sem exigir logout: o papel
  // vem de colaboradores.horas_role, editado em /portal-admin, e antes só era
  // lido no login — quem fosse promovido a gerente/diretoria seguia na visão
  // antiga. Chamado pelo shell do módulo ao abrir e ao focar a aba.
  const refreshHorasIdentity = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('colaboradores')
      .select('horas_role, horas_gerencia_id')
      .eq('auth_id', session.user.id)
      .maybeSingle();
    if (!data) return;
    setUser((u) => {
      if (!u) return u;
      if (u.horasRole === (data.horas_role || 'usuario') && u.horasGerenciaId === (data.horas_gerencia_id || null)) {
        return u; // nada mudou — evita re-render desnecessário
      }
      return { ...u, horasRole: data.horas_role || 'usuario', horasGerenciaId: data.horas_gerencia_id || null };
    });
  }, [session]);

  const modules = useMemo(() => ({
    // DP liberado para gestor, coordenador e admin (RH); usuário comum fica bloqueado.
    dp: ['gestor', 'coordenador', 'admin', 'rh'].includes(user?.perfil) ? user.perfil : null,
    // Reembolso temporariamente bloqueado para todos os usuários.
    reembolso: null,                           // (reembolsoProfile?.role) — desativado por enquanto
    solic: solicProfile?.role ?? null,         // user | admin
    // Controle de Horas: aberto a todos os logados. O papel é próprio do módulo
    // (colaboradores.horas_role) e é a ÚNICA fonte da verdade na UI — sem override
    // de super-admin, senão o seletor de /portal-admin não teria efeito visível
    // para quem o edita. (A RLS ainda dá passe livre ao super-admin no banco.)
    horas: user ? (HORAS_ROLES.includes(user.horasRole) ? user.horasRole : 'usuario') : null,
  }), [user, solicProfile]);

  const value = useMemo(() => ({
    user, session, modules, reembolsoProfile, solicProfile,
    blocked, loading, error,
    signInWithMicrosoft, logout, refreshReembolsoProfile, markSolicVisto, refreshHorasIdentity,
  }), [user, session, modules, reembolsoProfile, solicProfile, blocked, loading, error,
       signInWithMicrosoft, logout, refreshReembolsoProfile, markSolicVisto, refreshHorasIdentity]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
