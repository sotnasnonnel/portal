import { Fragment } from 'react';
import { pedacosFormatados, tamanhoManchete } from '../../config/avisos';
import cartaoSino from '../../assets/avisos/cartao-sino.svg';
import balao from '../../assets/avisos/balao.svg';
import logoPhd from '../../assets/avisos/phd-branco.png';
import './Avisos.css';

/**
 * Banner do aviso no padrão do "TEMPLATE MANCHETE COMUNICAÇÃO INTERNA.pptx":
 * fundo (laranja, azul ou foto), o cartão claro com o sino no recorte, o
 * quadrado com o balão e o logo PHD, e a manchete em Montserrat.
 *
 * É HTML, não imagem: a pessoa só escreve a manchete e o portal desenha. As
 * posições vêm do slide (16:9) em porcentagem, e as letras em `cqw` — o banner
 * fica igual em qualquer largura, do card da Home à página do aviso.
 *
 * Os slides trocam as cores entre si: no fundo laranja o quadrado é azul e o
 * selo é laranja; no azul, o contrário. Na foto vale o do SharePoint
 * (quadrado laranja, selo azul).
 */
export default function BannerAviso({ manchete = '', subtitulo = '', fundo = 'laranja', fotoUrl = null, className = '' }) {
  const linhas = pedacosFormatados(manchete || 'Escreva a manchete do aviso');
  return (
    <div
      className={`aviso-banner is-${fundo} ${className}`}
      style={fundo === 'foto' && fotoUrl ? { backgroundImage: `url("${fotoUrl}")` } : undefined}
      role="img"
      aria-label={manchete}
    >
      <img className="aviso-banner-cartao" src={cartaoSino} alt="" draggable="false" />
      <div className="aviso-banner-quadro" aria-hidden="true">
        <img className="aviso-banner-balao" src={balao} alt="" draggable="false" />
        <img className="aviso-banner-logo" src={logoPhd} alt="" draggable="false" />
        <span className="aviso-banner-selo">1</span>
      </div>
      <div className="aviso-banner-textos" aria-hidden="true">
        <p className={`aviso-banner-manchete is-${tamanhoManchete(manchete)}`}>
          {linhas.map((p, i) => {
            const conteudo = p.link || p.texto;
            if (p.negrito && p.italico) return <b key={i}><i>{conteudo}</i></b>;
            if (p.negrito) return <b key={i}>{conteudo}</b>;
            if (p.italico) return <i key={i}>{conteudo}</i>;
            return <Fragment key={i}>{conteudo}</Fragment>;
          })}
        </p>
        {subtitulo && <p className="aviso-banner-sub">{subtitulo}</p>}
      </div>
    </div>
  );
}
