import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  CalendarClock,
  UserPlus,
  List,
  CalendarDays,
  FileText,
  Network,
  PlusCircle,
  Workflow,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  LogOut,
} from 'lucide-react';
import logoCal from '../../assets/logo-cal.png';
import AppSwitcher from '../AppSwitcher/AppSwitcher';
import './Sidebar.css';

const menuConfig = {
  admin: [
    { label: 'Cadastro', icon: UserPlus, path: '/admin/cadastro' },
    { label: 'Listagem', icon: List, path: '/admin/listagem' },
    { label: 'Requisições DP', icon: FileText, path: '/admin/solicitacoes', solicitacaoBadge: true },
    { label: 'Fluxos de Aprovação', icon: Workflow, path: '/admin/fluxos' },
    { label: 'Organograma', icon: Network, path: '/organograma' },
  ],
  gestor: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/gestor' },
    { label: 'Minha Equipe', icon: Users, path: '/gestor/equipe' },
    {
      group: true,
      key: 'ausencias',
      label: 'Ausências',
      icon: CalendarClock,
      locked: true,
      children: [
        { label: 'Aprovações', icon: ClipboardCheck, path: '/gestor/aprovacoes', badge: true },
        { label: 'Gestão de Ausência', icon: CalendarClock, path: '/gestor/ausencia' },
        { label: 'Minha Ausência', icon: CalendarDays, path: '/gestor/minha-ausencia' },
      ],
    },
    {
      group: true,
      key: 'solicitacoes',
      label: 'Requisições DP',
      icon: FileText,
      children: [
        { label: 'Requisição', icon: PlusCircle, path: '/gestor/solicitacoes/nova' },
        { label: 'Acompanhar', icon: ClipboardCheck, path: '/gestor/solicitacoes/acompanhar', solicitacaoBadge: true },
      ],
    },
    { label: 'Organograma', icon: Network, path: '/organograma' },
  ],
  rh: [
    { label: 'Nova Requisição', icon: PlusCircle, path: '/gestor/solicitacoes/nova' },
    { label: 'Requisições', icon: ClipboardCheck, path: '/gestor/solicitacoes/acompanhar', solicitacaoBadge: true },
    { label: 'Organograma', icon: Network, path: '/organograma' },
  ],
  usuario: [
    { label: 'Minha Ausência', icon: CalendarDays, path: '/usuario', locked: true },
  ],
};

export default function Sidebar({ isOpen, onClose, collapsed = false, onToggleCollapse, pendingCount = 0, solicitacaoCount = 0 }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState({});

  const items = user ? (menuConfig[user.perfil] || []) : [];

  const isChildActive = (children) =>
    children.some(
      (c) => location.pathname === c.path || location.pathname.startsWith(`${c.path}/`)
    );

  useEffect(() => {
    onClose?.();
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!user) return null;

  const initials = user.nome
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const perfilLabel = {
    admin: 'Administrador',
    gestor: 'Gestor',
    usuario: 'Colaborador',
    rh: 'RH / DP',
  };

  const getDisplayName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

  const childBadge = (item) => {
    if (item.badge && pendingCount > 0) return pendingCount;
    if (item.solicitacaoBadge && solicitacaoCount > 0) return solicitacaoCount;
    return 0;
  };

  const toggleGroup = (key, current) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !current }));
  };

  const renderLocked = (item, isSub = false) => (
    <div
      key={item.path ?? item.key}
      className={`sidebar-link sidebar-locked ${isSub ? 'sidebar-sublink' : ''}`}
      aria-disabled="true"
      title="Em breve"
    >
      <item.icon />
      <span>{item.label}</span>
      <Lock className="sidebar-lock-icon" />
    </div>
  );

  const renderLink = (item, isSub = false) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/gestor' || item.path === '/usuario' || item.path === '/home'}
      className={({ isActive }) =>
        `sidebar-link ${isSub ? 'sidebar-sublink' : ''} ${isActive ? 'active' : ''}`
      }
      onClick={onClose}
    >
      <item.icon />
      <span>{item.label}</span>
      {childBadge(item) > 0 && <span className="sidebar-badge">{childBadge(item)}</span>}
    </NavLink>
  );

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-head">
          <NavLink to="/home" className="sidebar-logo" onClick={onClose} aria-label="Voltar ao início">
            <img src={logoCal} alt="Gestão de Pessoas" />
            <div className="sidebar-logo-text">
              <span>Gestão de</span>
              <span>Pessoas</span>
            </div>
          </NavLink>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          <AppSwitcher currentKey="dp" onNavigate={onClose} />
          {items.map((item) => {
            if (item.locked && !item.group) return renderLocked(item);
            if (!item.group) return renderLink(item);

            // Grupo travado: mostra só o cabeçalho com cadeado, sem expandir.
            if (item.locked) {
              return (
                <div key={item.key} className="sidebar-group">
                  <div
                    className="sidebar-link sidebar-group-header sidebar-locked"
                    aria-disabled="true"
                    title="Em breve"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                    <Lock className="sidebar-lock-icon" />
                  </div>
                </div>
              );
            }

            // Auto-abre na rota ativa; toggle manual passa a prevalecer.
            const expanded = openGroups[item.key] ?? isChildActive(item.children);
            const groupBadge = item.children.reduce((sum, c) => sum + childBadge(c), 0);

            return (
              <div key={item.key} className="sidebar-group">
                <button
                  type="button"
                  className={`sidebar-link sidebar-group-header ${expanded ? 'expanded' : ''}`}
                  onClick={() => toggleGroup(item.key, expanded)}
                  aria-expanded={expanded}
                >
                  <item.icon />
                  <span>{item.label}</span>
                  {!expanded && groupBadge > 0 && (
                    <span className="sidebar-badge">{groupBadge}</span>
                  )}
                  <ChevronDown className="sidebar-chevron" />
                </button>
                {expanded && (
                  <div className="sidebar-group-children">
                    {item.children.map((child) => renderLink(child, true))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="name">{getDisplayName(user.nome)}</div>
              <div className="role">{perfilLabel[user.perfil]}</div>
            </div>
            <button className="sidebar-logout" onClick={logout} title="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
