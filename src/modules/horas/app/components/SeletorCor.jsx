import { CORES } from '../../lib/cores';

// O tamanho dos botoes vem do CSS (.horas-cor-btn): 22px no desktop e 34px no
// mobile, onde 22px e pequeno demais para acertar com o dedo.
export default function SeletorCor({ value, onChange }) {
  return (
    <div className="horas-cores">
      {CORES.map((c) => (
        <button
          key={c}
          className="horas-cor-btn"
          type="button"
          title={c}
          onClick={() => onChange(c)}
          style={{
            background: c,
            border: value === c ? '2px solid var(--h-ink)' : '2px solid transparent',
          }}
        />
      ))}
    </div>
  );
}
