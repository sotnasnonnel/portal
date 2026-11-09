import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Plus, Wrench, X } from 'lucide-react';

/**
 * Transformar uma IDEIA em INICIATIVA — a ideia saiu do papel e agora tem
 * antes e depois para medir.
 *
 * Pergunta só os TRÊS campos que a iniciativa exige e a ideia não tinha onde
 * guardar (CHECK programas_ideias_campos_por_tipo: data de início, finalidade e
 * pelo menos uma ferramenta). Título, setor, tipo, retorno e situação já estão
 * preenchidos e seguem como estão — reapresentar o formulário inteiro faria
 * reler e reconfirmar o que não mudou, e a conversão é um gesto, não um novo
 * cadastro. Quem quiser corrigir o resto usa Editar depois, que é onde esses
 * campos moram.
 *
 * O texto da ideia (descrição, problema, benefícios) não aparece aqui porque
 * não se perde: ele fica na linha, e é o registro de onde a iniciativa nasceu
 * (ver converterEmIniciativa, em lib/ideias.js).
 */

const VAZIO = (id) => ({ id, valor: '' });

export default function ConverterIniciativa({ registro, onFechar, onConverter }) {
  const [dataInicio, setDataInicio] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [ferramentas, setFerramentas] = useState([VAZIO(1)]);
  const [proximoId, setProximoId] = useState(2);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !salvando) onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar, salvando]);

  const addFerramenta = () => {
    setFerramentas((a) => [...a, VAZIO(proximoId)]);
    setProximoId((n) => n + 1);
  };
  const removerFerramenta = (id) => setFerramentas((a) => (
    a.length === 1 ? [VAZIO(proximoId)] : a.filter((f) => f.id !== id)
  ));

  // O `required` do HTML não alcança a lista de ferramentas: com várias linhas,
  // marcar todas como obrigatórias impediria deixar uma em branco no fim. A
  // regra real é "pelo menos uma", a mesma do CHECK do banco.
  const preenchidas = ferramentas.map((f) => f.valor.trim()).filter(Boolean);

  const enviar = async (e) => {
    e.preventDefault();
    if (!preenchidas.length) {
      setErro('Informe pelo menos uma ferramenta usada.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await onConverter({
        data_inicio: dataInicio,
        finalidade,
        ferramentas: preenchidas,
      });
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  };

  return (
    <div className="pg-modal-overlay" onClick={() => !salvando && onFechar()}>
      <form
        className="pg-modal" onClick={(e) => e.stopPropagation()}
        onSubmit={enviar} role="dialog" aria-modal="true" aria-label="Transformar em iniciativa"
      >
        <div className="pg-modal-cab">
          <h2>Transformar em iniciativa</h2>
          <button type="button" className="pg-modal-x" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="pg-modal-corpo">
          <p className="pg-pedir-alvo">#{registro.numero} — {registro.titulo}</p>
          {/* O porquê vem antes dos campos: quem clica aqui está atrás da ficha
              de ROI, e é o que a conversão destrava. */}
          <p className="pg-campo-dica">
            O registro continua o mesmo — mesmo número, mesma data, mesmo histórico —, mas
            passa a valer como algo que <strong>já existe</strong>. Com isso ele ganha a{' '}
            <strong>ficha de ROI</strong> e concorre ao Programa de Inovação, que só conta
            iniciativas. O que você escreveu como ideia fica guardado no registro.
          </p>
          <p className="pg-campo-dica">
            Não dá para voltar atrás depois: se a solução ainda não saiu do papel, deixe
            como ideia.
          </p>

          {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

          <div className="pg-campo">
            <label htmlFor="cv-data">Data de início da criação<span className="req">*</span></label>
            <input
              id="cv-data" type="date" className="pg-input"
              value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required
            />
          </div>

          <div className="pg-campo">
            <label>Ferramenta usada<span className="req">*</span></label>
            <div className="pg-lista-campo">
              {ferramentas.map((f, i) => (
                <div className="pg-lista-linha" key={f.id}>
                  <input
                    className="pg-input" value={f.valor}
                    onChange={(e) => setFerramentas((a) => a.map(
                      (x) => (x.id === f.id ? { ...x, valor: e.target.value } : x)
                    ))}
                    aria-label={`Ferramenta ${i + 1}`}
                  />
                  <button
                    type="button" className="pg-lista-x" onClick={() => removerFerramenta(f.id)}
                    aria-label={`Remover ferramenta ${i + 1}`}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              <button type="button" className="pg-lista-add" onClick={addFerramenta}>
                <Plus size={14} /> Adicionar ferramenta
              </button>
            </div>
          </div>

          <div className="pg-campo">
            <label htmlFor="cv-finalidade">Finalidade<span className="req">*</span></label>
            <textarea
              id="cv-finalidade" className="pg-textarea"
              value={finalidade} onChange={(e) => setFinalidade(e.target.value)} required
            />
          </div>
        </div>

        <div className="pg-modal-pe">
          <button type="button" className="pg-btn pg-btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="pg-btn pg-btn-primary" disabled={salvando}>
            {salvando ? <Loader2 size={15} className="pg-spin" /> : <Wrench size={15} />}
            {salvando ? 'Transformando…' : 'Transformar em iniciativa'}
          </button>
        </div>
      </form>
    </div>
  );
}
