import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { usePendenciasAprovacao } from './usePendencias';
import './aprovacoes.css';

// Atalho da central de Aprovações, ao lado do sino. O sino avisa uma vez e o
// aviso some; a aprovação continua esperando — o número aqui é o que resta.
// `className` vem de quem monta: a barra dos módulos e a Home têm botões de
// formatos diferentes.
export default function AtalhoAprovacoes({ className = '' }) {
  const total = usePendenciasAprovacao();
  const rotulo = total > 0 ? `Aprovações — ${total} esperando você` : 'Aprovações';
  return (
    <Link to="/aprovacoes" className={`atalho-aprovacoes ${className}`} aria-label={rotulo} title={rotulo}>
      <ClipboardCheck size={19} />
      {total > 0 && <span className="atalho-aprovacoes-num">{total > 99 ? '99+' : total}</span>}
    </Link>
  );
}
