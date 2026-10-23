import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BarChart3, Clock, CreditCard, Headset, Sparkles, ShieldCheck, LogOut, ArrowRight, Lock, Hourglass, Blocks, MessageSquarePlus, Megaphone, Radar, Star, Newspaper } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePontos } from '../../contexts/PontosContext';
import { novidadesDoFeed } from '../../services/feed';
import { veFeed } from '../../config/feed';
import Insignia from '../../components/Pontos/Insignia';
import { NOME_TITULO } from '../../config/pontos';
import { isSuperAdmin } from '../../config/superAdmin';
import { areasAdministrativoDe } from '../../config/administrativo';
import { podeAcessarProgramas } from '../../config/programas';
import { podeVerTorre } from '../../config/torre';
import { areasFinanceiroDe } from '../../config/financeiro';
import { FALE_CONOSCO_ATIVO, FALE_CONOSCO_OPEN_EVENT, SLA_HORAS, MSG_FALE_CONOSCO_TRAVADO, faleConoscoTravado } from '../../config/suporte';
import { NOVIDADES, ULTIMA_NOVIDADE, novidadesNaoVistas } from '../../config/novidades';
import FaleConoscoModal from '../../components/FaleConosco/FaleConoscoModal';
import SolucoesModal from './SolucoesModal';
import ProgramasModal from './ProgramasModal';
import FinanceiroModal from './FinanceiroModal';
import HorasModal from './HorasModal';
import AdministrativoModal from './AdministrativoModal';
import GestaoPessoasModal from './GestaoPessoasModal';
import HumorDoDia from './HumorDoDia';
import AniversariantesMes from './AniversariantesMes';
import DestaqueDoDia from './DestaqueDoDia';
import AprovacoesHome from './AprovacoesHome';
import { iniciais, nomeProprio } from '../../utils/pessoas';
import { areasGestaoPessoas } from '../../components/Layout/nav';
import NovidadesModal from '../../components/Novidades/NovidadesModal';
import SinoNotificacoes from '../../components/Notificacoes/SinoNotificacoes';
import AtalhoAprovacoes from '../../modules/aprovacoes/AtalhoAprovacoes';
import AvatarUsuario from '../../components/UI/AvatarUsuario';
import { nomeCurto } from '../../utils/formatters';
import './Home.css';

const preCarregarLoja = () => { import('../Pontos/Pontos'); };

