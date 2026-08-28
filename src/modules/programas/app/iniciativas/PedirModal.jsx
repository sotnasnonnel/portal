import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Send, X } from 'lucide-react';
import SearchSelect from '../../../../components/UI/SearchSelect';
import { listarObras } from '../../lib/iniciativas';

/**
 * Pedido de uma iniciativa para uma obra.
 *
 * Duas perguntas só: QUAL obra e POR QUÊ. O resto (quem pediu, qual
 * iniciativa, quando) o sistema já sabe — pedir de novo o que ele sabe é o que
 * faz formulário interno virar formulário de cartório.
 *
 * A obra vem de lista, do organograma, e não digitada: ver listarObras().
 */
export default function PedirModal({ iniciativa, jaAplicada = [], onFechar, onEnviar }) {
  const [obras, setObras] = useState(null);   // null = carregando
  const [obra, setObra] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    listarObras()
      .then(setObras)
      .catch((e) => { setObras([]); setErro(e.message); });
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !enviando) onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar, enviando]);

  // Obra que já roda a iniciativa continua na lista, marcada: o pedido pode ser
  // de ampliar o uso, e sumir com ela deixaria a pessoa procurando o que não
  // está lá. Quem escolhe uma dessas vê o aviso antes de enviar.
  const opcoes = (obras || []).map((o) => ({
    value: o,
    label: jaAplicada.includes(o) ? `${o} — já usa` : o,
  }));

  const enviar = async (e) => {
    e.preventDefault();
    if (!obra) return setErro('Escolha a obra.');
    if (!justificativa.trim()) return setErro('Conte para que você precisa da iniciativa.');
    setEnviando(true);
    setErro('');
    try {
      await onEnviar({ iniciativa, obra, justificativa });
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  };

  return (
    <div className="pg-modal-overlay" onClick={() => !enviando && onFechar()}>
      <form
        className="pg-modal pg-pedir-modal" onClick={(e) => e.stopPropagation()}
        onSubmit={enviar} role="dialog" aria-modal="true" aria-label="Pedir iniciativa para a obra"
      >
        <div className="pg-modal-cab">
          <h2>Pedir para minha obra</h2>
          <button type="button" className="pg-modal-x" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="pg-modal-corpo">
          <p className="pg-pedir-alvo">{iniciativa.titulo}</p>

          {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

          <div className="pg-campo">
            <label htmlFor="pedir-obra">Obra</label>
            {obras === null ? (
              <p className="pg-campo-dica"><Loader2 size={14} className="pg-spin" /> Carregando obras…</p>
            ) : (
              <SearchSelect
                value={obra}
                onChange={setObra}
                options={opcoes}
                placeholder="Escolha a obra"
                ariaLabel="Obra"
              />
            )}
            {obra && jaAplicada.includes(obra) && (
              <p className="pg-campo-dica">
                Esta obra já usa a iniciativa. Peça mesmo assim se for ampliar o uso —
                escreva abaixo o que muda.
              </p>
            )}
          </div>

          <div className="pg-campo">
            <label htmlFor="pedir-just">Para que você precisa</label>
            <textarea
              id="pedir-just"
              className="pg-textarea"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="O que a obra ganha com isso, e para quando você precisa."
            />
          </div>
        </div>

        <div className="pg-modal-pe">
          <button type="button" className="pg-btn pg-btn-ghost" onClick={onFechar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" className="pg-btn pg-btn-primary" disabled={enviando}>
            {enviando ? <Loader2 size={15} className="pg-spin" /> : <Send size={15} />}
            {enviando ? 'Enviando…' : 'Enviar pedido'}
          </button>
        </div>
      </form>
    </div>
  );
}
