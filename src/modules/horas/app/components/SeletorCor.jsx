import { CORES } from '../../lib/cores';

export default function SeletorCor({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {CORES.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onChange(c)}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: c,
            border: value === c ? '2px solid var(--h-ink)' : '2px solid transparent',
            cursor: 'pointer',
          }}
        />
      ))}
    </div>
  );
}
