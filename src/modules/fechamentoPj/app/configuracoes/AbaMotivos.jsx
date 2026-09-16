import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Aviso } from '../components/ui';
import { normalizar } from '../../lib/formato';
import { useFormConfig } from './useFormConfig';
import BarraSalvar from './BarraSalvar';

const derivar = (c) => ({ motivos: [...(c.motivos_encerramento || [])] });

// Mesmo texto sem acento/caixa/espaço extra é duplicado.
function validar(motivos) {
  const limpos = motivos.map((m) => m.trim().replace(/\s+/g, ' '));
  if (!limpos.length) return { erro: 'Mantenha pelo menos um motivo.' };
  const curto = limpos.find((m) => m.length < 3);
  if (curto !== undefined) return { erro: 'Cada motivo precisa de pelo menos 3 caracteres.' };
  const vistos = new Set();
  for (const m of limpos) {
    if (vistos.has(normalizar(m))) return { erro: `Motivo repetido: "${m}".` };
    vistos.add(normalizar(m));
  }
  return { limpos };
}

export default function AbaMotivos({ onSujo }) {
  const { form, set, sujo, salvando, salvar, descartar } = useFormConfig(derivar, { nomeAba: 'Motivos de encerramento', onSujo });
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState('');

  function incluir() {
    const texto = novo.trim().replace(/\s+/g, ' ');
    if (texto.length < 3) { setErro('O motivo precisa de pelo menos 3 caracteres.'); return; }
    if (form.motivos.some((m) => normalizar(m) === normalizar(texto))) { setErro('Esse motivo já existe.'); return; }
    setErro('');
    set('motivos', [...form.motivos, texto]);
    setNovo('');
  }

  async function gravar() {
    const { erro: e, limpos } = validar(form.motivos);
    if (e) { setErro(e); return; }
    setErro('');
    await salvar({ motivos_encerramento: limpos });
  }

  return (
    <div className="pj-cartao pj-cfg-aba">
      <p className="pj-sub">Lista do campo “Motivo do encerramento” no encerramento de contrato. Motivos já usados continuam nos registros antigos.</p>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="pj-cfg-contato pj-cfg-motivo-novo">
        <input className="form-input" placeholder="Novo motivo" value={novo} onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); incluir(); } }} />
        <button type="button" className="btn btn-outline" onClick={incluir}><Plus size={16} /> Incluir</button>
      </div>
      <div className="pj-cfg-motivos">
        {form.motivos.map((m, i) => (
          <div key={i} className="pj-cfg-contato">
            <input className="form-input" value={m} aria-label={`Motivo ${i + 1}`}
              onChange={(e) => set('motivos', form.motivos.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Remover motivo" disabled={form.motivos.length <= 1}
              title={form.motivos.length <= 1 ? 'Mantenha pelo menos um motivo' : undefined}
              onClick={() => set('motivos', form.motivos.filter((_, j) => j !== i))}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <BarraSalvar sujo={sujo} salvando={salvando} onSalvar={gravar} onDescartar={descartar} />
    </div>
  );
}
