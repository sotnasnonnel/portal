import { useState } from 'react';
import { classeMoldura, NOME_TITULO } from '../../config/pontos';
import Insignia from '../../components/Pontos/Insignia';
import SeloMoldura from '../../components/Pontos/SeloMoldura';
import { cargo, iniciais, nomeProprio } from '../../utils/pessoas';
import { useFotoFeed } from './fotosFeedCtx';

/**
 * Bolinha de uma pessoa no feed: a foto do hub/Microsoft 365 quando há, senão
 * as iniciais — sempre com a moldura da Personalização.
 */
export function AvatarFeed({ id, nome, moldura, className = '' }) {
  const foto = useFotoFeed(id);
  // Link vencido ou fora do ar cai nas iniciais, em vez de ícone quebrado.
  const [falhou, setFalhou] = useState(null);
  const mostrar = foto && falhou !== foto;
  return (
    <span className={`feed-av ${className} ${classeMoldura(moldura)}`} aria-hidden="true">
      {mostrar ? <img src={foto} alt="" onError={() => setFalhou(foto)} /> : iniciais(nome)}
      <SeloMoldura moldura={moldura} />
    </span>
  );
}

/** Quem escreveu: foto com moldura, nome, título e a linha de baixo. */
export default function Autor({ id, nome, funcao, moldura, titulo, quando, pequeno = false, extra = null }) {
  return (
    <div className={`feed-autor ${pequeno ? 'is-pequeno' : ''}`}>
      <AvatarFeed id={id} nome={nome} moldura={moldura} />
      <div className="feed-autor-txt">
        <b>{nomeProprio(nome)}</b>
        {titulo && NOME_TITULO[titulo] && <Insignia id={titulo} nome={NOME_TITULO[titulo]} mini />}
        <span className="feed-autor-sub">
          {[!pequeno && funcao && cargo(funcao), quando].filter(Boolean).join(' · ')}
          {extra}
        </span>
      </div>
    </div>
  );
}
