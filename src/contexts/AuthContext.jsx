import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { horasRoleFromPerfil, perfilEfetivoDp } from '../config/horasPapel';
import { clearSupabaseCache as clearReembolsoCache } from '../modules/reembolso/lib/supabaseCache.js';
import { resetPreload } from '../modules/reembolso/services/dataPreload.js';
import { clearSolicIdentity } from '../modules/solic/lib/identity.ts';
import { clearSupabaseCache as clearSolicCache } from '../modules/solic/lib/supabaseCache.ts';
import { carregarFotoMicrosoft, fotoEmCache, limparFotoMicrosoft } from '../services/fotoMicrosoft';

const AuthContext = createContext(null);

// Papéis da Gestão de Horas — DERIVADOS do perfil da Gestão de Pessoas
// (colaboradores.perfil), a mesma hierarquia do módulo de Pessoas: quem é
// gestor/admin lá é "gestor" aqui, coordenador é "coordenador", o resto é
// "usuario". A visibilidade (subárvore) é da RLS. A regra do papel efetivo
// mora em config/horasPapel.js (a tela de acessos mostra o mesmo cálculo).

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
  if (!data) {
    // Módulo aberto a todo cadastrado: sem perfil, provisiona um (role 'user')
    // via RPC SECURITY DEFINER e relê. Idempotente; se a RPC não existir ainda,
    // segue sem perfil (card aparece bloqueado).
    await supabase.rpc('provisionar_meu_solic_profile');
    const { data: novo } = await supabase
      .from('solic_profiles').select('*').eq('auth_id', authUser.id).maybeSingle();
    data = novo ?? null;
  }
  return data ?? null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);          // colaborador (formato legado: id, nome, email, perfil, funcao, dataAdmissao)
  const [reembolsoProfile, setReembolsoProfile] = useState(null);
  const [solicProfile, setSolicProfile] = useState(null);
  const [fotoUrl, setFotoUrl] = useState(null);    // foto do Microsoft 365 (bolinha do usuário)
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
        setUser(null); setReembolsoProfile(null); setSolicProfile(null); setFotoUrl(null);
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
      const perfilEfetivo = perfilEfetivoDp(colab.perfil, rhDp);
      setUser({
        id: colab.id,
        nome: colab.nome,
        email: colab.email,
        perfil: perfilEfetivo,
        rhDp,
        solicVistoEm: colab.solic_visto_em || null,
        // Última versão de "Novidades" que a pessoa já viu (config/novidades.js).
        novidadesVistoId: colab.novidades_visto_id || null,
        funcao: colab.funcao || null,
        dataAdmissao: colab.data_admissao || null,
        horasGerenciaId: colab.horas_gerencia_id || null,  // gerência p/ ver projetos ao apontar
        horasRole: colab.horas_role || null,               // elevação só-do-Horas (ver horasRoleFromPerfil)
        financeiroRole: colab.financeiro_role || null,     // acesso ao módulo Financeiro
        administrativoRole: colab.administrativo_role || null, // time do Adm (atendente/admin)
        // Capacidade avulsa: trocar o responsável de um chamado do Adm. Não é
        // papel — quem a tem pode ser admin ou atendente. O banco também barra.
        admReatribui: colab.administrativo_reatribui === true,
        programasRole: colab.programas_role || null,           // time comercial dos Programas
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

  // Foto do Microsoft 365 para a bolinha do usuário: pinta o cache na hora e, em
  // paralelo, tenta o Graph com o provider_token que só vem no retorno do login
  // (detalhes em services/fotoMicrosoft.js).
  useEffect(() => {
    const authId = session?.user?.id;
    if (!authId) { setFotoUrl(null); return undefined; }
    setFotoUrl(fotoEmCache(authId));
    let cancelled = false;
    carregarFotoMicrosoft(session).then((url) => { if (!cancelled) setFotoUrl(url); });
    return () => { cancelled = true; };
  }, [session]);

  const signInWithMicrosoft = useCallback(async () => {
    setError(''); setBlocked(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        // User.Read: o token do Graph (session.provider_token) que baixa a foto
        // do perfil para a bolinha do usuário.
        scopes: 'openid profile email User.Read',
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
    limparFotoMicrosoft();
    await supabase.auth.signOut();
    setUser(null); setReembolsoProfile(null); setSolicProfile(null); setFotoUrl(null);
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

  // Carimba a versão de novidades que a pessoa acabou de ver, para o aviso da
  // Home não voltar no próximo login (nem no outro computador — por isso vai
  // para o banco, e não para o localStorage). O estado local anda junto para o
  // popup fechar na hora, sem esperar a ida ao banco.
  const marcarNovidadesVistas = useCallback(async (id) => {
    if (!session?.user || !id) return;
    setUser((u) => (u ? { ...u, novidadesVistoId: id } : u));
    await supabase.rpc('novidades_marcar_visto', { p_id: id });
  }, [session]);

  // Recarrega o perfil/gerência da Gestão de Horas sem exigir logout: o papel
  // agora DERIVA de colaboradores.perfil (Gestão de Pessoas). Quem for promovido
  // a gestor/coordenador lá passa a ver a equipe aqui sem relogar. Chamado pelo
  // shell do módulo ao abrir e ao focar a aba.
  const refreshHorasIdentity = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('colaboradores')
      .select('perfil, rh_dp, horas_gerencia_id, horas_role')
      .eq('auth_id', session.user.id)
      .maybeSingle();
    if (!data) return;
    const rhDp = data.rh_dp === true;
    const perfilEfetivo = perfilEfetivoDp(data.perfil, rhDp);
    const novoHorasRole = data.horas_role || null;
    setUser((u) => {
      if (!u) return u;
      if (u.perfil === perfilEfetivo && u.horasGerenciaId === (data.horas_gerencia_id || null)
          && u.horasRole === novoHorasRole) {
        return u; // nada mudou — evita re-render desnecessário
      }
      return { ...u, perfil: perfilEfetivo, horasGerenciaId: data.horas_gerencia_id || null, horasRole: novoHorasRole };
    });
  }, [session]);

  const modules = useMemo(() => ({
    // DP liberado para gestor, coordenador e admin (RH); usuário comum fica bloqueado.
    dp: ['gestor', 'coordenador', 'admin', 'rh'].includes(user?.perfil) ? user.perfil : null,
    // Reembolso liberado: acesso pelo papel cadastrado em reembolso_profiles.
    // O time do Financeiro (financeiro_role = 'admin') entra como admin mesmo
    // sem cadastro lá — enxerga todos os pedidos e gera o PDF com as notas.
    reembolso: reembolsoProfile?.role ?? (user?.financeiroRole === 'admin' ? 'admin' : null), // user | admin
    solic: solicProfile?.role ?? null,         // user | admin
    // Gestão de Horas: aberto a todos os logados. O papel DERIVA do perfil da
    // Gestão de Pessoas (mesma hierarquia); quem enxerga a equipe são os
    // superiores da árvore (garantido pela RLS). O super-admin também tem passe
    // livre no banco.
    horas: user ? horasRoleFromPerfil(user.perfil, user.horasRole) : null,
    // Financeiro: aberto a todos os logados (como o Administrativo e o
    // Programas). Era restrito a quem tinha CARGO de diretor, gerente ou
    // coordenador, e a restrição não se sustentava: pedir cartão é demanda de
    // quem executa, e quem ficava de fora acabava pedindo pelo gestor — sem
    // rastro de quem realmente precisava. A RLS já é por colaborador (cada um
    // enxerga e edita os PRÓPRIOS pedidos), então abrir a porta não abre dado
    // de ninguém. 'admin' = time do Financeiro (executa/configura fluxos), via
    // financeiro_role (Gerenciar acessos), e continua restrito.
    financeiro: user ? (user.financeiroRole || 'user') : null,
    // Administrativo: aberto a todos os logados (como a Gestão de Horas) —
    // qualquer um abre chamado. 'atendente'/'admin' são o time do Adm, que
    // enxerga a fila; vêm de administrativo_role (Gerenciar acessos).
    administrativo: user ? (user.administrativoRole || 'user') : null,
    // Programas: aberto a todos os logados — qualquer um registra ideia e
    // indica oportunidade. 'comercial'/'admin' são quem avalia a Alavanca e
    // enxerga o painel dela; vêm de programas_role (Gerenciar acessos).
    programas: user ? (user.programasRole || 'user') : null,
  }), [user, reembolsoProfile, solicProfile]);

  const value = useMemo(() => ({
    user, session, modules, reembolsoProfile, solicProfile, fotoUrl,
    blocked, loading, error,
    signInWithMicrosoft, logout, refreshReembolsoProfile, markSolicVisto, refreshHorasIdentity,
    marcarNovidadesVistas,
  }), [user, session, modules, reembolsoProfile, solicProfile, fotoUrl, blocked, loading, error,
       signInWithMicrosoft, logout, refreshReembolsoProfile, markSolicVisto, refreshHorasIdentity,
       marcarNovidadesVistas]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
