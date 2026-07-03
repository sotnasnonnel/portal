import { AlertTriangle } from 'lucide-react';
import '../Gestor.css';

export default function EmConstrucao({ label }) {
  return (
    <div className="table-container">
      <div className="table-empty" style={{ padding: 'var(--space-3xl)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)' }}>
        <AlertTriangle size={40} color="var(--color-text-muted)" />
        <div>
          <strong>{label}</strong> está em construção.
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Esta requisição ainda não está disponível. Em breve.
          </div>
        </div>
      </div>
    </div>
  );
}
