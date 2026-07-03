import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Receipt, BarChart3, ShieldCheck, LogOut, ArrowRight, Lock } from 'lucide-react';
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

const CONFETE_CORES = ['#009c3b', '#ffdf00', '#002776', '#ffffff'];

// Confetes gerados uma vez no load do módulo (fora de render/effect).
const CONFETES = Array.from({ length: 50 }, (_, i) => ({
  left: `${Math.random() * 100}%`,
  background: CONFETE_CORES[i % CONFETE_CORES.length],
  animationDelay: `${Math.random() * 0.9}s`,
  animationDuration: `${1.8 + Math.random() * 1.8}s`,
}));

export default function Home() {
  const { user, modules, logout } = useAuth();
  const primeiroNome = user?.nome?.split(' ')[0];
  const [copa, setCopa] = useState(false);

  // A festa some sozinha depois de uns segundos (ou clica pra fechar).
  useEffect(() => {
    if (!copa) return undefined;
    const t = setTimeout(() => setCopa(false), 5500);
    return () => clearTimeout(t);
  }, [copa]);

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
    modules.solic && {
      to: '/solic/dashboard',
      icon: BarChart3,
      tone: 'teal',
      title: 'Solicitações',
      desc: 'Demandas de BI, contratos e prazos',
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
          <button
            type="button"
            className="home-flag"
            onClick={() => setCopa(true)}
            title="Vai, Brasil! 🇧🇷"
            aria-label="Comemorar a Copa do Mundo"
          >
            <span className="home-flag-diamond" />
            <span className="home-flag-circle" />
          </button>
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

      {copa && (
        <div className="copa-overlay" onClick={() => setCopa(false)}>
          {CONFETES.map((c, i) => (
            <span key={i} className="copa-confete" style={c} />
          ))}
          <div className="copa-center">
            <div className="copa-ball">⚽</div>
            <div className="copa-title">BRASIL! 🇧🇷</div>
            <div className="copa-sub">Rumo ao Hexa! 🏆</div>
            <div className="copa-hint">(clique para fechar)</div>
          </div>
        </div>
      )}
    </div>
  );
}
