import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { AWARDS_CRITERIOS } from '../../../../config/programas';
import { salvarNotas } from '../../lib/awards';
import { notaDaComissao } from '../../lib/awardsRegras';
import { Casca } from '../components/Detalhe';

const formatar = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * A nota de consenso da comissão para um projeto: de 0 a 10 em cada critério.
 * Uma nota só por projeto (decisão do Lucas): quem salvar por último vale.
 */
export default function AvaliarProjeto({ projeto, notas, colaboradorId, onSalvo, onFechar }) {
  const [valores, setValores] = useState(() => Object.fromEntries(
    AWARDS_CRITERIOS.map((c) => [c.chave, notas?.[c.chave] ?? '']),
  ));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !salvando) onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar, salvando]);

  const numeros = Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v === '' ? null : Number(v)]));
  const invalido = Object.values(numeros).some((n) => n == null || Number.isNaN(n) || n < 0 || n > 10);
  const previa = invalido ? null : notaDaComissao(numeros);

  const salvar = async () => {
    if (invalido) { setErro('Dê uma nota de 0 a 10 em todos os critérios.'); return; }
    setSalvando(true);
    setErro('');
    try {
      await salvarNotas(projeto.id, numeros, colaboradorId);
      onSalvo(projeto.id, numeros);
      onFechar();
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  return (
    <Casca
      titulo={`Avaliar · ${projeto.codigo_setor}`}
      onFechar={() => !salvando && onFechar()}
      acoes={(
        <>
          <button type="button" className="pg-btn pg-btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="button" className="pg-btn pg-btn-primary" onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 size={15} className="pg-spin" />} Salvar nota
          </button>
        </>
      )}
    >
      <p className="pg-aw-dica">
        Nota de consenso da comissão, de 0 a 10 em cada critério. Ela vale 30% da nota final; a votação vale 70%.
      </p>
      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {AWARDS_CRITERIOS.map((c) => (
        <div className="pg-campo" key={c.chave}>
          <label htmlFor={`nota-${c.chave}`}>
            {c.label}{c.peso && c.peso !== 1 ? <span className="opc">(peso {c.peso})</span> : null}
          </label>
          {c.desc && <p className="pg-campo-dica" style={{ margin: 0 }}>{c.desc}</p>}
          <input
            id={`nota-${c.chave}`} type="number" inputMode="decimal" min="0" max="10" step="0.5"
            className="pg-input pg-aw-nota" value={valores[c.chave]}
            onChange={(e) => setValores((a) => ({ ...a, [c.chave]: e.target.value }))}
          />
        </div>
      ))}

      <p className="pg-aw-dica" style={{ marginTop: 12 }}>
        Nota da comissão: <strong>{previa == null ? '—' : formatar(previa)}</strong> de 100.
      </p>
    </Casca>
  );
}
