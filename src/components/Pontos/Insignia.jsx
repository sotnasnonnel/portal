import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import botina from '../../assets/pontos-botina.png';
import { FRASE_TITULO } from '../../config/pontos';
import { IMG } from '../../config/pontosImagens';

// Arte do medalhão de cada título (a placa esmaltada, o esmalte de cada um
// e as poucas animações estão em styles/pontos.css, na classe pts-ins-<id>).
const ARTE = {
  't-botina': <img src={botina} alt="" />,
  't-home': <img src={IMG.casa} alt="" />,
  't-crono': <><i /><i /><i /></>,
  't-cafe': <img src={IMG.cafe} alt="" />,
  't-monster': <img src={IMG.monster} alt="" />,
  't-equino': <img src={IMG.cavalo} alt="" />,
  't-excel': <><img className="pts-ins-coroa" src={IMG.coroa} alt="" /><b>X</b></>,
  't-ia': <><img src={IMG.robo} alt="" /><span className="pts-digitando"><i /><i /><i /></span></>,
  't-presente': Array.from({ length: 12 }, (_, i) => <i key={i} />),
  't-livre': <img src={IMG.lapis} alt="" />,
  // Engenharia, planejamento e gestão
  't-domador': <img src={IMG.calendario} alt="" />,
  't-caminho-critico': <img src={IMG.cronometro} alt="" />,
  't-pull-planning': <img src={IMG.bloco} alt="" />,
  't-restricoes': <img src={IMG.lupa} alt="" />,
  't-linha-base': <img src={IMG.escudo} alt="" />,
  't-replan': <><img className="pts-ins-coroa" src={IMG.coroa} alt="" /><img src={IMG.replan} alt="" /></>,
  't-power-bi': <img src={IMG.barras} alt="" />,
  't-curva-s': <img src={IMG.curva} alt="" />,
  't-ppc': <img src={IMG.check} alt="" />,
  't-monte-carlo': <img src={IMG.bolaCristal} alt="" />,
  // Humor corporativo e cotidiano da PHD
  't-clt-premium': <img src={IMG.dinheiro} alt="" />,
  't-reuniao': <img src={IMG.reuniao} alt="" />,
  't-teams': <img src={IMG.notebook} alt="" />,
  't-incendios': <img src={IMG.extintor} alt="" />,
  't-deixa-comigo': <img src={IMG.biceps} alt="" />,
  't-cafe-desespero': <img src={IMG.suando} alt="" />,
  't-sextou': <img src={IMG.cansado} alt="" />,
  't-ultimo': <img src={IMG.lua} alt="" />,
  't-diretoria': <img src={IMG.gravata} alt="" />,
  't-ctrl-cv': <img src={IMG.teclado} alt="" />,
  // Campo, obras e engenharia raiz
  't-raiz': <img src={IMG.obra} alt="" />,
  't-botina-ouro': <img src={botina} alt="" />,
  't-churrasqueira': <img src={IMG.carne} alt="" />,
  't-rdo': <img src={IMG.memo} alt="" />,
  't-desvios': <img src={IMG.alerta} alt="" />,
  't-capacete': <img src={IMG.capacete} alt="" />,
  't-prancheta': <img src={IMG.prancheta} alt="" />,
  't-parada': <img src={IMG.espadas} alt="" />,
  // Personalidade e comportamento
  't-resolvedor': <img src={IMG.ferramentas} alt="" />,
  't-caos': <img src={IMG.tornado} alt="" />,
  't-lenda': <img src={IMG.trofeu} alt="" />,
  't-memes': <img src={IMG.rindo} alt="" />,
  't-prazo': <img src={IMG.despertador} alt="" />,
  't-multitarefas': <img src={IMG.polvo} alt="" />,
  't-excelencia': <img src={IMG.medalha} alt="" />,
  't-fora-curva': <img src={IMG.foguete} alt="" />,
};

/**
 * Dica da insígnia mini: nome e frase, acima dela (abaixo, se estiver colada
 * no topo da tela). Vai para o <body> para nenhuma caixa com overflow cortar.
 */
function Dica({ caixa, nome, frase }) {
  const embaixo = caixa.top < 80;
  const x = Math.min(Math.max(caixa.left + caixa.width / 2, 130), window.innerWidth - 130);
  return createPortal(
    <span className={`pts-ins-dica ${embaixo ? 'is-embaixo' : ''}`} role="tooltip"
      style={{ left: x, top: embaixo ? caixa.bottom + 8 : caixa.top - 8 }}>
      {nome && <b>{nome}</b>}
      {frase}
    </span>,
    document.body,
  );
}

/**
 * Insígnia de um título. `texto` só vale para o título personalizado.
 * `mini` é a versão de uma linha, para listas e recados: a frase do título
 * aparece ao passar o mouse. Na grande, a frase vai embaixo do nome, menos
 * com `frase={false}` (a vitrine, que já mostra a descrição no card).
 */
export default function Insignia({ id, nome, texto, mini = false, frase = true }) {
  const [caixa, setCaixa] = useState(null);
  // Rolar a página tira a dica (ela fica presa na tela, não acompanha).
  useEffect(() => {
    if (!caixa) return undefined;
    const fechar = () => setCaixa(null);
    window.addEventListener('scroll', fechar, true);
    return () => window.removeEventListener('scroll', fechar, true);
  }, [caixa]);

  if (!id || !ARTE[id]) return null;
  const txtFrase = frase ? FRASE_TITULO[id] : null;
  const comDica = mini && txtFrase
    ? { onMouseEnter: (e) => setCaixa(e.currentTarget.getBoundingClientRect()), onMouseLeave: () => setCaixa(null) }
    : {};
  return (
    <span className={`pts-ins pts-ins-${id}${mini ? ' is-mini' : ''}`} {...comDica}>
      <span className="pts-ins-art" aria-hidden="true">{ARTE[id]}</span>
      <span className="pts-ins-txt">
        {id === 't-livre' ? (texto || nome) : nome}
        {txtFrase && !mini && <small className="pts-ins-frase">{txtFrase}</small>}
      </span>
      {caixa && <Dica caixa={caixa} nome={nome} frase={txtFrase} />}
    </span>
  );
}
