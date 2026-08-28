import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronsLeft, ChevronsRight, Home, Lock, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AvatarUsuario from '../UI/AvatarUsuario';
import './ModuleSidebar.css';

// Sidebar única dos módulos do portal (Controle de Horas, Administrativo,
// Financeiro, Programas, PMO/Solicitações). Antes cada módulo tinha a sua cópia,
// e elas foram divergindo — o padrão adotado é o do Financeiro: menu DIVIDIDO
// em grupos colapsáveis (cabeçalho com ícone + seta, filhos recuados) e seções
// simples com rótulo em caixa alta.
//
// O acento fica por conta do módulo: cada raiz (.horasRoot, .finRoot, ...)
// define --mod-accent / --mod-accent-soft / --mod-accent-ink. Aqui não entra
// nenhuma cor de módulo.
//
// Formato de `secoes`:
//   [{ label, key?, group?, Icon?, locked?, items: [
//        { label, href, Icon, exato?, badge?, locked? } ] }]
//   - group: true  -> grupo colapsável (precisa de `key` e `Icon`)
//   - sem group    -> rótulo de seção + links diretos
//   - exato        -> item que é prefixo de outro (só acende na rota exata)
//   - locked       -> item/grupo "em breve": cadeado, sem navegar nem expandir
//   - badge        -> contador; num grupo fechado, soma a dos filhos

// Marca da PHD no topo da sidebar. O PNG do wordmark (assets/logo-phd.png) é
// branco, para fundo escuro; aqui a sidebar é branca, então ele entra como
// MÁSCARA CSS e a cor vem do background — ver .modSb-marca no CSS.

function iniciais(nome, email) {
  const base = (nome || email || '').trim();
  if (!base) return '?';
  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export default function ModuleSidebar({
  // moduloKey/titulo/Icon/logo continuam sendo passados pelos módulos, mas o
  // topo agora é só a marca da PHD — quem identifica o módulo é o conteúdo.
  secoes = [],
  papelLabel = '',
  aberto = false,
  onFechar,
  collapsed = false,
  onToggleCollapse,
  onLogout,
}) {
  const pathname = useLocation().pathname || '';
  const { logout, user } = useAuth();
  const nome = user?.nome || '';
  const email = user?.email || '';
  const [gruposAbertos, setGruposAbertos] = useState({});

  // Item ativo = o href mais LONGO que casa com a rota. Com "/reembolsos" e
  // "/reembolsos/dashboard" no mesmo menu, o prefixo simples acendia os dois.
  // `exato` cobre o caso do item que é prefixo de outro (/horas/config).
  const hrefAtivo = secoes
    .flatMap((sec) => sec.items || [])
    .filter((i) => i.href && (i.exato ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`)))
    .map((i) => i.href)
    .sort((a, b) => b.length - a.length)[0] || null;

  // Esc fecha o drawer. Fechar ao navegar sai do onClick de cada link (toda
  // navegação daqui passa por um <Link>), evitando um efeito por troca de rota.
  useEffect(() => {
    if (!aberto) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onFechar?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onFechar]);

  const alternarGrupo = (key, atual) => setGruposAbertos((p) => ({ ...p, [key]: !atual }));
  const sair = onLogout || logout;

  const renderItem = (item, isSub = false) => {
    const classes = `modSb-link ${isSub ? 'modSb-sublink' : ''}`;
    if (item.locked) {
      return (
        <div key={item.href || item.label} className={`${classes} is-locked`} aria-disabled="true" title="Em breve">
          <item.Icon size={16} />
          <span>{item.label}</span>
          <Lock className="modSb-lock" size={14} />
        </div>
      );
    }
    return (
      <Link
        key={item.href}
        to={item.href}
        title={item.label}
        className={`${classes} ${item.href === hrefAtivo ? 'is-active' : ''}`}
        onClick={onFechar}
      >
        <item.Icon size={16} />
        <span>{item.label}</span>
        {item.badge > 0 && <span className="modSb-badge">{item.badge}</span>}
      </Link>
    );
  };

  return (
    <>
      {/* Escurece o conteúdo atrás do drawer; só existe no mobile (CSS). */}
      <div
        className={`modSb-overlay ${aberto ? 'is-visible' : ''}`}
        onClick={onFechar}
        aria-hidden="true"
      />

      <aside className={`modSb ${aberto ? 'is-open' : ''} ${collapsed ? 'isCollapsed' : ''}`}>
        <div className="modSb-head">
          <Link
            to="/home"
            className="modSb-brand"
            title="Voltar ao início"
            aria-label="PHD Engenharia — voltar ao início"
            onClick={onFechar}
          >
            <span className="modSb-marca" role="img" aria-label="PHD Engenharia" />
          </Link>
          {onToggleCollapse && (
            <button
              type="button"
              className="modSb-collapse"
              onClick={onToggleCollapse}
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            </button>
          )}
        </div>

        <nav className="modSb-nav">
          <Link to="/home" className="modSb-link modSb-modulos" onClick={onFechar} title="Módulos">
            <Home size={16} />
            <span>Módulos</span>
          </Link>
          {secoes.map((sec) => {
            if (!sec.group) {
              return (
                <div key={sec.key || sec.label} className="modSb-sec">
                  <div className="modSb-seclabel">{sec.label}</div>
                  {(sec.items || []).map((item) => renderItem(item))}
                </div>
              );
            }
            // Grupo travado: só o cabeçalho com cadeado, sem expandir.
            if (sec.locked) {
              return (
                <div key={sec.key} className="modSb-group">
                  <div className="modSb-link modSb-group-header is-locked" aria-disabled="true" title="Em breve">
                    <sec.Icon size={16} />
                    <span>{sec.label}</span>
                    <Lock className="modSb-lock" size={14} />
                  </div>
                </div>
              );
            }
            // Os grupos abrem por padrão e só fecham por clique no cabeçalho:
            // com "auto-abre na rota ativa", navegar para um irmão fechava o
            // grupo sozinho e o menu parecia sumir.
            const expandido = gruposAbertos[sec.key] ?? true;
            // Fechado, o grupo carrega a soma das pendências dos filhos — senão
            // o contador desaparecia junto com os itens.
            const badgeGrupo = (sec.items || []).reduce((soma, i) => soma + (i.badge || 0), 0);
            return (
              <div key={sec.key} className="modSb-group">
                <button
                  type="button"
                  className={`modSb-link modSb-group-header ${expandido ? 'expanded' : ''}`}
                  onClick={() => alternarGrupo(sec.key, expandido)}
                  aria-expanded={expandido}
                >
                  <sec.Icon size={16} />
                  <span>{sec.label}</span>
                  {!expandido && badgeGrupo > 0 && <span className="modSb-badge">{badgeGrupo}</span>}
                  <ChevronDown className="modSb-chevron" size={16} />
                </button>
                {expandido && (
                  <div className="modSb-group-children">
                    {(sec.items || []).map((item) => renderItem(item, true))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="modSb-footer">
          <AvatarUsuario className="modSb-avatar" iniciais={iniciais(nome, email)} />
          <div className="modSb-userinfo">
            <strong title={nome || email}>{nome || 'Usuário'}</strong>
            <span>{papelLabel}</span>
          </div>
          <button className="modSb-logout" onClick={sair} title="Sair" type="button">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
