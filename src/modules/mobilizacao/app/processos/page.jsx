import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderKanban, Loader2, AlertCircle, FilePlus2, AlertTriangle, X,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  ehTimeMobilizacao, FLUXOS, rotuloFluxoCurto, STATUS_PROCESSO, MOSTRAR_RESPONSAVEL,
} from '../../../../config/mobilizacao';
import { semaforoPrazo } from '../../../../utils/semaforo';
import { listarProcessos } from '../../lib/mobilizacao';
import {
  progresso, filtrarProcessos, processoAtrasado, codigoCt,
} from '../../lib/painelEtapas';
import { tempoTotalDias, tempoTotalTexto } from '../../lib/tempoProcesso';
import { ordenarLinhas } from '../../lib/ordenacao';
import ThOrdena from '../components/ThOrdena';

const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');

const clienteObra = (p) => [p.cliente_phd, p.local_obra].filter(Boolean).join(' · ');

// O que cada coluna mostra, para ordenar pelo mesmo valor que se lê.
const COLUNAS = {
  numero: (p) => p.numero,
  processo: (p) => p.titulo,
  ct: codigoCt,
  fluxo: (p) => rotuloFluxoCurto(p.fluxo),
  cliente: clienteObra,
  progresso: (p) => progresso(p).pct,
  tempo: (p) => tempoTotalDias(p),
  responsavel: (p) => p.responsavelNome,
  prazo: (p) => p.prazo_em,
  situacao: (p) => STATUS_PROCESSO[p.status] || p.status,
};

