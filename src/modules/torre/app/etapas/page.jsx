import { useCallback, useEffect, useState } from 'react';
import { ListChecks, Loader2, AlertCircle, X, AlertTriangle, Eye } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { FLUXOS, rotuloFluxoCurto } from '../../../../config/mobilizacao';
import { semaforoDias } from '../../../../utils/semaforo';
import { listarEtapasDoQuadro } from '../../../mobilizacao/lib/mobilizacao';
import { filtrarFila, opcoesDaFila } from '../../../mobilizacao/lib/painelEtapas';
import { rotuloStatus, STATUS_LABEL } from '../../../mobilizacao/lib/statusEtapa';

const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

const VAZIO = {
  busca: '', fluxo: '', status: '', responsavelId: '', atrasadas: false, incluirEncerradas: false,
};

/**
 * Etapas da Torre — a mesma lista de /mobilizacao/fila, sem ação nenhuma.
 *
 * Reusa filtrarFila e opcoesDaFila da Mobilização: são as mesmas perguntas
 * ("o que é meu", "o que está atrasado"), e duas cópias divergiriam.
 *
 * O RECORTE é da RLS — cada um vê as etapas dos processos em que está
 * envolvido —, e é por isso que o filtro por nome é o eixo da reunião: o
 * responsável seleciona o próprio nome e apresenta a sua parte.
 */
export default function EtapasTorre() {
  const { user } = useAuth();
  const [etapas, setEtapas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [f, setF] = useState(VAZIO);

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
  const filtrando = JSON.stringify(f) !== JSON.stringify(VAZIO);
  const trocar = (campo) => (ev) => setF((a) => ({ ...a, [campo]: ev.target.value }));

  return (
    <div className="mob-page mob-page-wide">
      <h1 className="mob-title"><ListChecks size={24} /> Etapas</h1>
      <p className="mob-sub">
        O passo a passo das mobilizações em lista, para conferir item a item durante a reunião.
      </p>
      <p className="tor-nota">
        <Eye size={14} /> Tela de consulta: nada aqui pode ser alterado.
      </p>

      <div className="mob-filtros">
        {/* O filtro por nome é o eixo da reunião: cada responsável seleciona o
            próprio e apresenta a sua parte. */}
        <div className="mob-filtro">
          <label htmlFor="tor-e-resp">Responsável</label>
          <select id="tor-e-resp" value={f.responsavelId} onChange={trocar('responsavelId')}>
            <option value="">Todos</option>
            {user?.id && <option value={user.id}>Eu</option>}
            {opcoes.temSemResponsavel && <option value="sem">Sem responsável</option>}
            {opcoes.responsaveis.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div className="mob-filtro" style={{ minWidth: 220 }}>
          <label htmlFor="tor-e-busca">Buscar</label>
          <input id="tor-e-busca" type="text" value={f.busca} onChange={trocar('busca')}
            placeholder="Etapa ou profissional" />
        </div>

        <div className="mob-filtro">
          <label htmlFor="tor-e-fluxo">Fluxo</label>
          <select id="tor-e-fluxo" value={f.fluxo} onChange={trocar('fluxo')}>
            <option value="">Todos</option>
            {FLUXOS.map((x) => <option key={x.slug} value={x.slug}>{x.label}</option>)}
          </select>
        </div>

        <div className="mob-filtro">
          <label htmlFor="tor-e-status">Situação</label>
          <select id="tor-e-status" value={f.status} onChange={trocar('status')}>
            <option value="">Em aberto</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <button type="button"
          className={`mob-btn mob-btn-sm mob-filtro-limpa ${f.atrasadas ? 'mob-btn-primary' : 'mob-btn-ghost'}`}
          onClick={() => setF((a) => ({ ...a, atrasadas: !a.atrasadas }))}>
          <AlertTriangle size={15} /> Só as atrasadas
        </button>

        {filtrando && (
          <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm mob-filtro-limpa"
            onClick={() => setF(VAZIO)}>
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
        <div className="mob-vazio">
          {filtrando
            ? 'Nenhuma etapa com esses filtros.'
            : 'Nenhuma etapa no seu nome. Você enxerga os processos em que está envolvido.'}
        </div>
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
                    <td>{e.titulo}</td>
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
