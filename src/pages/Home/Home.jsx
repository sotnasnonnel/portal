import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BarChart3, Clock, CreditCard, ShieldCheck, LogOut, ArrowRight, Lock, Blocks, ChevronDown, ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../config/superAdmin';
import { SOLUCOES_INTEGRADAS } from '../../config/solucoesIntegradas';
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
  const [solucoesAbertas, setSolucoesAbertas] = useState(false);
  const painelSolucoesRef = useRef(null);

  // Ao expandir, traz o painel para a área visível (o card pode estar no fim da tela).
  useEffect(() => {
    if (!solucoesAbertas) return;
    painelSolucoesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [solucoesAbertas]);

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
      to: '/solic/dashboard',
      icon: BarChart3,
      tone: 'teal',
      title: 'PMO',
      desc: 'Demandas de BI e acompanhamento',
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
    {
      // Reembolsos deixou de ser card próprio: virou um grupo na sidebar do
      // Financeiro. Quem tem só o Reembolso entra por aqui — sem isto, ficaria
      // sem nenhuma porta de acesso.
      to: modules.financeiro ? '/financeiro' : '/reembolsos',
      icon: CreditCard,
      tone: 'blue',
      title: 'Financeiro',
      desc: 'Cartões virtuais, limites e reembolsos',
      // Sem acesso: card aparece esmaecido/com cadeado. Liberação em "Gerenciar acessos".
      locked: !modules.financeiro && !modules.reembolso,
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

          {/* Card expansível: atalhos para as ferramentas externas da empresa.
              A lista vem de src/config/solucoesIntegradas.js. */}
          <div className={`home-card home-card-solucoes${solucoesAbertas ? ' is-open' : ''}`}>
            <button
              type="button"
              className="home-solucoes-toggle"
              onClick={() => setSolucoesAbertas((v) => !v)}
              aria-expanded={solucoesAbertas}
              aria-controls="painel-solucoes"
            >
              <span className="home-card-icon tone-terracotta">
                <Blocks size={26} />
              </span>
              <h2>Soluções Integradas</h2>
              <p>Acesso rápido às ferramentas usadas na empresa</p>
              <span className="home-card-cta">
                {solucoesAbertas ? 'Recolher' : 'Ver soluções'}
                <ChevronDown size={15} className="home-solucoes-chevron" />
              </span>
            </button>
          </div>

          {/* A lista abre como painel de largura total abaixo da grade: se ficasse
              dentro do card, os cards vizinhos esticariam junto (align-items: stretch). */}
          {solucoesAbertas && (
            <div className="home-solucoes-painel" id="painel-solucoes" ref={painelSolucoesRef}>
              <ul className="home-solucoes-lista">
                {SOLUCOES_INTEGRADAS.map((s) => {
                  const SIcon = s.icon;
                  if (!s.url) {
                    return (
                      <li key={s.nome}>
                        <span className="home-solucao home-solucao-breve" aria-disabled="true">
                          <SIcon size={18} />
                          <span className="home-solucao-txt">
                            <strong>{s.nome}</strong>
                            <small>{s.desc}</small>
                          </span>
                          <em>Em breve</em>
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={s.nome}>
                      <a className="home-solucao" href={s.url} target="_blank" rel="noopener noreferrer">
                        <SIcon size={18} />
                        <span className="home-solucao-txt">
                          <strong>{s.nome}</strong>
                          <small>{s.desc}</small>
                        </span>
                        <ExternalLink size={15} />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </main>

      <footer className="home-footer">PHD Engenharia</footer>
    </div>
  );
}
