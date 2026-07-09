import { Link, useLocation } from 'react-router-dom';
import { Clock, BarChart3, ListChecks, FolderKanban, LogOut } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import AppSwitcher from '../../../../components/AppSwitcher/AppSwitcher';

function iniciais(nome, email) {
  const base = (nome || email || '').trim();
  if (!base) return '?';
  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

// Navegação por papel. Membro registra e vê o próprio tempo; admin gerencia
// projetos e vê o tempo de todos.
function navItems(isAdmin) {
  const base = [
    { label: 'Apontar', href: '/horas/apontar', Icon: Clock },
    { label: isAdmin ? 'Dashboard' : 'Meu Dashboard', href: '/horas/dashboard', Icon: BarChart3 },
    { label: isAdmin ? 'Relatórios' : 'Meus Registros', href: '/horas/registros', Icon: ListChecks },
  ];
  if (isAdmin) base.push({ label: 'Projetos', href: '/horas/projetos', Icon: FolderKanban });
  return base;
}

export default function Sidebar() {
  const pathname = useLocation().pathname || '';
  const { logout, modules, user } = useAuth();

  const isAdmin = modules?.horas === 'admin';
  const nome = user?.nome || '';
  const email = user?.email || '';

  const onLogout = async () => {
    await logout();
  };

  return (
    <aside className="horasSb">
      <Link to="/home" className="horasSb-brand" title="Voltar ao início" aria-label="Voltar ao início">
        <span className="horasSb-logo" aria-hidden="true">
          <Clock size={20} />
        </span>
        <strong className="horasSb-brandtext">Controle de Horas</strong>
      </Link>

      <nav className="horasSb-nav">
        <AppSwitcher currentKey="horas" />
        <div className="horasSb-seclabel">Menu</div>
        {navItems(isAdmin).map(({ label, href, Icon }) => (
          <Link
            key={href}
            to={href}
            title={label}
            className={`horasSb-link ${pathname.startsWith(href) ? 'is-active' : ''}`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="horasSb-footer">
        <div className="horasSb-avatar">{iniciais(nome, email)}</div>
        <div className="horasSb-userinfo">
          <strong title={nome || email}>{nome || 'Usuário'}</strong>
          <span>{isAdmin ? 'Administrador' : 'Membro'}</span>
        </div>
        <button className="horasSb-logout" onClick={onLogout} title="Sair" type="button">
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
