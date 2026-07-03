import { maskCurrencyInput } from '../utils/currencyMask';

/**
 * Input de moeda pt-BR (ponto = milhar, vírgula = centavos). Controlado:
 * guarda/devolve a STRING mascarada; a conversão p/ número é no envio.
 */
export default function CurrencyInput({ value, onChange, placeholder, id, className = 'form-input' }) {
  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      id={id}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => onChange(maskCurrencyInput(e.target.value))}
    />
  );
}
