import { useState } from 'react';

// Uma das 3 atividades controladas da gerência: rótulo editável + lista de opções.
// Enquanto não tiver nenhuma opção, ela não aparece no apontamento nem nos gráficos.
export default function BlocoAtividade({ atividade, onLabel, onAdd, onDel }) {
  const [valor, setValor] = useState('');

  function adicionar() {
    onAdd(valor);
    setValor('');
  }

  return (
    <div className="horas-cfg-block">
      <div className="horas-lbl-edit">
        <span>Atividade Controlada {atividade.ordem + 1} · rótulo:</span>
        {/* Não controlado: o rótulo só é gravado ao sair do campo. A `key`
            ressincroniza o input quando o valor muda no servidor. */}
        <input
          key={atividade.label}
          type="text"
          defaultValue={atividade.label}
          onBlur={(e) => e.target.value !== atividade.label && onLabel(e.target.value)}
        />
      </div>
      <div className="horas-chips">
        {atividade.valores.length ? (
          atividade.valores.map((v, i) => (
            <span className="horas-chip" key={v}>
              {v}
              <button type="button" title="Remover" onClick={() => onDel(i)}>
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="horas-muted">Nenhum item.</span>
        )}
      </div>
      <div className="horas-add-inline">
        <input
          type="text"
          placeholder="Nova opção…"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
        />
        <button className="horas-btn2" type="button" onClick={adicionar}>
          Adicionar
        </button>
      </div>
    </div>
  );
}
