import { Trophy } from 'lucide-react';
import { AWARDS_CATEGORIAS } from '../../../../config/programas';

/** O pódio de cada categoria, com quem cadastrou e quem participou (pedido do Lucas). */
export default function Vencedores({ podio, projetos, onVer }) {
  const porId = new Map(projetos.map((p) => [p.id, p]));

  return AWARDS_CATEGORIAS.map((c) => {
    const lugares = (podio[c.valor] || []).map((id) => porId.get(id)).filter(Boolean);
    return (
      <section className="pg-card" key={c.valor}>
        <h2 className="pg-card-tit pg-aw-tit"><Trophy size={14} /> {c.label}</h2>
        {lugares.length === 0 ? (
          <p className="pg-aw-dica">Sem vencedores nesta categoria.</p>
        ) : (
          <ol className="pg-aw-podio">
            {lugares.map((p, i) => (
              <li key={p.id} className={i === 0 ? 'is-primeiro' : ''}>
                <span className="pg-roi-pos">{i + 1}º</span>
                <div>
                  <button type="button" className="pg-link pg-aw-podio-tit" onClick={() => onVer(p)}>
                    {p.codigo_setor}
                  </button>
                  <span>Cadastrado por {p.autorNome || '—'}</span>
                  <span>Participantes: {p.participantes}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  });
}
