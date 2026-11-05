import { AlertCircle } from 'lucide-react';
import { idDoErro } from '../../lib/errosDeCampo';

/**
 * Mensagem de erro logo abaixo do campo. A borda vermelha do controle sai desta
 * mesma peça (`.adm-campo:has(> .adm-campo-erro)`), porque nem todo controle é
 * nosso: o SearchSelect é do portal e não recebe classe de erro de fora.
 */
export default function ErroCampo({ chave, msg }) {
  if (!msg) return null;
  return (
    <span className="adm-campo-erro" id={idDoErro(chave)}>
      <AlertCircle size={13} aria-hidden="true" /> {msg}
    </span>
  );
}
