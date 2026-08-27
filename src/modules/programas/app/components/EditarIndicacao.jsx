import { useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';

/**
 * Edição da indicação pelo autor, dentro do popup de detalhe.
 *
 * Só os campos do formulário original. Status, comentário e premiação são do
 * comercial e nem aparecem aqui — um trigger no banco rejeita a escrita neles,
 * então esconder é coerência de tela, não a trava.
 */

const CAMPOS_TEXTO = [
  ['oportunidade', 'Nome da oportunidade', 'input'],
  ['descricao', 'Breve descrição da oportunidade', 'textarea'],
  ['empresa', 'Nome da empresa', 'input'],
];

const CAMPOS_CONTATO = [
  ['contato_nome', 'Nome do contato', 'text'],
  ['contato_cargo', 'Cargo', 'text'],
  ['contato_telefone', 'Telefone', 'tel'],
  ['contato_email', 'E-mail', 'email'],
];

export default function EditarIndicacao({ indicacao, salvando, erro, onCancelar, onSalvar }) {
  const [v, setV] = useState({
    oportunidade: indicacao.oportunidade || '',
    descricao: indicacao.descricao || '',
    empresa: indicacao.empresa || '',
    contato_nome: indicacao.contato_nome || '',
    contato_cargo: indicacao.contato_cargo || '',
    contato_telefone: indicacao.contato_telefone || '',
    contato_email: indicacao.contato_email || '',
    tratativas: indicacao.tratativas || '',
  });

  const set = (campo) => (e) => setV((a) => ({ ...a, [campo]: e.target.value }));

  const mudouAlvo = v.empresa.trim() !== indicacao.empresa
    || v.contato_nome.trim() !== indicacao.contato_nome
    || v.contato_email.trim() !== indicacao.contato_email;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSalvar(v); }}>
      {erro && <div className="pg-aviso tom-erro"><X size={16} /> {erro}</div>}

      {CAMPOS_TEXTO.map(([campo, rotulo, tipo]) => (
        <div className="pg-campo" key={campo}>
          <label htmlFor={`i-${campo}`}>{rotulo}<span className="req">*</span></label>
          {tipo === 'textarea' ? (
            <textarea id={`i-${campo}`} className="pg-textarea" value={v[campo]} onChange={set(campo)} required />
          ) : (
            <input id={`i-${campo}`} className="pg-input" value={v[campo]} onChange={set(campo)} required />
          )}
        </div>
      ))}

      {/* Avisar ANTES de salvar: trocar a empresa refaz a checagem, e a
          indicação pode sair de "elegível" — melhor descobrir aqui. */}
      {mudouAlvo && (
        <div className="pg-aviso tom-atencao">
          <span>
            Você mudou a empresa ou o contato. A elegibilidade será verificada de novo
            ao salvar, e o resultado pode mudar.
          </span>
        </div>
      )}

      <div className="pg-dupla">
        {CAMPOS_CONTATO.map(([campo, rotulo, tipo]) => (
          <div className="pg-campo" key={campo}>
            <label htmlFor={`i-${campo}`}>{rotulo}<span className="req">*</span></label>
            <input
              id={`i-${campo}`} type={tipo} className="pg-input"
              value={v[campo]} onChange={set(campo)} required
            />
          </div>
        ))}
      </div>

      <div className="pg-campo">
        <label htmlFor="i-tratativas">
          O que já foi tratado ou o que já temos da oportunidade<span className="req">*</span>
        </label>
        <textarea id="i-tratativas" className="pg-textarea" value={v.tratativas} onChange={set('tratativas')} required />
      </div>

      <div className="pg-editar-acoes">
        <button type="button" className="pg-btn pg-btn-ghost" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </button>
        <button type="submit" className="pg-btn pg-btn-primary" disabled={salvando}>
          {salvando
            ? <><Loader2 size={16} className="pg-spin" /> Salvando…</>
            : <><Save size={16} /> Salvar</>}
        </button>
      </div>
    </form>
  );
}
