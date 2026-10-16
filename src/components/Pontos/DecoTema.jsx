import { IMG } from '../../config/pontosImagens';

// Decoração dos temas sazonais, por cima do portal inteiro (sem receber
// clique). O Halloween não usa esta camada: a cena da noite é o próprio fundo
// da Home (styles/pontos.css), atrás do conteúdo. Tudo parado, de propósito: enfeite, e não animação passando na
// frente do trabalho. Os temas sem decoração não montam nada.
const MEIAS = [
  // Espalhadas no meio da tela, onde o topo não tem botão; o laço fica entre
  // a segunda e a terceira.
  { left: '27%', fio: 16, cor: 'meiaVermelha', giro: -4 },
  { left: '36%', fio: 28, cor: 'meiaVerde', giro: 3 },
  { left: '58%', fio: 20, cor: 'meiaVermelha', giro: -2 },
  { left: '67%', fio: 32, cor: 'meiaVerde', giro: 4 },
];

// Varal do Outubro Rosa / Novembro Azul: no meio da tela, longe dos botões.
const PENDURADOS = [
  { left: '26%', fio: 14, giro: -4 },
  { left: '34%', fio: 26, giro: 3 },
  { left: '42%', fio: 18, giro: -2 },
  { left: '50%', fio: 30, giro: 4 },
  { left: '58%', fio: 16, giro: -3 },
  { left: '66%', fio: 24, giro: 2 },
];

export default function DecoTema({ tema }) {
  if (tema === 'natal') {
    return (
      <div className="pts-deco pts-deco-natal" aria-hidden="true">
        <div className="festao" style={{ backgroundImage: `url(${JSON.stringify(IMG.festao)})` }} />
        {MEIAS.map((m) => (
          <span key={m.left} className="meia" style={{ left: m.left, transform: `rotate(${m.giro}deg)` }}>
            <i style={{ height: m.fio }} />
            <img src={IMG[m.cor]} alt="" />
          </span>
        ))}
        <img className="laco" src={IMG.fita} alt="" />
        <div className="bengala" />
      </div>
    );
  }

  if (tema === 'outubro-rosa' || tema === 'novembro-azul') {
    const laco = tema === 'outubro-rosa' ? IMG.lacoRosa : IMG.lacoAzul;
    return (
      <div className="pts-deco pts-deco-campanha" aria-hidden="true">
        <div className="varal" />
        {PENDURADOS.map((p, i) => (
          <span key={p.left} className="pendurado" style={{ left: p.left, transform: `rotate(${p.giro}deg)` }}>
            <i style={{ height: p.fio }} />
            {/* No Novembro Azul, laço e bigode se alternam no varal. */}
            {tema === 'novembro-azul' && i % 2 === 1
              ? <img className="bigode" src={IMG.bigode} alt="" />
              : <img src={laco} alt="" />}
          </span>
        ))}
        <div className="faixa" />
      </div>
    );
  }

  return null;
}
