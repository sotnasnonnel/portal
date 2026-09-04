import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radar, Loader2, AlertCircle, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { ehTimeMobilizacao } from '../../../../config/mobilizacao';
import { STATUS_LABEL as STATUS_ADM } from '../../../administrativo/lib/statusChamado';
import { listarTorre, listarFalhasGatilho, reprocessarChamado } from '../../lib/mobilizacao';
import {
  agruparTorre, linkDoItem, filtrarTorre, opcoesDaTorre, estaVencido, ROTULO_ORIGEM,
} from '../../lib/torre';
import { rotuloStatus } from '../../lib/statusEtapa';
import { iniciais } from '../../lib/painelEtapas';

const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : 'sem prazo');

const rotulo = (item) => (item.origem === 'adm'
  ? (STATUS_ADM[item.status] || item.status)
  : rotuloStatus(item.status));

const VAZIO = { origem: '', responsavelId: '', cc: '', atrasados: false };

export default function TorreMob() {
  const { modules } = useAuth();
  const souTime = ehTimeMobilizacao(modules);

  const [itens, setItens] = useState([]);
  const [falhas, setFalhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [f, setF] = useState(VAZIO);
  const [reprocessando, setReprocessando] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setItens(await listarTorre());
      // Falhas do gatilho só interessam a quem pode consertá-las, e a policy
      // já barra o resto — mas evitar a consulta poupa um 403 no console.
      if (souTime) setFalhas(await listarFalhasGatilho().catch(() => []));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [souTime]);

  useEffect(() => { carregar(); }, [carregar]);

  const opcoes = opcoesDaTorre(itens);
  const visiveis = filtrarTorre(itens, f);
  const colunas = agruparTorre(visiveis);
  const filtrando = JSON.stringify(f) !== JSON.stringify(VAZIO);
  const trocar = (campo) => (ev) => setF((a) => ({ ...a, [campo]: ev.target.value }));

  const reprocessar = async (chamadoId) => {
    setReprocessando(chamadoId);
    setErro('');
    try {
      await reprocessarChamado(chamadoId);
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setReprocessando('');
    }
  };

  return (
    <div className="mob-page mob-page-full">
      <h1 className="mob-title"><Radar size={24} /> Torre de controle</h1>
      <p className="mob-sub">
        Os chamados do Administrativo e as etapas de Mobilização num quadro só. É visão —
        para agir, clique e vá ao módulo de origem.
      </p>

      {/* O gatilho engole o erro para nunca impedir a abertura de um chamado.
          O preço é este aviso: sem ele, o processo simplesmente não existiria e
          ninguém perceberia. */}
      {falhas.length > 0 && (
        <div className="mob-aviso tom-alerta">
          <AlertTriangle size={16} />
          <span>
            <strong>{falhas.length} chamado(s) de mobilização não geraram processo.</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {falhas.map((x) => (
                <li key={x.id} style={{ marginBottom: 4 }}>
                  <Link to={`/administrativo/chamado/${x.chamado_id}`}>chamado</Link> — {x.erro}{' '}
                  <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm"
                    disabled={reprocessando === x.chamado_id}
                    onClick={() => reprocessar(x.chamado_id)}>
                    <RefreshCw size={12} /> Reprocessar
                  </button>
                </li>
              ))}
            </ul>
          </span>
        </div>
      )}

      <div className="mob-filtros">
        <div className="mob-filtro">
          <label htmlFor="mob-t-origem">Origem</label>
          <select id="mob-t-origem" value={f.origem} onChange={trocar('origem')}>
            <option value="">Tudo</option>
            <option value="adm">Chamados do Administrativo</option>
            <option value="mobilizacao">Etapas de Mobilização</option>
          </select>
        </div>

        <div className="mob-filtro">
          <label htmlFor="mob-t-resp">Responsável</label>
          <select id="mob-t-resp" value={f.responsavelId} onChange={trocar('responsavelId')}>
            <option value="">Todos</option>
            <option value="sem">Sem responsável</option>
            {opcoes.responsaveis.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {/* O CC é o que amarra chamado e mobilização de um mesmo projeto, mesmo
            vindo de módulos diferentes. */}
        <div className="mob-filtro">
          <label htmlFor="mob-t-cc">Centro de custo</label>
          <select id="mob-t-cc" value={f.cc} onChange={trocar('cc')}>
            <option value="">Todos</option>
            {opcoes.ccs.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <button type="button"
          className={`mob-btn mob-btn-sm mob-filtro-limpa ${f.atrasados ? 'mob-btn-primary' : 'mob-btn-ghost'}`}
          onClick={() => setF((a) => ({ ...a, atrasados: !a.atrasados }))}>
          <AlertTriangle size={15} /> Só os vencidos
        </button>

        {filtrando && (
          <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm mob-filtro-limpa"
            onClick={() => setF(VAZIO)}>
            <X size={15} /> Limpar
          </button>
        )}
      </div>

      {erro && <div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="mob-vazio"><Loader2 size={20} className="mob-spin" /> Carregando…</div>
      ) : (
        <div className="mob-quadro">
          {colunas.map((col) => (
            <section key={col.chave} className="mob-col">
              <header className="mob-col-cab">
                <h2>{col.titulo}</h2>
                <span className="mob-col-cont">{col.itens.length}</span>
              </header>
              <div className="mob-col-corpo">
                {!col.itens.length && <p className="mob-col-vazia">—</p>}
                {col.itens.map((i) => (
                  <Link key={`${i.origem}-${i.id}`} to={linkDoItem(i)} className="mob-cartao is-clicavel">
                    <div className="mob-cartao-topo">
                      <span className={`mob-torre-origem origem-${i.origem}`}>{ROTULO_ORIGEM[i.origem]}</span>
                      <span className="mob-cartao-num">#{i.numero}</span>
                    </div>
                    <strong className="mob-cartao-titulo">{i.titulo}</strong>
                    <span className="mob-cartao-proc">{rotulo(i)}{i.cc ? ` · ${i.cc}` : ''}</span>
                    <div className="mob-cartao-rodape">
                      {i.responsavelNome ? (
                        <span className="mob-cartao-dono" title={i.responsavelNome}>{iniciais(i.responsavelNome)}</span>
                      ) : (
                        <span className="mob-cartao-sem-dono">sem responsável</span>
                      )}
                      <span className={`mob-prazo ${estaVencido(i) ? 'tom-vencido' : 'tom-ok'}`}>
                        {dataBr(i.prazo)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!carregando && !visiveis.length && (
        <p className="mob-campo-dica">Nada em aberto com esses filtros.</p>
      )}
    </div>
  );
}
