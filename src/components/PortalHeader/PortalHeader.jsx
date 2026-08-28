import { Menu, Calendar, HelpCircle } from "lucide-react";
import { GUIA_OPEN_EVENT } from "../Guia/guides";
import SinoNotificacoes from "../Notificacoes/SinoNotificacoes";
import "./PortalHeader.css";

// Barra superior compartilhada pelos 3 apps (padrão do Gestão de Pessoas):
// saudação + botão "?" que abre o guia do app + data.
//  - userName: nome do usuário logado
//  - onMenuToggle: opcional; quando passado, mostra o botão de menu (drawer mobile)
//  - acoes: opcional; botões do app entram à esquerda do "?". Fica vazio nos
//    apps que não passam nada, então a barra continua idêntica nos outros dois.
//
// O sino de notificações mora aqui (e não em cada app) porque a central é uma
// só: quem tem pedido em qualquer módulo vê o aviso de onde estiver.
export default function PortalHeader({ userName, onMenuToggle, upper = false, acoes = null }) {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  // Padrão nos 3 apps: só o primeiro nome. `upper` deixa em CAIXA ALTA (Solicitações).
  const primeiroNome = (userName || "").split(" ")[0];
  const displayName = upper ? primeiroNome.toUpperCase() : primeiroNome;

  return (
    <header className="portal-header">
      <div className="portal-header-left">
        {onMenuToggle ? (
          <button type="button" className="portal-header-menu" onClick={onMenuToggle} aria-label="Abrir menu">
            <Menu size={24} />
          </button>
        ) : null}
        <div className="portal-header-greeting">
          <span className="hello">Bem-vindo(a) de volta,</span>
          <span className="name">Olá, {displayName}! 🚀</span>
        </div>
      </div>

      <div className="portal-header-right">
        {acoes}
        <SinoNotificacoes />
        <button
          type="button"
          className="portal-header-help"
          onClick={() => window.dispatchEvent(new Event(GUIA_OPEN_EVENT))}
          aria-label="Ver o que você pode fazer"
          title="Ver o que você pode fazer"
        >
          <HelpCircle size={20} />
        </button>
        <div className="portal-header-date">
          <Calendar size={16} />
          <span>{hoje}</span>
        </div>
      </div>
    </header>
  );
}
