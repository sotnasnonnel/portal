import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Loader2, AlertCircle, FilePlus2 } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  ehTimeMobilizacao, FLUXOS, rotuloFluxoCurto, STATUS_PROCESSO,
} from '../../../../config/mobilizacao';
import { semaforoPrazo } from '../../../../utils/semaforo';
import { listarProcessos } from '../../lib/mobilizacao';
import { progresso } from '../../lib/painelEtapas';

const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');

export default function ProcessosMob() {
  const { modules } = useAuth();
  const souTime = ehTimeMobilizacao(modules);

  const [processos, setProcessos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [fFluxo, setFFluxo] = useState('');
  const [apenasAbertos, setApenasAbertos] = useState(true);

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

  return (
    <div className="mob-page mob-page-wide">
      <h1 className="mob-title"><FolderKanban size={24} /> Processos</h1>
      <p className="mob-sub">
        Cada linha é uma mobilização inteira, com o quanto dela já andou. Clique para ver o passo a passo.
      </p>

      <div className="mob-filtros">
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

        {souTime && (
          <Link to="/mobilizacao/nova" className="mob-btn mob-btn-primary mob-btn-sm mob-filtro-limpa">
            <FilePlus2 size={15} /> Abrir processo
          </Link>
        )}
      </div>

      {erro && <div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="mob-vazio"><Loader2 size={20} className="mob-spin" /> Carregando…</div>
      ) : !processos.length ? (
        <div className="mob-vazio">Nenhum processo por aqui.</div>
      ) : (
        <div className="mob-tabela-scroll">
          <table className="mob-tabela">
            <thead>
              <tr>
                <th>#</th>
                <th>Processo</th>
                <th>Fluxo</th>
                <th>Cliente / obra</th>
                <th>Progresso</th>
                <th>Responsável</th>
                <th>Prazo</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {processos.map((p) => {
                const pr = progresso(p);
                const tom = semaforoPrazo(p.prazo_em);
                return (
                  <tr key={p.id}>
                    <td className="num">{p.numero}</td>
                    <td><Link to={`/mobilizacao/processo/${p.id}`}>{p.titulo}</Link></td>
                    <td>{rotuloFluxoCurto(p.fluxo)}</td>
                    <td>{[p.cliente_phd, p.local_obra].filter(Boolean).join(' · ') || '—'}</td>
                    <td>
                      <div className="mob-prog">
                        <div className="mob-prog-barra">
                          <div className="mob-prog-fill" style={{ width: `${pr.pct}%` }} />
                        </div>
                        <span className="mob-prog-txt">{pr.feitas}/{pr.total}</span>
                      </div>
                    </td>
                    <td>{p.responsavelNome || <span className="mob-cartao-sem-dono">sem responsável</span>}</td>
                    <td className="num">
                      {p.prazo_em
                        ? <span className={`mob-prazo tom-${tom}`}>{dataBr(p.prazo_em)}</span>
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
