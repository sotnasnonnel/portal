import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Loader2, AlertCircle, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { ehTimeMobilizacao, FLUXOS, rotuloFluxoCurto } from '../../../../config/mobilizacao';
import { semaforoDias } from '../../../../utils/semaforo';
import { listarEtapasDoQuadro } from '../../lib/mobilizacao';
import { filtrarFila, opcoesDaFila } from '../../lib/painelEtapas';
import { rotuloStatus, STATUS_LABEL } from '../../lib/statusEtapa';

const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

const FILTRO_VAZIO = {
  busca: '', fluxo: '', status: '', responsavelId: '', atrasadas: false, incluirEncerradas: false,
};

export default function FilaMob() {
  const { user, modules } = useAuth();
  const souTime = ehTimeMobilizacao(modules);

  const [etapas, setEtapas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [f, setF] = useState(FILTRO_VAZIO);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setEtapas(await listarEtapasDoQuadro({}));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const opcoes = opcoesDaFila(etapas);
  const visiveis = filtrarFila(etapas, f);
  const filtrando = JSON.stringify(f) !== JSON.stringify(FILTRO_VAZIO);
  const trocar = (campo) => (ev) => setF((a) => ({ ...a, [campo]: ev.target.value }));

  return (
    <div className="mob-page mob-page-wide">
      <h1 className="mob-title"><ListChecks size={24} /> Etapas</h1>
      <p className="mob-sub">
        O mesmo conteúdo do quadro em lista, para conferir o que falta sem arrastar nada.
        {souTime ? '' : ' Você enxerga as etapas dos processos em que está envolvido.'}
      </p>

      <div className="mob-filtros">
        <div className="mob-filtro" style={{ minWidth: 220 }}>
          <label htmlFor="mob-f-busca">Buscar</label>
          <input id="mob-f-busca" type="text" value={f.busca} onChange={trocar('busca')}
            placeholder="Etapa ou profissional" />
        </div>

        <div className="mob-filtro">
          <label htmlFor="mob-f-fluxo">Fluxo</label>
          <select id="mob-f-fluxo" value={f.fluxo} onChange={trocar('fluxo')}>
            <option value="">Todos</option>
            {FLUXOS.map((x) => <option key={x.slug} value={x.slug}>{x.label}</option>)}
          </select>
        </div>

        <div className="mob-filtro">
          <label htmlFor="mob-f-status">Situação</label>
          <select id="mob-f-status" value={f.status} onChange={trocar('status')}>
            <option value="">Em aberto</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div className="mob-filtro">
          <label htmlFor="mob-f-resp">Responsável</label>
          <select id="mob-f-resp" value={f.responsavelId} onChange={trocar('responsavelId')}>
            <option value="">Todos</option>
            {user?.id && <option value={user.id}>Eu</option>}
            {opcoes.temSemResponsavel && <option value="sem">Sem responsável</option>}
            {opcoes.responsaveis.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <button type="button"
          className={`mob-btn mob-btn-sm mob-filtro-limpa ${f.atrasadas ? 'mob-btn-primary' : 'mob-btn-ghost'}`}
          onClick={() => setF((a) => ({ ...a, atrasadas: !a.atrasadas }))}>
          <AlertTriangle size={15} /> Só as atrasadas
        </button>

        {filtrando && (
          <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm mob-filtro-limpa"
            onClick={() => setF(FILTRO_VAZIO)}>
            <X size={15} /> Limpar
          </button>
        )}
      </div>

      {filtrando && (
        <p className="mob-campo-dica">Mostrando {visiveis.length} de {etapas.length} etapas.</p>
      )}

      {erro && <div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="mob-vazio"><Loader2 size={20} className="mob-spin" /> Carregando…</div>
      ) : !visiveis.length ? (
        <div className="mob-vazio">Nenhuma etapa com esses filtros.</div>
      ) : (
        <div className="mob-tabela-scroll">
          <table className="mob-tabela">
            <thead>
              <tr>
                <th>#</th>
                <th>Etapa</th>
                <th>Processo</th>
                <th>Fluxo</th>
                <th>Responsável</th>
                <th>Situação</th>
                <th>Previsto</th>
                <th>Real</th>
                <th className="num">Atraso</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((e) => {
                const tom = semaforoDias(e.dias_atraso);
                return (
                  <tr key={e.id}>
                    <td className="num">{e.numero}</td>
                    <td>
                      <Link to={`/mobilizacao/processo/${e.processo_id}`}>{e.titulo}</Link>
                    </td>
                    <td>{e.processoTitulo}</td>
                    <td>{rotuloFluxoCurto(e.fluxo)}</td>
                    <td>{e.responsavelNome || <span className="mob-cartao-sem-dono">sem responsável</span>}</td>
                    <td>{rotuloStatus(e.status)}</td>
                    <td className="num">{dataBr(e.data_prevista)}</td>
                    <td className="num">{dataBr(e.data_real)}</td>
                    <td className={`num ${tom === 'vencido' ? 'is-vencido' : ''}`}>
                      {e.dias_atraso === null || e.dias_atraso === undefined
                        ? '—'
                        : `${e.dias_atraso > 0 ? '+' : ''}${e.dias_atraso}d`}
                    </td>
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
