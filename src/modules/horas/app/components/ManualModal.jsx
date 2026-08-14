import { useState } from 'react';
import { toDatetimeLocal } from '../../lib/format';
import { faltando, paraPersistencia, valoresIniciais } from '../../lib/camposEquipe';
import CamposApontamento from './CamposApontamento';
import SearchableSelect from './SearchableSelect';

// Lançamento manual de um apontamento (quem esqueceu de ligar o cronômetro).
// Os campos são os mesmos do cronômetro — projeto + os campos da equipe.
export default function ManualModal({ projetos, campos = [], onClose, onSave }) {
  const [projetoId, setProjetoId] = useState(projetos[0]?.id || '');
  const [valores, setValores] = useState(() => valoresIniciais(campos));
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
    const pendentes = faltando(campos, valores);
    if (pendentes.length) {
      setErro(`Preencha ${pendentes.join(', ')}.`);
      return;
    }
    onSave({ projetoId, campos: paraPersistencia(campos, valores), descricao, inicioTs, fimTs });
  }

  return (
    <div className="horas-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="horas-modal horas-modal-manual">
        <h3>Lançamento manual</h3>
        <div className="horas-fld">
          <label>Projeto</label>
          <SearchableSelect
            value={projetoId}
            placeholder="Selecione o projeto…"
            onChange={(v) => setProjetoId(v)}
            options={projetos.map((p) => ({
              value: p.id,
              label: p.nome + (p.cliente ? ` — ${p.cliente}` : ''),
            }))}
          />
        </div>
        <CamposApontamento
          campos={campos}
          valores={valores}
          onChange={(id, v) => setValores((vals) => ({ ...vals, [id]: v }))}
        />
        <div className="horas-fld">
          <label>Descrição</label>
          <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div className="horas-modal-row2">
          <div className="horas-fld">
            <label>Início</label>
            <input type="datetime-local" value={ini} onChange={(e) => setIni(e.target.value)} />
          </div>
          <div className="horas-fld">
            <label>Fim</label>
            <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
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
