import { Menu, Calendar, HelpCircle, MessageSquarePlus } from "lucide-react";
import { GUIA_OPEN_EVENT } from "../Guia/guides";
import { FALE_CONOSCO_OPEN_EVENT, SLA_HORAS } from "../../config/suporte";
import SinoNotificacoes from "../Notificacoes/SinoNotificacoes";
import FaleConoscoModal from "../FaleConosco/FaleConoscoModal";
import { useCaixaFaleConosco } from "../FaleConosco/useCaixaFaleConosco";
import "./PortalHeader.css";

// Barra superior compartilhada pelos módulos: nome do MÓDULO em que se está +
// botão "?" que abre o guia do app + data.
//
// Antes trazia "Bem-vindo(a) de volta, Olá, Fulano!". A saudação era a mesma em
// todos os módulos e repetia um dado que o rodapé da sidebar já mostra; o que
// falta ali é saber ONDE se está — sobretudo agora que o topo da sidebar é a
// marca da PHD, e não mais o nome do módulo.
//  - modulo: nome do módulo (o que aparece na barra)
//  - onMenuToggle: opcional; quando passado, mostra o botão de menu (drawer mobile)
//  - acoes: opcional; botões do app entram à esquerda do "?". Fica vazio nos
//    apps que não passam nada, então a barra continua idêntica nos outros dois.
//
// O sino de notificações mora aqui (e não em cada app) porque a central é uma
// só: quem tem pedido em qualquer módulo vê o aviso de onde estiver. O "Fale
// conosco" segue a mesma lógica — bug e ideia aparecem no meio do trabalho, e
// um canal que só existe numa tela específica é um canal que ninguém usa. O
// modal vem junto do botão para nenhum app precisar montá-lo.
export default function PortalHeader({ modulo = '', onMenuToggle, acoes = null }) {
  // Só quem atende recebe número; para os demais o hook não consulta nada.
  const caixa = useCaixaFaleConosco();
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return (
    <header className="portal-header">
      <div className="portal-header-left">
        {onMenuToggle ? (
          <button type="button" className="portal-header-menu" onClick={onMenuToggle} aria-label="Abrir menu">
            <Menu size={24} />
          </button>
        ) : null}
        <div className="portal-header-greeting">
          <span className="name">{modulo}</span>
        </div>
      </div>

      <div className="portal-header-right">
        {acoes}
        <SinoNotificacoes />
        <button
          type="button"
          className="portal-header-help portal-header-fale"
          onClick={() => window.dispatchEvent(new Event(FALE_CONOSCO_OPEN_EVENT))}
          aria-label={
            caixa.abertos > 0
              ? `Fale conosco — ${caixa.abertos} esperando resposta`
              : "Fale conosco"
          }
          title={
            caixa.abertos > 0
              ? `Fale conosco — ${caixa.abertos} esperando resposta${caixa.atrasados > 0 ? `, ${caixa.atrasados} fora do prazo` : ""}`
              : `Fale conosco — bug, melhoria ou elogio (resposta em até ${SLA_HORAS}h)`
          }
        >
          <MessageSquarePlus size={20} />
          {/* O número só existe para quem atende. Vermelho quando algo já
              venceu: numa fila com prazo, "tem 3" e "3 estão atrasados" pedem
              reações diferentes. */}
          {caixa.abertos > 0 ? (
            <span className={`fc-badge${caixa.atrasados > 0 ? " is-late" : ""}`}>
              {caixa.abertos}
            </span>
          ) : null}
        </button>
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

      <FaleConoscoModal modulo={modulo} caixa={caixa} />
    </header>
  );
}
