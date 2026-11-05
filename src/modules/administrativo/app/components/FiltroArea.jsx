import { useId } from 'react';
import { AREAS_INDICADORES } from '../../lib/indicadores';

// Total / ADM / TI — o mesmo recorte em Indicadores e em Satisfação. Fica num
// lugar só porque as duas telas precisam dizer a mesma coisa do mesmo jeito: se
// o texto de uma mudar sozinho, a régua parece diferente quando não é.
export default function FiltroArea({ valor, onChange }) {
  const id = useId();
  return (
    <div className="adm-area" role="group" aria-labelledby={id}>
      <span className="adm-area-rot" id={id}>Área</span>
      {AREAS_INDICADORES.map((a) => (
        <button
          key={a.chave}
          type="button"
          className={`adm-chip ${valor === a.chave ? 'is-on' : ''}`}
          aria-pressed={valor === a.chave}
          onClick={() => onChange(a.chave)}
        >
          {a.label}
        </button>
      ))}
      <span className="adm-campo-dica adm-area-dica">
        TI são os sete serviços de Manutenção &amp; Instalação TI; ADM é o restante.
      </span>
    </div>
  );
}
