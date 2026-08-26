import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { PROGRAMAS } from '../../../../config/programas';

export default function InicioProgramas() {
  return (
    <div className="pg-page">
      <h1 className="pg-title"><Sparkles size={24} /> Programas</h1>
      <p className="pg-sub">
        Os programas internos da PHD. Escolha por onde quer começar.
      </p>

      <div className="pg-prog-grid">
        {PROGRAMAS.map((p) => {
          const Icon = p.icon;
          return (
            <Link key={p.slug} to={p.href} className="pg-prog">
              <span className="pg-prog-ico"><Icon size={24} /></span>
              <h2>{p.label}</h2>
              <p>{p.desc}</p>
              <span className="pg-prog-cta">{p.cta} <ArrowRight size={15} /></span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
