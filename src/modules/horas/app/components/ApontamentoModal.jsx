import { useState } from 'react';
import { toDatetimeLocal } from '../../lib/format';
import {
  faltando,
  naoConfigurados,
  paraPersistencia,
  paraPersistenciaNaEdicao,
  valoresIniciais,
} from '../../lib/camposEquipe';
import CamposApontamento from './CamposApontamento';
import SearchableSelect from './SearchableSelect';

// O formulário completo de um apontamento, nos dois usos:
//  - `inicial` vazio  -> lançamento manual (quem esqueceu de ligar o cronômetro)
//  - `inicial` cheio  -> edição de um apontamento já gravado
// Os campos são os mesmos do cronômetro, e vêm da configuração da equipe.
export default function ApontamentoModal({ projetos, campos = [], inicial = null, onClose, onSave }) {
  const edicao = !!inicial;
  const [projetoId, setProjetoId] = useState(inicial?.projetoId || projetos[0]?.id || '');
  const [valores, setValores] = useState(() => valoresIniciais(campos, inicial?.campos));
  const [descricao, setDescricao] = useState(inicial?.descricao || '');
  const [ini, setIni] = useState(() => toDatetimeLocal(inicial?.inicio ?? Date.now() - 3600000));
  const [fim, setFim] = useState(() => toDatetimeLocal(inicial?.fim ?? Date.now()));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Valores gravados que a configuração atual da equipe não representa (campo
  // apagado depois, ou registro do catálogo antigo). Não dá para editá-los aqui,
  // mas eles são preservados ao salvar — o aviso existe para isso não parecer
  // que sumiram.
  const preservados = edicao ? naoConfigurados(campos, inicial.campos) : [];

  async function submit() {
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
    setSalvando(true);
    setErro('');
    try {
      await onSave({
        projetoId,
        campos: edicao
          ? paraPersistenciaNaEdicao(campos, valores, inicial.campos)
          : paraPersistencia(campos, valores),
        descricao,
        inicioTs,
        fimTs,
      });
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <div className="horas-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="horas-modal horas-modal-manual">
        <h3>{edicao ? 'Editar apontamento' : 'Lançamento manual'}</h3>
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

        {preservados.length ? (
          <div className="horas-hint" style={{ marginBottom: 8 }}>
            Este apontamento tem valores de campos que a equipe não usa mais (
            {preservados.map((c) => `${c.label}: ${c.valor}`).join(' · ')}). Eles não são editáveis
            aqui, mas continuam gravados.
          </div>
        ) : null}

        {erro ? <div className="horas-hint" style={{ marginBottom: 8 }}>⚠️ {erro}</div> : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="horas-btn2" type="button" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button className="horas-btn" type="button" onClick={submit} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
