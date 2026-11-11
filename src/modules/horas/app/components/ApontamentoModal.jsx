import { useId, useState } from 'react';
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
import Modal from './Modal';
import Aviso from './Aviso';

// O formulário completo de um apontamento, nos três usos:
//  - `inicial` vazio  -> lançamento manual (quem esqueceu de ligar o cronômetro)
//  - `inicial` cheio  -> edição de um apontamento já gravado
//  - `modelo` cheio   -> duplicar: um lançamento manual que já vem com projeto,
//    campos e descrição de outro registro, e o mesmo horário trazido para hoje
// Os campos são os mesmos do cronômetro, e vêm da configuração da equipe.
export default function ApontamentoModal({ projetos, campos = [], inicial = null, modelo = null, onClose, onSave }) {
  const edicao = !!inicial;
  const base = inicial || modelo;
  // Na duplicação, mesmo horário do original, mas no dia de hoje: salvar sem
  // mexer em nada não pode gerar um registro sobreposto ao original.
  const deslocar = (ts) => (edicao ? ts : ts + inicioDoDia(Date.now()) - inicioDoDia(modelo.inicio));
  const [projetoId, setProjetoId] = useState(base?.projetoId || projetos[0]?.id || '');
  const [valores, setValores] = useState(() => valoresIniciais(campos, base?.campos));
  const [descricao, setDescricao] = useState(base?.descricao || '');
  const [ini, setIni] = useState(() =>
    toDatetimeLocal(base ? deslocar(base.inicio) : Date.now() - 3600000)
  );
  const [fim, setFim] = useState(() => toDatetimeLocal(base ? deslocar(base.fim) : Date.now()));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const uid = useId();

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

  const titulo = edicao ? 'Editar apontamento' : modelo ? 'Duplicar apontamento' : 'Lançamento manual';

  return (
    <Modal titulo={titulo} onClose={salvando ? undefined : onClose} className="horas-modal-manual">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="horas-fld">
          <label htmlFor={`${uid}-proj`}>Projeto</label>
          <SearchableSelect
            id={`${uid}-proj`}
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
          <label htmlFor={`${uid}-desc`}>
            Descrição <span className="horas-muted">(opcional)</span>
          </label>
          <input
            id={`${uid}-desc`}
            type="text"
            placeholder="No que você trabalhou?"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>
        <div className="horas-modal-row2">
          <div className="horas-fld">
            <label htmlFor={`${uid}-ini`}>Início</label>
            <input id={`${uid}-ini`} type="datetime-local" value={ini} onChange={(e) => setIni(e.target.value)} />
          </div>
          <div className="horas-fld">
            <label htmlFor={`${uid}-fim`}>Fim</label>
            <input id={`${uid}-fim`} type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
        </div>

        {preservados.length ? (
          <Aviso>
            Este apontamento tem valores de campos que a equipe não usa mais (
            {preservados.map((c) => `${c.label}: ${c.valor}`).join(' · ')}). Eles não são editáveis
            aqui, mas continuam gravados.
          </Aviso>
        ) : null}

        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        <div className="horas-modal-acoes">
          <button className="horas-btn2" type="button" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button className="horas-btn" type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : edicao ? 'Salvar alterações' : 'Salvar apontamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function inicioDoDia(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
