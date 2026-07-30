import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import AppSwitcher from '../../../../components/AppSwitcher/AppSwitcher';
import { ROLE_LABEL, isHorasExtrasDp } from '../../lib/roles';
import { navSections } from './nav';

function iniciais(nome, email) {
  const base = (nome || email || '').trim();
  if (!base) return '?';
  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

// aberto/onFechar controlam o drawer no mobile; no desktop a sidebar e fixa e
// as duas props sao inofensivas. Ver src/hooks/useDrawerMobile.js.
export default function Sidebar({ aberto = false, onFechar }) {
  const pathname = useLocation().pathname || '';
  const { logout, modules, user } = useAuth();

  const role = modules?.horas || 'usuario';
  const nome = user?.nome || '';
  const email = user?.email || '';

  // Esc fecha o drawer; fechar ao navegar sai do onClick de cada link.
  useEffect(() => {
    if (!aberto) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onFechar?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onFechar]);

  const onLogout = async () => {
    await logout();
  };

  return (
    <>
      {/* Escurece o conteudo atras do drawer; so existe no mobile (CSS). */}
      <div
        className={`horasSb-overlay ${aberto ? 'is-visible' : ''}`}
        onClick={onFechar}
        aria-hidden="true"
      />

      <aside className={`horasSb ${aberto ? 'is-open' : ''}`}>
        <Link
          to="/home"
          className="horasSb-brand"
          title="Voltar ao início"
          aria-label="Voltar ao início"
          onClick={onFechar}
        >
          <span className="horasSb-logo" aria-hidden="true">
            <Clock size={20} />
          </span>
          <strong className="horasSb-brandtext">Controle de Horas</strong>
        </Link>

        <nav className="horasSb-nav">
          <AppSwitcher currentKey="horas" onNavigate={onFechar} />
          {navSections(role, { dp: isHorasExtrasDp(user) }).map((sec) => (
            <div key={sec.label}>
              <div className="horasSb-seclabel">{sec.label}</div>
              {sec.items.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  title={item.label}
                  className={`horasSb-link ${pathname.startsWith(item.href) ? 'is-active' : ''}`}
                  onClick={onFechar}
                >
                  <item.Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="horasSb-footer">
          <div className="horasSb-avatar">{iniciais(nome, email)}</div>
          <div className="horasSb-userinfo">
            <strong title={nome || email}>{nome || 'Usuário'}</strong>
            <span>{ROLE_LABEL[role]}</span>
          </div>
          <button className="horasSb-logout" onClick={onLogout} title="Sair" type="button">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
