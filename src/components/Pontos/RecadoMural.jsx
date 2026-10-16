import { classeMoldura, classesRecado, ICONES_PARABENS } from '../../config/pontos';
import { IMG } from '../../config/pontosImagens';
import { iniciais, nomeProprio } from '../../utils/pessoas';
import './RecadoMural.css';
import SeloMoldura from './SeloMoldura';

/** Um recado do mural de parabéns, com a moldura e os enfeites de quem escreveu. */
export default function RecadoMural({ nome, texto, moldura, mural = [], icones = [], meu = false, foto = null, rodape = null }) {
  return (
    <span className={`rec-mural ${meu ? 'is-meu' : ''} ${classesRecado(mural)}`}>
      <span className={`rec-mural-av ${classeMoldura(moldura)}`}>
        {foto ? <img src={foto} alt="" /> : iniciais(nome)}
        <SeloMoldura moldura={moldura} />
      </span>
      <span className="rec-mural-corpo">
        <b>{nomeProprio(nome)}{meu && <small> · você</small>}</b>
        <span className="pts-rec-texto">{texto}</span>
        {icones?.length > 0 && (
          <span className="rec-mural-icones">
            {icones.map((id) => {
              const ic = ICONES_PARABENS.find((i) => i.id === id);
              return ic ? <img key={id} src={IMG[ic.img]} alt={ic.nome} title={ic.nome} /> : null;
            })}
          </span>
        )}
        {rodape}
      </span>
    </span>
  );
}
