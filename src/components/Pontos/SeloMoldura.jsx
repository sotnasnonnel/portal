import { SELO_MOLDURA } from '../../config/pontos';
import { IMG } from '../../config/pontosImagens';

/** Selo da moldura (capacete, coroa...): sobre a cabeça ou no canto, fora do rosto. */
export default function SeloMoldura({ moldura }) {
  const selo = SELO_MOLDURA[moldura];
  if (!selo) return null;
  return <img className={`pts-selo is-${selo.pos}`} src={IMG[selo.img]} alt="" aria-hidden="true" />;
}
