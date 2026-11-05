import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, BedDouble, Building2, Download, Home, Plus, Search,
} from 'lucide-react';
import { useBase } from '../../lib/useBase';
import { exportarXlsx } from '../../lib/exportar';
import {
  alojs, contratoInfo, fdate, local, missing, money, norm, num, operando, plural, staysOn, vagas,
} from '../../lib/regras';
import { rotaFicha } from '../components/nav';
import { useAcoes } from '../components/useAcoes';
import Dialogos from '../components/Dialogos';
import {
  Barra, Carga, Pill, PillStatus, Vazio,
} from '../components/Ui';

const SEGMENTOS = [
  ['operando', 'Em operação'],
  ['ativo', 'Ativos'],
  ['desmobilizacao', 'Em desmobilização'],
  ['inativo', 'Inativos'],
  ['incompletos', 'Cadastro incompleto'],
  ['todos', 'Todos'],
];

function IconeTipo({ tipo }) {
  if (tipo === 'Hotel') return <BedDouble size={20} />;
  if (tipo === 'Casa') return <Home size={20} />;
  return <Building2 size={20} />;
}
const tomDoTile = (a) => (a.status === 'inativo' ? 'cinza' : a.status === 'desmobilizacao' ? 'laranja' : '');

function CartaoAloj({ a, base }) {
  const v = vagas(a);
  const o = staysOn(base, a.id).length;
  const ci = contratoInfo(a);
  const m = a.status === 'ativo' ? missing(a) : [];
  const dataFim = ci.alvo || a.devolucao_data;
  return (
    <Link className={`aloj-card aloj-acard${a.status === 'inativo' ? ' off' : ''}`} to={rotaFicha(a.id)}>
      <div className="aloj-acard-top">
        <span className={`aloj-tile ${tomDoTile(a)}`}><IconeTipo tipo={a.tipo} /></span>
        <div>
          <h3>{a.nome} {a.sigla && <span className="aloj-tag">{a.sigla}</span>}</h3>
          <div className="aloj-acard-cid">{local(a)}{a.tipo ? ` · ${a.tipo}` : ''}</div>
          <PillStatus a={a} />
        </div>
      </div>
      <div className="aloj-acard-end">
        {a.endereco || <span className="aloj-nil">Endereço não cadastrado</span>}
      </div>
      <dl className="aloj-acard-m">
        <div>
          <dt>Ocupação</dt>
          <dd>{v ? `${o}/${v}` : o ? `${o} morador${o > 1 ? 'es' : ''}` : '—'}</dd>
          {v > 0 && <Barra pct={(o / v) * 100} tom="teal" />}
        </div>
        <div>
          <dt>Aluguel</dt>
          <dd>{num(a.aluguel_valor) !== null ? money(a.aluguel_valor) : '—'}</dd>
        </div>
        <div>
          <dt>{a.status === 'inativo' ? 'Encerramento' : a.status === 'desmobilizacao' ? 'Entrega' : 'Contrato até'}</dt>
          <dd>
            {dataFim
              ? (ci.c ? <Pill c={ci.c} semPonto>{fdate(dataFim)}</Pill> : fdate(dataFim))
              : '—'}
          </dd>
        </div>
      </dl>
      <div className="aloj-acard-f">
        <span>{[a.centro_custo, a.gerente].filter(Boolean).join(' · ') || 'Sem centro de custo / gerente'}</span>
        {m.length
          ? <Pill c="warn" semPonto title={`Falta: ${m.join(', ')}`}>Incompleto · {m.length}</Pill>
          : <span className="aloj-link">Abrir <ArrowRight size={14} /></span>}
      </div>
    </Link>
  );
}

export default function ListaAlojamentos() {
  const { base, carregando, erro, recarregar } = useBase();
  const acoes = useAcoes({ base, recarregar });

  // A situação fica na URL: é assim que o alerta "cadastros incompletos" manda
  // a pessoa para cá já com o filtro certo.
  const [params, setParams] = useSearchParams();
  const f = params.get('situacao') || 'operando';
  const setF = (v) => setParams(v === 'operando' ? {} : { situacao: v }, { replace: true });
  const [uf, setUf] = useState('');
  const [busca, setBusca] = useState('');
  const [exportando, setExportando] = useState(false);

  const todos = base.alojamentos;
  const incompleto = (a) => a.status === 'ativo' && missing(a).length > 0;
  const cnt = {
    operando: todos.filter(operando).length,
    ativo: todos.filter((a) => a.status === 'ativo').length,
    desmobilizacao: todos.filter((a) => a.status === 'desmobilizacao').length,
    inativo: todos.filter((a) => a.status === 'inativo').length,
    todos: todos.length,
    incompletos: todos.filter(incompleto).length,
  };
  const q = norm(busca).trim();
  const ufs = [...new Set(todos.map((a) => a.uf).filter(Boolean))].sort();
  const lista = alojs(base, (a) => {
    if (f === 'operando' && !operando(a)) return false;
    if (['ativo', 'desmobilizacao', 'inativo'].includes(f) && a.status !== f) return false;
    if (f === 'incompletos' && !incompleto(a)) return false;
    if (uf && a.uf !== uf) return false;
    if (q && !norm([a.nome, a.sigla, a.cidade, a.uf, a.endereco, a.centro_custo, a.gerente, a.projeto, a.proprietario_nome, a.imobiliaria_nome].join(' ')).includes(q)) return false;
    return true;
  });

  const exportar = async () => {
    setExportando(true);
    try {
      await exportarXlsx(base);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="aloj-page larga">
      <div className="aloj-head">
        <div>
          <h1>Alojamentos</h1>
          <p>{plural(todos.length, 'cadastro')} · {cnt.operando} em operação · {cnt.inativo} inativos</p>
        </div>
        <div className="aloj-acoes">
          <button type="button" className="aloj-btn" onClick={exportar} disabled={exportando || carregando}>
            <Download size={14} /> {exportando ? 'Gerando…' : 'Exportar Excel'}
          </button>
          <button type="button" className="aloj-btn primario" onClick={acoes.novoAlojamento}>
            <Plus size={14} /> Novo alojamento
          </button>
        </div>
      </div>

      <div className="aloj-toolbar">
        <div className="aloj-seg" role="group" aria-label="Filtrar por situação">
          {SEGMENTOS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{l}<span>{cnt[k]}</span></button>
          ))}
        </div>
        <label className="aloj-inline" htmlFor="aloj-uf">
          UF
          <select id="aloj-uf" value={uf} onChange={(e) => setUf(e.target.value)}>
            <option value="">Todas</option>
            {ufs.map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
        <label className="aloj-inline cresce" htmlFor="aloj-busca">
          <Search size={14} />
          <input
            id="aloj-busca"
            placeholder="Buscar por nome, cidade, endereço, gerente, CC…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
      </div>

      <Carga carregando={carregando} erro={erro}>
        {lista.length ? (
          <div className="aloj-grade">
            {lista.map((a) => <CartaoAloj key={a.id} a={a} base={base} />)}
          </div>
        ) : (
          <div className="aloj-card">
            <Vazio
              titulo={todos.length ? 'Nenhum alojamento neste filtro' : 'Nenhum alojamento cadastrado ainda'}
              texto={todos.length ? 'Ajuste os filtros ou a busca.' : 'Cadastre o primeiro alojamento para começar.'}
            >
              <button type="button" className="aloj-btn primario" onClick={acoes.novoAlojamento}><Plus size={14} /> Novo alojamento</button>
            </Vazio>
          </div>
        )}
      </Carga>
      <Dialogos acoes={acoes} />
    </div>
  );
}
