import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BarChart3, Clock, CreditCard, Headset, Sparkles, Boxes, ShieldCheck, LogOut, ArrowRight, Lock, Hourglass, Blocks } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../config/superAdmin';
import { podeAcessarAdm } from '../../config/administrativo';
import { podeAcessarProgramas } from '../../config/programas';
import { podeAcessarEstoque } from '../../config/estoque';
import SolucoesModal from './SolucoesModal';
import AvatarUsuario from '../../components/UI/AvatarUsuario';
import './Home.css';

const DP_HOME = { admin: '/admin/listagem', gestor: '/gestor', usuario: '/usuario', rh: '/gestor/solicitacoes/acompanhar' };

function iniciais(nome) {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

// Primeiro + último nome ("Lennon Santos"), na mesma lógica das iniciais. Os
// nomes do meio ficam de fora e quem só tem um nome não aparece repetido.
function nomeCurto(nome) {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  return partes.length === 1 ? partes[0] : `${partes[0]} ${partes[partes.length - 1]}`;
}

export default function Home() {
  const { user, modules, logout } = useAuth();
  const saudacao = nomeCurto(user?.nome);
  const [solucoesAbertas, setSolucoesAbertas] = useState(false);

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
      // Módulo aberto a todos, como o Controle de Horas — mas ainda não lançado:
      // fica visível e travado, exceto para quem está testando
      // (ver ADM_LIBERADOS em config/administrativo.js).
      to: '/administrativo/novo',
      icon: Headset,
      tone: 'terracotta',
      title: 'Administrativo',
      desc: 'Chamados de frota, viagem, compras e manutenção',
      locked: !podeAcessarAdm(user),
      emBreve: !podeAcessarAdm(user),
    },
    {
      // Aberto a todos, como o Controle de Horas — mas ainda não lançado:
      // fica visível e travado, exceto para quem está testando
      // (ver PROGRAMAS_LIBERADOS em config/programas.js).
      to: '/programas/inicio',
      icon: Sparkles,
      tone: 'terracotta',
      title: 'Programas',
      desc: 'Campo de Ideias e indicações da Alavanca PHD',
      locked: !podeAcessarProgramas(user),
      emBreve: !podeAcessarProgramas(user),
    },
    {
      // Consulta é aberta a todos (quem atende um chamado precisa saber se tem o
      // item); movimentar é do time do Adm, e quem barra é a RLS. Ainda não
      // lançado (ver ESTOQUE_LIBERADOS em config/estoque.js).
      to: '/estoque/posicao',
      icon: Boxes,
      tone: 'slate',
      title: 'Estoque',
      desc: 'Almoxarifado de EPIs e uniformes',
      locked: !podeAcessarEstoque(user),
      emBreve: !podeAcessarEstoque(user),
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
          <AvatarUsuario className="home-avatar" iniciais={iniciais(user?.nome)} title={user?.nome} />
          <button type="button" className="home-logout" onClick={logout}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      <main className="home-main">
        <h1>{saudacao ? `Olá, ${saudacao}!` : 'Olá!'} 🚀</h1>
        <p className="home-sub">O que você precisa fazer hoje?</p>

        <div className="home-cards">
          {cards.map((c) => {
            const Icon = c.icon;
            if (c.locked) {
              // Dois motivos de travar levam ao mesmo visual, mas dizem coisas
              // diferentes: "Em breve" é o módulo que ainda não abriu para
              // ninguém; "Sem acesso" é permissão que falta a esta pessoa.
              const Trava = c.emBreve ? Hourglass : Lock;
              const motivo = c.emBreve ? 'Em breve' : 'Sem acesso';
              const dica = c.emBreve
                ? 'Este app ainda está em construção'
                : 'Você não tem acesso a este app';
              return (
                <div key={c.title} className="home-card home-card-locked" aria-disabled="true">
                  <span className={`home-card-icon tone-${c.tone}`}>
                    <Icon size={26} />
                  </span>
                  <span className="home-card-lock" title={dica}>
                    <Trava size={15} />
                  </span>
                  <h2>{c.title}</h2>
                  <p>{c.desc}</p>
                  <span className="home-card-cta home-card-cta-locked">
                    <Trava size={14} /> {motivo}
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

          {/* Atalhos para as ferramentas externas da empresa: o card não expande,
              abre o popup SolucoesModal (lista em src/config/solucoesIntegradas.js). */}
          <div className="home-card home-card-solucoes">
            <button
              type="button"
              className="home-solucoes-toggle"
              onClick={() => setSolucoesAbertas(true)}
              aria-haspopup="dialog"
            >
              <span className="home-card-icon tone-terracotta">
                <Blocks size={26} />
              </span>
              <h2>Soluções Integradas</h2>
              <p>Acesso rápido às ferramentas usadas na empresa</p>
              <span className="home-card-cta">
                Ver atalhos <ArrowRight size={15} />
              </span>
            </button>
          </div>
        </div>
      </main>

      <footer className="home-footer">PHD Engenharia</footer>

      {solucoesAbertas && <SolucoesModal onClose={() => setSolucoesAbertas(false)} />}
    </div>
  );
}
