import { Loader2 } from 'lucide-react';
import { semaforoPrazo } from '../../lib/painel';
import { descreverPrazo } from '../../lib/prazoTexto';
import { STATUS_LABEL } from '../../lib/statusChamado';
import { formatarDataHora } from '../../../../utils/formatters';

// Peças de tela que se repetem em todas as abas do Atendimento. Antes cada
// página escrevia a sua, e os estados de "vazio" e "carregando" acabavam
// diferentes de uma aba para a outra.

/** Título da página com, à direita, a ação principal dela. */
export function CabecalhoPagina({ Icon, titulo, subtitulo, acao }) {
  return (
    <header className="adm-page-cab">
      <div className="adm-page-cab-txt">
        <h1 className="adm-title">{Icon && <Icon size={24} aria-hidden="true" />} {titulo}</h1>
        {subtitulo && <p className="adm-sub">{subtitulo}</p>}
      </div>
      {acao && <div className="adm-page-cab-acao">{acao}</div>}
    </header>
  );
}

/** Abas de uma lista. `contagem` é opcional e só aparece quando vem número. */
export function Abas({ itens, valor, onChange, rotulo }) {
  return (
    <div className="adm-tabs" role="tablist" aria-label={rotulo}>
      {itens.map(({ valor: v, rotulo: r, Icon, contagem }) => (
        <button
          key={v} type="button" role="tab" aria-selected={valor === v}
          className={`adm-tab ${valor === v ? 'is-active' : ''}`}
          onClick={() => onChange(v)}
        >
          {Icon && <Icon size={15} aria-hidden="true" />} {r}
          {typeof contagem === 'number' && <span className="adm-tab-cont">{contagem}</span>}
        </button>
      ))}
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`adm-badge tom-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

/**
 * Prazo em palavras ("Vence amanhã às 09:05"), com a data exata no `title`.
 * Encerrado não pinta: é a mesma régua do indicador "Vencidos agora", e sem ela
 * uma lista com encerrados nasceria cheia de vermelho que ninguém deve atender.
 * `agora` vem de quem usa: a lista inteira compara com o mesmo instante.
 */
export function PrazoSla({ venceEm, encerrado = false, agora }) {
  if (!venceEm) return <span className="adm-prazo-txt tom-sem-prazo">Sem prazo</span>;
  const exata = formatarDataHora(venceEm, '');
  if (encerrado) return <span className="adm-prazo-txt tom-sem-prazo">{exata}</span>;
  return (
    <span className={`adm-prazo-txt tom-${semaforoPrazo(venceEm, agora)}`} title={exata}>
      {descreverPrazo(venceEm, agora)}
    </span>
  );
}

/**
 * Estado vazio: diz o que aconteceu e, quando faz sentido, o próximo passo.
 * `tom="ok"` é para o vazio que é boa notícia (nada pendente para aprovar).
 */
export function Vazio({ Icon, titulo, children, acao, tom }) {
  return (
    <div className={`adm-vazio ${tom === 'ok' ? 'is-ok' : ''}`}>
      {Icon && <span className="adm-vazio-ico"><Icon size={22} aria-hidden="true" /></span>}
      {titulo && <strong className="adm-vazio-tit">{titulo}</strong>}
      {children && <p className="adm-vazio-txt">{children}</p>}
      {acao && <div className="adm-vazio-acao">{acao}</div>}
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }) {
  return (
    <div className="adm-vazio" role="status">
      <Loader2 size={20} className="adm-spin" aria-hidden="true" /> {texto}
    </div>
  );
}
