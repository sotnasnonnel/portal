import { useState } from 'react';
import { Heart } from 'lucide-react';
import { classeMoldura, classesRecado, ICONES_PARABENS, NOME_TITULO } from '../../config/pontos';
import { IMG } from '../../config/pontosImagens';
import { iniciais, nomeProprio } from '../../utils/pessoas';
import './RecadoMural.css';
import Insignia from './Insignia';
import SeloMoldura from './SeloMoldura';

/**
 * Um recado do mural de parabéns, com a foto, a moldura, o título e os enfeites
 * de quem escreveu. `tituloTexto` só vale para o título personalizado.
 *
 * `curtido` e `resposta` são a reação do aniversariante àquele recado (ver
 * supabase_migration_parabens_curtir_responder.sql); `respostaNome` é quem
 * responde, para o bloco se apresentar ("Você respondeu", "Paulo respondeu").
 * Quem escreveu o recado só lê: os botões vêm de fora, em `rodape`.
 */
export default function RecadoMural({ nome, texto, moldura, mural = [], icones = [], meu = false, foto = null, titulo = null, tituloTexto = null, rodape = null, curtido = false, resposta = null, respostaNome = null }) {
  // Link de foto vencido ou fora do ar não deixa um ícone quebrado no lugar do
  // rosto: cai nas iniciais, como a lista de aniversariantes da Home.
  const [semFoto, setSemFoto] = useState(false);
  return (
    <span className={`rec-mural ${meu ? 'is-meu' : ''} ${classesRecado(mural)}`}>
      <span className={`rec-mural-av ${classeMoldura(moldura)}`}>
        {foto && !semFoto ? <img src={foto} alt="" onError={() => setSemFoto(true)} /> : iniciais(nome)}
        <SeloMoldura moldura={moldura} />
      </span>
      <span className="rec-mural-corpo">
        <b>{nomeProprio(nome)}{meu && <small> · você</small>}</b>
        {titulo && (
          <span className="rec-mural-titulo">
            <Insignia id={titulo} nome={NOME_TITULO[titulo]} texto={tituloTexto} mini />
          </span>
        )}
        <span className="pts-rec-texto">{texto}</span>
        {icones?.length > 0 && (
          <span className="rec-mural-icones">
            {icones.map((id) => {
              const ic = ICONES_PARABENS.find((i) => i.id === id);
              return ic ? <img key={id} src={IMG[ic.img]} alt={ic.nome} title={ic.nome} /> : null;
            })}
          </span>
        )}
        {curtido && (
          <span className="rec-mural-curtido">
            <Heart size={12} fill="currentColor" />
            {respostaNome ? `${respostaNome} curtiu seu recado` : 'Curtido'}
          </span>
        )}
        {resposta && (
          <span className="rec-mural-resposta">
            <b>{respostaNome ? `${respostaNome} respondeu` : 'Resposta'}</b>
            <span>{resposta}</span>
          </span>
        )}
        {rodape}
      </span>
    </span>
  );
}
