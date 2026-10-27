import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { proximaOrdem } from '../../lib/ordenacao';

// Cabeçalho que ordena ao clicar: crescente, decrescente, volta à ordem
// original. Mesmo comportamento do Reembolso.
export default function ThOrdena({ coluna, ordem, setOrdem, className = '', children }) {
  const ativa = ordem?.coluna === coluna;
  const Icone = !ativa ? ArrowUpDown : ordem.direcao === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={className}
      aria-sort={ativa ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`mob-th-ordena${ativa ? ' is-active' : ''}`}
        onClick={() => setOrdem((o) => proximaOrdem(o, coluna))}>
        {children}
        <Icone size={12} aria-hidden="true" />
      </button>
    </th>
  );
}
