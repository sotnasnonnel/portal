import { Link } from 'react-router-dom';
import { Lightbulb } from 'lucide-react';
import { FORMAS } from '../../../../../config/programas';

/**
 * Campo de Ideias — item 1 da planilha: os dois cards, Ideia e Iniciativa.
 * Cada um leva ao seu formulário (itens 2 e 3). O painel é o item 4, que tem
 * entrada própria no menu ("Dashboard").
 *
 * A diferença entre os dois é a primeira dúvida de quem chega ("já comecei a
 * fazer, isso ainda é ideia?"), então ela vem escrita nos cards em vez de
 * virar um seletor dentro do formulário.
 */
export default function EscolherForma() {
  return (
    <div className="pg-page">
      <h1 className="pg-title"><Lightbulb size={24} /> Campo de Ideias</h1>
      <p className="pg-sub">O que você quer registrar?</p>

      <div className="pg-escolha">
        {FORMAS.map((f) => {
          const Icon = f.icon;
          return (
            <Link key={f.slug} to={`/programas/ideias/nova/${f.slug}`} className="pg-prog">
              <span className="pg-prog-ico"><Icon size={24} /></span>
              <h2>{f.label}</h2>
              <p>{f.desc}</p>
              <small>{f.ajuda}</small>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
