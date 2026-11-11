import { CORES } from '../../lib/cores';

// O tamanho dos botoes vem do CSS (.horas-cor-btn): 22px no desktop e 34px no
// mobile, onde 22px e pequeno demais para acertar com o dedo.
// O nome do grupo (rotulo) vai para o leitor de tela; cada bolinha diz a sua
// posição, e a escolhida é marcada com aria-pressed e um anel visível.
export default function SeletorCor({ value, onChange, rotulo = 'Cor do projeto' }) {
  return (
    <div className="horas-cores" role="group" aria-label={rotulo}>
      {CORES.map((c, i) => (
        <button
          key={c}
          className={`horas-cor-btn${value === c ? ' is-sel' : ''}`}
          type="button"
          title={c}
          aria-label={`Cor ${i + 1} de ${CORES.length}`}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}