export default function ProcessosMob() {
  const { modules } = useAuth();
  const souTime = ehTimeMobilizacao(modules);

  const [processos, setProcessos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [fFluxo, setFFluxo] = useState('');
  const [apenasAbertos, setApenasAbertos] = useState(true);
  const [busca, setBusca] = useState('');
  const [atrasados, setAtrasados] = useState(false);
  const [ordem, setOrdem] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setProcessos(await listarProcessos({ apenasAbertos, fluxo: fFluxo }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [apenasAbertos, fFluxo]);

  useEffect(() => { carregar(); }, [carregar]);

  // Busca e atraso filtram o que JA veio; fluxo e situacao vao na consulta,
  // porque mudam o RECORTE (encerrados sao muitos e nao se traz a toa).
  const visiveis = ordenarLinhas(filtrarProcessos(processos, { busca, atrasados }), ordem, COLUNAS);
  const filtrando = !!busca || atrasados;

  return (
    <div className="mob-page mob-page-wide">
      <h1 className="mob-title"><FolderKanban size={24} /> Processos</h1>
      <p className="mob-sub">
        Cada linha é uma mobilização inteira, com o quanto dela já andou. Clique para ver o passo a passo.
      </p>

      <div className="mob-filtros">
        <div className="mob-filtro" style={{ minWidth: 240 }}>
          <label htmlFor="mob-p-busca">Buscar</label>
          <input id="mob-p-busca" type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Pessoa, cliente, obra ou código" />
        </div>

        <div className="mob-filtro">
          <label htmlFor="mob-p-fluxo">Fluxo</label>
          <select id="mob-p-fluxo" value={fFluxo} onChange={(e) => setFFluxo(e.target.value)}>
            <option value="">Todos</option>
            {FLUXOS.map((f) => <option key={f.slug} value={f.slug}>{f.label}</option>)}
          </select>
        </div>

        <div className="mob-filtro">
          <label htmlFor="mob-p-sit">Situação</label>
          <select id="mob-p-sit" value={apenasAbertos ? 'abertos' : 'todos'}
            onChange={(e) => setApenasAbertos(e.target.value === 'abertos')}>
            <option value="abertos">Em andamento</option>
            {/* O histórico tem anos de planilha atrás e só interessa quando
                alguém procura por ele. */}
            <option value="todos">Todos, incluindo encerrados</option>
          </select>
        </div>

        <button type="button"
          className={`mob-btn mob-btn-sm mob-filtro-limpa ${atrasados ? 'mob-btn-primary' : 'mob-btn-ghost'}`}
          onClick={() => setAtrasados((a) => !a)}>
          <AlertTriangle size={15} /> Só os atrasados
        </button>

        {filtrando && (
          <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm mob-filtro-limpa"
            onClick={() => { setBusca(''); setAtrasados(false); }}>
            <X size={15} /> Limpar
          </button>
        )}

        {souTime && (
          <Link to="/mobilizacao/nova" className="mob-btn mob-btn-primary mob-btn-sm mob-filtro-limpa">
            <FilePlus2 size={15} /> Mobilizar empresa
          </Link>
        )}
      </div>

      {erro && <div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="mob-vazio"><Loader2 size={20} className="mob-spin" /> Carregando…</div>
      ) : !visiveis.length ? (
        <div className="mob-vazio">
          {filtrando ? 'Nenhum processo com esses filtros.' : 'Nenhum processo por aqui.'}
        </div>
      ) : (
        <div className="mob-tabela-scroll">
          <table className="mob-tabela">
            <thead>
              <tr>
                <ThOrdena coluna="numero" ordem={ordem} setOrdem={setOrdem}>#</ThOrdena>
                <ThOrdena coluna="processo" ordem={ordem} setOrdem={setOrdem}>Processo</ThOrdena>
                <ThOrdena coluna="ct" ordem={ordem} setOrdem={setOrdem}>Código CT</ThOrdena>
                <ThOrdena coluna="fluxo" ordem={ordem} setOrdem={setOrdem}>Fluxo</ThOrdena>
                <ThOrdena coluna="cliente" ordem={ordem} setOrdem={setOrdem}>Cliente / obra</ThOrdena>
                <ThOrdena coluna="progresso" ordem={ordem} setOrdem={setOrdem}>Progresso</ThOrdena>
                <ThOrdena coluna="tempo" ordem={ordem} setOrdem={setOrdem}>Tempo</ThOrdena>
                {MOSTRAR_RESPONSAVEL && (
                  <ThOrdena coluna="responsavel" ordem={ordem} setOrdem={setOrdem}>Responsável</ThOrdena>
                )}
                <ThOrdena coluna="prazo" ordem={ordem} setOrdem={setOrdem}>Prazo</ThOrdena>
                <ThOrdena coluna="situacao" ordem={ordem} setOrdem={setOrdem}>Situação</ThOrdena>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => {
                const pr = progresso(p);
                const atrasado = processoAtrasado(p);
                const tom = semaforoPrazo(p.prazo_em);
                return (
                  <tr key={p.id}>
                    <td className="num">{p.numero}</td>
                    <td><Link to={`/mobilizacao/processo/${p.id}`}>{p.titulo}</Link></td>
                    <td className="num">{codigoCt(p) || '—'}</td>
                    <td>{rotuloFluxoCurto(p.fluxo)}</td>
                    <td>{clienteObra(p) || '—'}</td>
                    <td>
                      <div className="mob-prog">
                        <div className="mob-prog-barra">
                          <div className="mob-prog-fill" style={{ width: `${pr.pct}%` }} />
                        </div>
                        <span className="mob-prog-txt">{pr.feitas}/{pr.total}</span>
                      </div>
                    </td>
                    {/* Dias corridos desde o começo — em andamento, conta até hoje. */}
                    <td className="num">{tempoTotalTexto(p)}</td>
                    {MOSTRAR_RESPONSAVEL && (
                      <td>{p.responsavelNome || <span className="mob-cartao-sem-dono">sem responsável</span>}</td>
                    )}
                    <td className="num">
                      {p.prazo_em
                        ? <span className={`mob-prazo tom-${atrasado ? 'vencido' : tom}`}>{dataBr(p.prazo_em)}</span>
                        : '—'}
                    </td>
                    <td><span className={`mob-pill tom-${p.status}`}>{STATUS_PROCESSO[p.status] || p.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
