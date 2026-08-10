import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wallet, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import AppSwitcher from '../../../../components/AppSwitcher/AppSwitcher';
import AvatarUsuario from '../../../../components/UI/AvatarUsuario';
import { navSections } from './nav';

function iniciais(nome, email) {
  const base = (nome || email || '').trim();
  if (!base) return '?';
  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

// aberto/onFechar controlam o drawer no mobile; no desktop a sidebar e fixa e
// as duas props sao inofensivas. Ver useDrawerMobile.js.
export default function Sidebar({ aberto = false, onFechar }) {
  const pathname = useLocation().pathname || '';
  const { logout, user, modules } = useAuth();
  const nome = user?.nome || '';
  const email = user?.email || '';

  // Quem já tem acesso ao módulo pode abrir solicitações (o acesso em si já é
  // restrito por cargo/financeiro_role no ModuleRoute).
  const canAbrir = !!modules?.financeiro;
  const isAdmin = modules?.financeiro === 'admin';
  const secoes = navSections({
    canAbrir,
    isAdmin,
    temFinanceiro: !!modules?.financeiro,
    temReembolso: !!modules?.reembolso,
  });
  const [openGroups, setOpenGroups] = useState({});

  const childAtivo = (items) => items.some((i) => pathname.startsWith(i.href));
  const toggleGroup = (key, atual) => setOpenGroups((p) => ({ ...p, [key]: !atual }));

  // Esc fecha o drawer. Fechar ao navegar e feito no onClick de cada link (toda
  // navegacao daqui sai de um <Link>), evitando um efeito que dispararia setState
  // a cada troca de rota.
  useEffect(() => {
    if (!aberto) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onFechar?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onFechar]);

  const renderLink = (item, isSub = false) => (
    <Link
      key={item.href}
      to={item.href}
      title={item.label}
      className={`finSb-link ${isSub ? 'finSb-sublink' : ''} ${pathname.startsWith(item.href) ? 'is-active' : ''}`}
      onClick={onFechar}
    >
      <item.Icon size={16} />
      <span>{item.label}</span>
    </Link>
  );

  return (
    <>
      {/* Escurece o conteudo atras do drawer; so existe no mobile (CSS). */}
      <div
        className={`finSb-overlay ${aberto ? 'is-visible' : ''}`}
        onClick={onFechar}
        aria-hidden="true"
      />

      <aside className={`finSb ${aberto ? 'is-open' : ''}`}>
        <Link
          to="/home"
          className="finSb-brand"
          title="Voltar ao início"
          aria-label="Voltar ao início"
          onClick={onFechar}
        >
          <span className="finSb-logo" aria-hidden="true">
            <Wallet size={20} />
          </span>
          <strong className="finSb-brandtext">Financeiro</strong>
        </Link>

        <nav className="finSb-nav">
          <AppSwitcher currentKey="financeiro" onNavigate={onFechar} />
          {secoes.map((sec) => {
            if (!sec.group) {
              return (
                <div key={sec.label}>
                  <div className="finSb-seclabel">{sec.label}</div>
                  {sec.items.map((item) => renderLink(item))}
                </div>
              );
            }
            // Grupo colapsável (dropdown): auto-abre na rota ativa; toggle manual prevalece.
            const expandido = openGroups[sec.key] ?? childAtivo(sec.items);
            return (
              <div key={sec.key} className="finSb-group">
                <button
                  type="button"
                  className={`finSb-link finSb-group-header ${expandido ? 'expanded' : ''}`}
                  onClick={() => toggleGroup(sec.key, expandido)}
                  aria-expanded={expandido}
                >
                  <sec.Icon size={16} />
                  <span>{sec.label}</span>
                  <ChevronDown className="finSb-chevron" size={16} />
                </button>
                {expandido && (
                  <div className="finSb-group-children">
                    {sec.items.map((item) => renderLink(item, true))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="finSb-footer">
          <AvatarUsuario className="finSb-avatar" iniciais={iniciais(nome, email)} />
          <div className="finSb-userinfo">
            <strong title={nome || email}>{nome || 'Usuário'}</strong>
            <span>Financeiro</span>
          </div>
          <button className="finSb-logout" onClick={logout} title="Sair" type="button">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
