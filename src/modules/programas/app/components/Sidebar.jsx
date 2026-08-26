import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, LogOut } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import AppSwitcher from '../../../../components/AppSwitcher/AppSwitcher';
import AvatarUsuario from '../../../../components/UI/AvatarUsuario';
import { ehComercial } from '../../../../config/programas';
import { navSections } from './nav';

function iniciais(nome, email) {
  const base = (nome || email || '').trim();
  if (!base) return '?';
  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

// aberto/onFechar controlam o drawer no mobile; no desktop a sidebar é fixa e
// as duas props são inofensivas. Ver useDrawerMobile.js.
export default function Sidebar({ aberto = false, onFechar }) {
  const pathname = useLocation().pathname || '';
  const { logout, user, modules } = useAuth();
  const nome = user?.nome || '';
  const email = user?.email || '';
  const secoes = navSections({ ehComercial: ehComercial(modules) });

  // Esc fecha o drawer. Fechar ao navegar é feito no onClick de cada link (toda
  // navegação daqui sai de um <Link>), evitando um efeito que dispararia setState
  // a cada troca de rota.
  useEffect(() => {
    if (!aberto) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onFechar?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onFechar]);

  return (
    <>
      {/* Escurece o conteúdo atrás do drawer; só existe no mobile (CSS). */}
      <div
        className={`pgSb-overlay ${aberto ? 'is-visible' : ''}`}
        onClick={onFechar}
        aria-hidden="true"
      />

      <aside className={`pgSb ${aberto ? 'is-open' : ''}`}>
        <Link
          to="/home"
          className="pgSb-brand"
          title="Voltar ao início"
          aria-label="Voltar ao início"
          onClick={onFechar}
        >
          <span className="pgSb-logo" aria-hidden="true">
            <Sparkles size={20} />
          </span>
          <strong className="pgSb-brandtext">Programas</strong>
        </Link>

        <nav className="pgSb-nav">
          <AppSwitcher currentKey="programas" onNavigate={onFechar} />
          {secoes.map((sec) => (
            <div key={sec.label}>
              <div className="pgSb-seclabel">{sec.label}</div>
              {sec.items.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  title={item.label}
                  className={`pgSb-link ${pathname.startsWith(item.href) ? 'is-active' : ''}`}
                  onClick={onFechar}
                >
                  <item.Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="pgSb-footer">
          <AvatarUsuario className="pgSb-avatar" iniciais={iniciais(nome, email)} />
          <div className="pgSb-userinfo">
            <strong title={nome || email}>{nome || 'Usuário'}</strong>
            <span>Programas</span>
          </div>
          <button className="pgSb-logout" onClick={logout} title="Sair" type="button">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
