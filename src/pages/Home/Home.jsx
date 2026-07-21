import { Link } from 'react-router-dom';
import { Users, Receipt, BarChart3, Clock, ShieldCheck, LogOut, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../config/superAdmin';
import './Home.css';

const DP_HOME = { admin: '/admin/listagem', gestor: '/gestor', usuario: '/usuario', rh: '/gestor/solicitacoes/acompanhar' };

function iniciais(nome) {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

export default function Home() {
  const { user, modules, logout } = useAuth();
  const primeiroNome = user?.nome?.split(' ')[0];

  const cards = [
    {
      to: DP_HOME[modules.dp] || '/usuario',
      icon: Users,
      tone: 'blue',
      title: 'Gestão de Pessoas',
      desc: 'Ausências, requisições e equipe',
      // Sem perfil de DP: mostra o card com cadeado/esmaecido em vez de escondê-lo.
      // A liberação é feita em "Gerenciar acessos" (/portal-admin).
      locked: !modules.dp,
    },
    {
      to: '/reembolsos',
      icon: Receipt,
      tone: 'terracotta',
      title: 'Reembolsos',
      desc: 'Reembolsos, adiantamentos e prestação de contas',
      // Sem acesso ao reembolso: card aparece esmaecido/com cadeado, não some.
      locked: !modules.reembolso,
    },
    {
      to: '/solic/dashboard',
      icon: BarChart3,
      tone: 'teal',
      title: 'Solicitações',
      desc: 'Demandas de BI, contratos e prazos',
      // Aberto a todo cadastrado: o perfil é auto-provisionado no login.
      // Sem perfil (caso raro), o card aparece com cadeado em vez de sumir.
      locked: !modules.solic,
    },
    {
      // Módulo aberto a todos: card sempre visível, sem gate de permissão.
      to: '/horas/apontar',
      icon: Clock,
      tone: 'teal',
      title: 'Controle de Horas',
      desc: 'Apontamento de horas por projeto e atividade',
    },
    isSuperAdmin(user) && {
      to: '/portal-admin',
      icon: ShieldCheck,
      tone: 'slate',
      title: 'Gerenciar acessos',
      desc: 'Papéis e acessos de todos os usuários, em todos os apps',
    },
  ].filter(Boolean);

  return (
    <div className="home-hero">
      <header className="home-topbar">
        <div className="home-brand">
          <span className="home-logo-brand" role="img" aria-label="PHD Engenharia" />
        </div>
        <div className="home-user">
          <span className="home-avatar">{iniciais(user?.nome)}</span>
          <span className="home-user-name">{primeiroNome}</span>
          <button type="button" className="home-logout" onClick={logout}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      <main className="home-main">
        <h1>Olá, {primeiroNome}! 🚀</h1>
        <p className="home-sub">O que você precisa fazer hoje?</p>

        <div className="home-cards">
          {cards.map((c) => {
            const Icon = c.icon;
            if (c.locked) {
              return (
                <div key={c.title} className="home-card home-card-locked" aria-disabled="true">
                  <span className={`home-card-icon tone-${c.tone}`}>
                    <Icon size={26} />
                  </span>
                  <span className="home-card-lock" title="Você não tem acesso a este app">
                    <Lock size={15} />
                  </span>
                  <h2>{c.title}</h2>
                  <p>{c.desc}</p>
                  <span className="home-card-cta home-card-cta-locked">
                    <Lock size={14} /> Sem acesso
                  </span>
                </div>
              );
            }
            return (
              <Link key={c.title} to={c.to} className="home-card">
                <span className={`home-card-icon tone-${c.tone}`}>
                  <Icon size={26} />
                </span>
                <h2>{c.title}</h2>
                <p>{c.desc}</p>
                <span className="home-card-cta">
                  Acessar <ArrowRight size={15} />
                </span>
              </Link>
            );
          })}
        </div>
      </main>

      <footer className="home-footer">PHD Engenharia</footer>
    </div>
  );
}
