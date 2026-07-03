import { Check, X, Clock, Eye, CheckCheck, CircleDashed } from 'lucide-react';
import { etapaAtual } from '../../config/aprovacao';
import './FluxoTimeline.css';

const fmt = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
};

const VISUAL = {
  aprovada:      { Icon: Check,        cor: '#00a49a', label: 'Aprovou' },
  auto_aprovada: { Icon: Check,        cor: '#00a49a', label: 'Aprovou (criador)' },
  executada:     { Icon: CheckCheck,   cor: '#26405d', label: 'Executou' },
  reprovada:     { Icon: X,            cor: '#e74c3c', label: 'Reprovou' },
  ciencia:       { Icon: Eye,          cor: '#9b59b6', label: 'Ciente' },
};

export default function FluxoTimeline({ etapas = [] }) {
  if (!etapas || etapas.length === 0) return null;

  const atual = etapaAtual(etapas);
  const ordenadas = [...etapas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  return (
    <div className="fluxo-timeline">
      {ordenadas.map((e) => {
        const isAtual = atual && e.id === atual.id;
        let v = VISUAL[e.status];
        if (e.status === 'pendente') {
          v = isAtual
            ? { Icon: Clock, cor: '#f39c12', label: 'Aguardando' }
            : { Icon: CircleDashed, cor: '#b0b0b0', label: 'A seguir' };
        }
        const { Icon, cor, label } = v || { Icon: CircleDashed, cor: '#b0b0b0', label: e.status };
        return (
          <div key={e.id} className={`fluxo-step ${isAtual ? 'is-atual' : ''}`}>
            <div className="fluxo-step-icon" style={{ color: cor, borderColor: cor }}>
              <Icon size={14} />
            </div>
            <div className="fluxo-step-body">
              <div className="fluxo-step-papel">{e.papel}</div>
              <div className="fluxo-step-status" style={{ color: cor }}>
                {label}
                {e.decidido_em && <span className="fluxo-step-data"> · {fmt(e.decidido_em)}</span>}
              </div>
              {e.justificativa && (
                <div className="fluxo-step-justificativa">“{e.justificativa}”</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
