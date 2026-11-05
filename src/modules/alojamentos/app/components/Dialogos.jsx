import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  coletar, faltando, opcoes, valoresIniciais,
} from '../../lib/formularios';
import { staysOn } from '../../lib/regras';

function Modal({
  titulo, sub, largo, estreito, onFechar, corpo, rodape,
}) {
  // Esc fecha e a página atrás não rola enquanto o popup está aberto.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', onKey);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = anterior;
    };
  }, [onFechar]);

  return (
    <div className="aloj-overlay" onClick={onFechar}>
      <div
        className={`aloj-modal${largo ? ' largo' : ''}${estreito ? ' estreito' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="aloj-modal-h">
          <div>
            <h2>{titulo}</h2>
            {sub && <p>{sub}</p>}
          </div>
          <button type="button" className="aloj-mini" onClick={onFechar} aria-label="Fechar"><X size={16} /></button>
        </header>
        {corpo}
        <footer className="aloj-modal-f">{rodape}</footer>
      </div>
    </div>
  );
}

function Campo({ campo, vals, onChange }) {
  const id = `aloj-f-${campo.k}`;
  const classe = `aloj-campo${campo.span === 2 ? ' s2' : ''}`;
  const dica = campo.hint && <span className="aloj-dica">{campo.hint}</span>;
  const v = vals[campo.k];

  if (campo.type === 'toggle') {
    return (
      <div className={classe}>
        <label className="aloj-toggle" htmlFor={id}>
          <input type="checkbox" id={id} checked={!!v} onChange={(e) => onChange(campo.k, e.target.checked)} /> {campo.label}
        </label>
        {dica}
      </div>
    );
  }
  if (campo.type === 'checks') {
    const lista = v || [];
    const alternar = (o) => onChange(campo.k, lista.includes(o) ? lista.filter((x) => x !== o) : [...lista, o]);
    return (
      <div className="aloj-campo s2">
        <span className="aloj-campo-l">{campo.label}</span>
        <div className="aloj-checks">
          {campo.opts.map((o) => (
            <label key={o}><input type="checkbox" checked={lista.includes(o)} onChange={() => alternar(o)} /> {o}</label>
          ))}
        </div>
        {dica}
      </div>
    );
  }

  const comum = {
    id,
    value: v ?? '',
    onChange: (e) => onChange(campo.k, e.target.value),
  };
  let controle;
  if (campo.type === 'select') {
    controle = (
      <select {...comum}>
        {opcoes(campo, vals).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
      </select>
    );
  } else if (campo.type === 'textarea') {
    controle = <textarea {...comum} rows={campo.rows || 3} placeholder={campo.ph || ''} />;
  } else if (campo.type === 'money') {
    controle = <input {...comum} type="number" step="0.01" min="0" inputMode="decimal" placeholder={campo.ph || '0,00'} />;
  } else if (campo.type === 'int') {
    controle = <input {...comum} type="number" step="1" min={campo.min ?? 0} inputMode="numeric" placeholder={campo.ph || ''} />;
  } else {
    controle = <input {...comum} type={campo.type || 'text'} placeholder={campo.ph || ''} autoComplete="off" />;
  }
  return (
    <div className={classe}>
      <label htmlFor={id}>{campo.label}{campo.req && <span className="aloj-req"> *</span>}</label>
      {controle}
      {dica}
    </div>
  );
}

function FormModal({ config, onFechar }) {
  const { campos, rotulo = 'Salvar' } = config;
  const [vals, setVals] = useState(() => valoresIniciais(campos, config.valores));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const mudar = (k, valor) => setVals((atual) => {
    const novo = { ...atual, [k]: valor };
    // Campo que depende deste (o quarto depende do alojamento): se o valor atual
    // sumiu das opções, cai na 1ª, igual ao que o <select> já está mostrando.
    campos.filter((c) => c.dep === k).forEach((c) => {
      const ops = opcoes(c, novo);
      if (!ops.some(([o]) => String(o) === String(novo[c.k]))) novo[c.k] = ops[0]?.[0] ?? '';
    });
    return novo;
  });

  const salvar = async (ev) => {
    ev.preventDefault();
    const coletados = coletar(campos, vals);
    const faltam = faltando(campos, coletados);
    if (faltam.length) {
      setErro(`Preencha: ${faltam.join(', ')}.`);
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await config.onSalvar(coletados);
      onFechar();
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo={config.titulo}
      sub={config.sub}
      largo={config.largo}
      onFechar={onFechar}
      corpo={(
        <form id="aloj-form" className="aloj-modal-b" onSubmit={salvar} noValidate>
          <div className="aloj-fgrid">
            {campos.map((c) => (c.section
              ? <div key={c.section} className="aloj-fsec">{c.section}</div>
              : <Campo key={c.k} campo={c} vals={vals} onChange={mudar} />))}
          </div>
          {erro && <p className="aloj-ferr" role="alert">{erro}</p>}
        </form>
      )}
      rodape={(
        <>
          {config.esquerda && (
            <span className="aloj-modal-esq">
              <button type="button" className="aloj-btn perigo pequeno" onClick={config.esquerda.onClick}>
                <Trash2 size={14} /> {config.esquerda.rotulo}
              </button>
            </span>
          )}
          <button type="button" className="aloj-btn" onClick={onFechar}>Cancelar</button>
          <button type="submit" form="aloj-form" className="aloj-btn primario" disabled={salvando}>
            {salvando ? 'Salvando…' : rotulo}
          </button>
        </>
      )}
    />
  );
}

function ConfirmModal({ config, onFechar }) {
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const ok = async () => {
    setOcupado(true);
    setErro('');
    try {
      await config.onOk();
      onFechar();
    } catch (e) {
      setErro(e.message);
      setOcupado(false);
    }
  };
  return (
    <Modal
      titulo={config.titulo}
      estreito
      onFechar={onFechar}
      corpo={(
        <div className="aloj-modal-b">
          <p className="aloj-texto">{config.texto}</p>
          {erro && <p className="aloj-ferr" role="alert">{erro}</p>}
        </div>
      )}
      rodape={(
        <>
          <button type="button" className="aloj-btn" onClick={onFechar}>Cancelar</button>
          <button type="button" className="aloj-btn perigo-cheio" onClick={ok} disabled={ocupado}>{config.ok || 'Excluir'}</button>
        </>
      )}
    />
  );
}

function QuartosModal({
  a, base, onSalvar, onFechar,
}) {
  // `chave` identifica a linha para o React, inclusive a nova, que ainda não tem id.
  const [linhas, setLinhas] = useState(() => (a.quartos?.length
    ? a.quartos.map((q) => ({ chave: q.id, id: q.id, nome: q.nome, vagas: q.vagas }))
    : [{ chave: 'novo-0', nome: 'Quarto 1', vagas: 1 }]));
  const [proximaChave, setProximaChave] = useState(1);
  const [removidos, setRemovidos] = useState([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const mudar = (chave, campo, valor) => setLinhas((l) => l.map((r) => (r.chave === chave ? { ...r, [campo]: valor } : r)));

  const adicionar = () => {
    setLinhas((l) => [...l, { chave: `novo-${proximaChave}`, nome: `Quarto ${l.length + 1}`, vagas: 1 }]);
    setProximaChave((n) => n + 1);
  };

  const remover = (r) => {
    const ocupantes = r.id ? staysOn(base, a.id).filter((e) => e.quarto_id === r.id) : [];
    if (ocupantes.length) {
      setErro(`Registre a saída de ${ocupantes.map((e) => e.morador).join(', ')} antes de remover ${r.nome}.`);
      return;
    }
    setErro('');
    if (r.id) setRemovidos((x) => [...x, r.id]);
    setLinhas((l) => l.filter((x) => x.chave !== r.chave));
  };

  const salvar = async () => {
    const limpas = linhas.map((r) => ({ id: r.id, nome: String(r.nome).trim(), vagas: Math.max(1, parseInt(r.vagas, 10) || 1) }));
    if (limpas.some((r) => !r.nome)) {
      setErro('Dê um nome a todos os quartos.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await onSalvar(a, limpas, removidos);
      onFechar();
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo="Configurar quartos"
      sub={`${a.nome} · nome do quarto e número de vagas (camas) em cada um`}
      onFechar={onFechar}
      corpo={(
        <div className="aloj-modal-b">
          <div className="aloj-quartos">
            <div className="aloj-quartos-h"><span>Quarto</span><span>Vagas</span><span /></div>
            {linhas.map((r) => (
              <div key={r.chave} className="aloj-quartos-l">
                <input aria-label="Nome do quarto" value={r.nome} onChange={(e) => mudar(r.chave, 'nome', e.target.value)} />
                <input aria-label="Vagas" type="number" min="1" step="1" value={r.vagas} onChange={(e) => mudar(r.chave, 'vagas', e.target.value)} />
                <button type="button" className="aloj-mini" onClick={() => remover(r)} title="Remover quarto" aria-label="Remover quarto"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <button type="button" className="aloj-link" onClick={adicionar}>
            <Plus size={14} /> Adicionar quarto
          </button>
          {erro && <p className="aloj-ferr" role="alert">{erro}</p>}
        </div>
      )}
      rodape={(
        <>
          <button type="button" className="aloj-btn" onClick={onFechar}>Cancelar</button>
          <button type="button" className="aloj-btn primario" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar quartos'}
          </button>
        </>
      )}
    />
  );
}

function Toast({ texto, onFim }) {
  useEffect(() => {
    if (!texto) return undefined;
    const t = setTimeout(onFim, 3500);
    return () => clearTimeout(t);
  }, [texto, onFim]);
  return <div className="aloj-toast" role="status" aria-live="polite" hidden={!texto}>{texto}</div>;
}

/** O que useAcoes abriu. Cada tela desenha isto uma vez. */
export default function Dialogos({ acoes }) {
  const {
    form, confirmacao, quartosDe, toast, base, fechar, limparToast, salvarListaQuartos,
  } = acoes;
  return (
    <>
      {form && <FormModal key={form.titulo} config={form} onFechar={fechar} />}
      {confirmacao && <ConfirmModal config={confirmacao} onFechar={fechar} />}
      {quartosDe && <QuartosModal a={quartosDe} base={base} onSalvar={salvarListaQuartos} onFechar={fechar} />}
      <Toast texto={toast} onFim={limparToast} />
    </>
  );
}
