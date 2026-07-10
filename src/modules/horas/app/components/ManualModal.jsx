import { useState } from 'react';
import { toDatetimeLocal } from '../../lib/format';

// Lançamento manual de um apontamento (quem esqueceu de ligar o cronômetro).
// `atividades` já vem filtrada: só as que têm opções cadastradas.
export default function ManualModal({ projetos, atividades, onClose, onSave }) {
  const [projetoId, setProjetoId] = useState(projetos[0]?.id || '');
  // Indexado pela ordem (0..2), como no cronômetro.
  const [ativ, setAtiv] = useState(() => {
    const base = ['', '', ''];
    atividades.forEach((a) => {
      base[a.ordem] = a.valores[0] || '';
    });
    return base;
  });
  const [descricao, setDescricao] = useState('');
  const [ini, setIni] = useState(() => toDatetimeLocal(Date.now() - 3600000));
  const [fim, setFim] = useState(() => toDatetimeLocal(Date.now()));
  const [erro, setErro] = useState('');

  function submit() {
    const inicioTs = new Date(ini).getTime();
    const fimTs = new Date(fim).getTime();
    if (!(fimTs > inicioTs)) {
      setErro('O horário de fim deve ser maior que o de início.');
      return;
    }
    onSave({ projetoId, ativ, descricao, inicioTs, fimTs });
  }

  return (
    <div className="horas-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="horas-modal">
        <h3>Lançamento manual</h3>
        <div className="horas-fld">
          <label>Projeto</label>
          <select value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
            {projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.cliente ? ` — ${p.cliente}` : ''}
              </option>
            ))}
          </select>
        </div>
        {atividades.map((a) => (
          <div className="horas-fld" key={a.id}>
            <label>{a.label}</label>
            <select
              value={ativ[a.ordem] || ''}
              onChange={(e) => setAtiv((prev) => prev.map((x, j) => (j === a.ordem ? e.target.value : x)))}
            >
              {a.valores.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="horas-fld">
          <label>Descrição</label>
          <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div className="horas-fld">
          <label>Início</label>
          <input type="datetime-local" value={ini} onChange={(e) => setIni(e.target.value)} />
        </div>
        <div className="horas-fld">
          <label>Fim</label>
          <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        {erro ? <div className="horas-hint" style={{ marginBottom: 8 }}>⚠️ {erro}</div> : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="horas-btn2" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="horas-btn" type="button" onClick={submit}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
