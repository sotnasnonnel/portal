import { useRef } from 'react';
import { FileText, Paperclip, X } from 'lucide-react';
import ErroCampo from './ErroCampo';
import { ariaDoErro } from '../../lib/errosDeCampo';
import { formatarTamanho } from '../../lib/arquivo';

/**
 * Um campo de anexo: rótulo, botão e a lista do que já foi escolhido.
 *
 * Serve ao campo geral "Anexos" do chamado e a cada documento que o serviço
 * pede em separado (plano de saúde: "CPF", "Certidão de casamento"…). Aceita
 * mais de um arquivo por campo — RG frente e verso costumam vir em dois.
 */
export default function CampoAnexo({
  chave, rotulo, obrigatorio = false, dica = '', arquivos = [], onAdicionar, onRemover, erro = '',
}) {
  const input = useRef(null);
  const idRotulo = `adm-anexo-rot-${chave}`;

  const escolher = (e) => {
    const novos = Array.from(e.target.files || []);
    if (novos.length) onAdicionar(novos);
    e.target.value = ''; // permite reescolher o mesmo arquivo depois de remover
  };

  return (
    <div className="adm-campo" role="group" aria-labelledby={idRotulo}>
      <span className="adm-campo-rotulo" id={idRotulo}>
        {rotulo}{obrigatorio && <span className="req">*</span>}
      </span>
      <input
        ref={input}
        type="file"
        multiple
        onChange={escolher}
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />
      <button type="button" className="adm-anexo-btn" onClick={() => input.current?.click()}
        {...ariaDoErro(chave, erro)}>
        <Paperclip size={16} aria-hidden="true" />
        {arquivos.length ? 'Anexar mais' : (chave === 'anexos' ? 'Anexar arquivos' : 'Anexar arquivo')}
      </button>
      {arquivos.length > 0 && (
        <ul className="adm-anexo-lista">
          {arquivos.map((a, i) => (
            <li key={`${a.name}-${i}`} className="adm-anexo-item">
              <FileText size={16} aria-hidden="true" />
              <span className="adm-anexo-nome" title={a.name}>{a.name}</span>
              <span className="adm-anexo-tam">{formatarTamanho(a.size)}</span>
              <button type="button" className="adm-anexo-x" onClick={() => onRemover(i)}
                title="Remover" aria-label={`Remover ${a.name}`}>
                <X size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ErroCampo chave={chave} msg={erro} />
      {dica && <span className="adm-campo-dica">{dica}</span>}
    </div>
  );
}
