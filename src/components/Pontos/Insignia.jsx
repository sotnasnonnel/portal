import botina from '../../assets/pontos-botina.png';
import { IMG } from '../../config/pontosImagens';

// Arte do medalhão de cada título (a placa esmaltada, o esmalte de cada um
// e as poucas animações estão em styles/pontos.css, na classe pts-ins-<id>).
const ARTE = {
  't-botina': <img src={botina} alt="" />,
  't-home': <img src={IMG.casa} alt="" />,
  't-crono': <><i /><i /><i /></>,
  't-cafe': <img src={IMG.cafe} alt="" />,
  't-excel': <><img className="pts-ins-coroa" src={IMG.coroa} alt="" /><b>X</b></>,
  't-ia': <><img src={IMG.robo} alt="" /><span className="pts-digitando"><i /><i /><i /></span></>,
  't-presente': Array.from({ length: 12 }, (_, i) => <i key={i} />),
  't-livre': <img src={IMG.lapis} alt="" />,
};

/**
 * Insígnia de um título. `texto` só vale para o título personalizado.
 * `mini` é a versão de uma linha, para listas e recados.
 */
export default function Insignia({ id, nome, texto, mini = false }) {
  if (!id || !ARTE[id]) return null;
  return (
    <span className={`pts-ins pts-ins-${id}${mini ? ' is-mini' : ''}`}>
      <span className="pts-ins-art" aria-hidden="true">{ARTE[id]}</span>
      <span className="pts-ins-txt">{id === 't-livre' ? (texto || nome) : nome}</span>
    </span>
  );
}