// "Terça-feira, 13 de outubro"
const hojePorExtenso = () => {
  const t = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export default function Home() {
  const { user, modules, logout, marcarNovidadesVistas } = useAuth();
  const saudacao = nomeProprio(nomeCurto(user?.nome));
  const { perfil, saldo } = usePontos();
  const [novosNoFeed, setNovosNoFeed] = useState(0);
  useEffect(() => {
    let vivo = true;
    if (veFeed(user)) novidadesDoFeed().then((n) => { if (vivo) setNovosNoFeed(n); });
    return () => { vivo = false; };
  }, [user]);
  const [solucoesAbertas, setSolucoesAbertas] = useState(false);
  const [programasAbertos, setProgramasAbertos] = useState(false);
  const [financeiroAberto, setFinanceiroAberto] = useState(false);
  const [horasAberto, setHorasAberto] = useState(false);
  const [admAberto, setAdmAberto] = useState(false);
  const [gpAberto, setGpAberto] = useState(false);

  // "O que mudou na plataforma": a Home é a primeira tela depois do login, e é
  // aqui que o aviso aparece — uma vez por versão, por pessoa (o carimbo vai
  // para o banco em marcarNovidadesVistas). Fora isso, o botão da barra reabre
  // o histórico quando a pessoa quiser.
  const naoVistas = useMemo(() => novidadesNaoVistas(user?.novidadesVistoId), [user?.novidadesVistoId]);
  // Estado inicial e não efeito: a Home só monta com o usuário já carregado
  // (ProtectedRoute), então o que abre sozinho se decide no primeiro render.
  const [novidades, setNovidades] = useState(() => (naoVistas.length ? { itens: naoVistas, historico: false } : null));

  const fecharNovidades = () => {
    setNovidades(null);
    // Carimba sempre a versão mais recente: quem fechou viu o que havia de novo,
    // e reabrir pelo botão não deve ressuscitar o aviso automático.
    if (naoVistas.length) marcarNovidadesVistas(ULTIMA_NOVIDADE.id);
  };

  // Com as duas áreas liberadas, a escolha (Cartões / Reembolso) vem antes de
  // entrar, como no card "Programas". Com uma só, o popup teria um botão
  // sozinho — um clique a mais para não escolher nada —, então vai direto.
  const areasFin = areasFinanceiroDe(modules);
  // Gestão de Pessoas: sempre abre o popup de áreas. A Ausência Programada é
  // de todo colaborador, então até quem não tem perfil de DP (modules.dp) tem
  // pelo menos esse card — as demais áreas continuam só para quem já as tinha.
  const areasGp = areasGestaoPessoas({ perfil: user?.perfil, user });

  // Chamados, Estoque e Mobilização viraram um card só — são o mesmo time, e
  // três cards lado a lado faziam a Home pedir que a pessoa soubesse de antemão
  // em qual deles o que ela precisa mora. Com uma área só liberada o popup
  // teria um botão sozinho, então vai direto, como no card "Financeiro".
  const areasAdm = areasAdministrativoDe(user);

  const cards = [
    {
      acao: () => setGpAberto(true),
      icon: Users,
      tone: 'blue',
      title: 'Gestão de Pessoas',
      desc: 'Ausência programada, requisições e equipe',
      // Sem nenhuma área (caso raro): card com cadeado em vez de sumir.
      locked: areasGp.length === 0,
    },
    {
      to: '/solic/dashboard',
      icon: BarChart3,
      tone: 'teal',
      title: 'Dados',
      desc: 'Demandas de BI e acompanhamento',
      // Aberto a todo cadastrado: o perfil é auto-provisionado no login.
      // Sem perfil (caso raro), o card aparece com cadeado em vez de sumir.
      locked: !modules.solic,
    },
    {
      // Módulo aberto a todos: card sempre visível, sem gate de permissão.
      // Apontamento e Horas Extras se resolvem em telas diferentes, então o
      // card abre a escolha em popup (ver AREAS_HORAS em config/horas.js) —
      // mesmo desenho do card "Financeiro".
      acao: () => setHorasAberto(true),
      icon: Clock,
      tone: 'teal',
      title: 'Gestão de Horas',
      desc: 'Apontamento por projeto e solicitação de horas extras',
    },
    {
      // Card guarda-chuva do time do Adm: Chamados, Estoque e Mobilização (ver
      // AREAS_ADMINISTRATIVO em config/administrativo.js). Cada área mantém o
      // próprio gate — Estoque e Mobilização seguem em lançamento restrito e
      // só aparecem no popup para quem já entrava neles.
      ...(areasAdm.length > 1
        ? { acao: () => setAdmAberto(true) }
        : { to: areasAdm[0]?.href || '/administrativo/novo' }),
      icon: Headset,
      tone: 'terracotta',
      title: 'Atendimento',
      desc: 'Chamados, almoxarifado e mobilização',
      locked: areasAdm.length === 0,
    },
    {
      // Aberto a todos os logados, como a Gestão de Horas (lançado em
      // 2026-08-28; a trava está em PROGRAMAS_EM_BREVE, config/programas.js).
      // Não navega: abre a escolha de programa em popup, e o programa
      // escolhido é que leva para dentro do módulo.
      acao: () => setProgramasAbertos(true),
      icon: Sparkles,
      tone: 'terracotta',
      title: 'Programas',
      desc: 'Campo de Ideias e indicações da Alavanca PHD',
      locked: !podeAcessarProgramas(user),
      emBreve: !podeAcessarProgramas(user),
    },
    {
      // Só consulta: o quadro e a lista de etapas, sem nenhuma edição. É a
      // tela da reunião de torre, para coordenação, gerência e diretoria.
      to: '/torre/mapa',
      icon: Radar,
      tone: 'slate',
      title: 'Torre de Controle',
      desc: 'Status dos seus chamados e mobilizações, num quadro só',
      locked: !podeVerTorre(user, modules),
      emBreve: !podeVerTorre(user, modules),
    },
    {
      // Cartões e Reembolso são duas rotinas sem relação uma com a outra, então
      // o card abre a escolha em popup (ver AREAS_FINANCEIRO em
      // config/financeiro.js). Com acesso a uma só, navega direto para ela —
      // é também o que garante porta de entrada para quem tem só o Reembolso,
      // que deixou de ser card próprio e virou grupo na sidebar do Financeiro.
      ...(areasFin.length > 1
        ? { acao: () => setFinanceiroAberto(true) }
        : { to: areasFin[0]?.href || '/financeiro' }),
      icon: CreditCard,
      tone: 'blue',
      title: 'Financeiro',
      desc: 'Cartões virtuais, limites e reembolsos',
      // Sem acesso: card aparece esmaecido/com cadeado. Liberação em "Gerenciar acessos".
      locked: areasFin.length === 0,
    },
    isSuperAdmin(user) && {
      to: '/portal-admin',
      icon: ShieldCheck,
      tone: 'slate',
      title: 'Gerenciar acessos',
      desc: 'Papéis e acessos de todos os usuários, em todos os apps',
    },
    {
      // Atalhos para as ferramentas externas da empresa: abre o popup
      // SolucoesModal (lista em src/config/solucoesIntegradas.js).
      acao: () => setSolucoesAbertas(true),
      icon: Blocks,
      tone: 'terracotta',
      title: 'Soluções Integradas',
      desc: 'Acesso rápido às ferramentas usadas na empresa',
    },
  ].filter(Boolean);
  // Os travados saem da grade: ocupavam o lugar de um módulo que funciona e
  // disputavam a atenção com ele. Viram uma linha discreta no fim.
  const abertos = cards.filter((c) => !c.locked);
  const travados = cards.filter((c) => c.locked);

  return (
    <div className="home-hero">
      {FALE_CONOSCO_ATIVO && <FaleConoscoModal modulo="Portal" />}
      <header className="home-topbar">
        <div className="home-brand">
          <span className="home-logo-brand" role="img" aria-label="PHD Engenharia" />
        </div>
        <div className="home-user">
          {/* O canal também na Home: é a tela em que a pessoa está quando o que
              ela quer dizer é sobre o portal inteiro, e não sobre um módulo. */}
          {/* Histórico de novidades. Só o ícone, como o sino ao lado: o ponto
              acende quando há versão que esta pessoa ainda não viu — some
              assim que ela fecha o aviso. */}
          <button
            type="button"
            className="home-iconbtn home-novidades"
            onClick={() => setNovidades({ itens: NOVIDADES, historico: true })}
            aria-label={naoVistas.length > 0 ? 'Novidades (tem coisa nova)' : 'Novidades'}
            title="Novidades — o que mudou na plataforma"
          >
            <Megaphone size={18} />
            {naoVistas.length > 0 && <span className="home-novidades-dot" aria-hidden="true" />}
          </button>
          {/* Feed PHD: posts, curtidas e comentários (pages/Feed). */}
          {/* Post novo avisa SÓ aqui, com o número do que chegou desde a última
              visita; o sino fica para quando a pessoa é marcada. */}
          {veFeed(user) && (
          <Link to="/feed" className="home-iconbtn" title="Feed PHD — o que está rolando na empresa"
            aria-label={novosNoFeed > 0 ? `Feed PHD (${novosNoFeed} post${novosNoFeed === 1 ? '' : 's'} novo${novosNoFeed === 1 ? '' : 's'})` : 'Feed PHD'}>
            <Newspaper size={18} />
            {novosNoFeed > 0 && <span className="home-feed-contador" aria-hidden="true">{novosNoFeed > 9 ? '9+' : novosNoFeed}</span>}
          </Link>
          )}
          {/* Pontos: o saldo, ao lado de Novidades, leva para a Personalização.
              É também o alvo do "+N" que voa quando a pessoa ganha pontos. */}
          {saldo !== null && (
            <Link to="/personalizacao" className="home-pontos" data-pontos-alvo
              onMouseEnter={preCarregarLoja} onFocus={preCarregarLoja}
              aria-label={`${saldo} pontos. Abrir a Personalização`} title="Seus pontos. Troque por molduras, títulos e temas">
              <Star size={16} aria-hidden="true" /> <b>{saldo.toLocaleString('pt-BR')}</b> pts
            </Link>
          )}
          {/* A central de notificações é uma só; na Home ela fica no mesmo
              formato do botão de Novidades. */}
          <AtalhoAprovacoes className="home-iconbtn" />
          <SinoNotificacoes />
          {FALE_CONOSCO_ATIVO && (
          <button
            type="button"
            className="home-fale"
            onClick={() => window.dispatchEvent(new Event(FALE_CONOSCO_OPEN_EVENT))}
            disabled={faleConoscoTravado(user)}
            style={faleConoscoTravado(user) ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
            title={faleConoscoTravado(user)
              ? MSG_FALE_CONOSCO_TRAVADO
              : `Fale conosco — bug, melhoria ou elogio (resposta em até ${SLA_HORAS}h)`}
          >
            {faleConoscoTravado(user) ? <Lock size={16} /> : <MessageSquarePlus size={16} />}
            Fale conosco
          </button>
          )}
          <AvatarUsuario className="home-avatar" iniciais={iniciais(user?.nome)} title={user?.nome} />
          <button type="button" className="home-logout" onClick={logout}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      <main className="home-main">
        <div className="home-col">
          <DestaqueDoDia />
          <div className="home-ola">
            <div>
              <h1>{saudacao ? `Olá, ${saudacao}!` : 'Olá!'} <span className="home-foguete" aria-hidden="true">🚀</span></h1>
              <p className="home-sub">{hojePorExtenso()}</p>
              {/* O título (insígnia) que a pessoa usa, abaixo da saudação. */}
              {perfil?.titulo && (
                <div className="home-pontos-linha">
                  <Insignia id={perfil.titulo} nome={NOME_TITULO[perfil.titulo]} texto={perfil.titulo_texto} mini />
                </div>
              )}
            </div>
            <HumorDoDia />
          </div>

          {/* A Central de Aprovações deixou de ser card: é a única coisa da
              Home que pede ação, então vem antes dos módulos. */}
          <AprovacoesHome />

          <h2 className="home-mods-tit">Seus módulos</h2>
          <div className="home-cards">
            {abertos.map((c) => {
              const Icon = c.icon;
              const conteudo = (
                <>
                  <span className={`home-card-icon tone-${c.tone}`}>
                    <Icon size={26} />
                  </span>
                  <h3>{c.title}</h3>
                  <p>{c.desc}</p>
                  <span className="home-card-cta">
                    {c.acao ? 'Escolher' : 'Acessar'} <ArrowRight size={15} />
                  </span>
                </>
              );
              // Card que ABRE um popup em vez de navegar. Botão, e não link:
              // não há para onde ir até a escolha ser feita.
              if (c.acao) {
                return (
                  <button key={c.title} type="button" className="home-card" onClick={c.acao} aria-haspopup="dialog">
                    {conteudo}
                  </button>
                );
              }
              return (
                <Link key={c.title} to={c.to} className="home-card">
                  {conteudo}
                </Link>
              );
            })}
          </div>

          {travados.length > 0 && (
            <div className="home-travados">
              Também no portal:
              {travados.map((c) => {
                // Dois motivos de travar, duas mensagens: "Em breve" é o módulo
                // que ainda não abriu para ninguém; "Sem acesso" é permissão
                // que falta a esta pessoa.
                const Trava = c.emBreve ? Hourglass : Lock;
                return (
                  <span
                    key={c.title}
                    className="home-travado"
                    title={c.emBreve ? 'Este módulo ainda está em construção' : 'Você não tem acesso a este módulo'}
                  >
                    <Trava size={13} aria-hidden="true" /> {c.title} <em>{c.emBreve ? 'em breve' : 'sem acesso'}</em>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <aside className="home-rail" aria-label="Pessoas">
          <AniversariantesMes />
        </aside>
      </main>

      <footer className="home-footer">
        PHD Engenharia
        {' · '}
        <Link to="/privacidade">Aviso de Privacidade</Link>
      </footer>

      {solucoesAbertas && <SolucoesModal onClose={() => setSolucoesAbertas(false)} />}
      {programasAbertos && <ProgramasModal onClose={() => setProgramasAbertos(false)} />}
      {financeiroAberto && <FinanceiroModal onClose={() => setFinanceiroAberto(false)} />}
      {horasAberto && <HorasModal onClose={() => setHorasAberto(false)} />}
      {admAberto && <AdministrativoModal areas={areasAdm} onClose={() => setAdmAberto(false)} />}
      {gpAberto && <GestaoPessoasModal onClose={() => setGpAberto(false)} />}
      {novidades && (
        <NovidadesModal
          novidades={novidades.itens}
          historico={novidades.historico}
          onClose={fecharNovidades}
        />
      )}
    </div>
  );
}
