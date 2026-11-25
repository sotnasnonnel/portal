import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  History, Loader2, AlertCircle, Download, X, UserRound,
} from 'lucide-react';
import { STATUS_PROCESSO } from '../../../../config/mobilizacao';
import { listarProcessos } from '../../lib/mobilizacao';
import { SITUACAO } from '../../lib/situacaoPessoas';
import {
  movimentosDePessoas, filtrarMovimentos, opcoes, resumoMovimentos, TIPO,
} from '../../lib/historicoPessoas';
import { ordenarLinhas } from '../../lib/ordenacao';
import ThOrdena from '../components/ThOrdena';

const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');

// O que cada coluna mostra, para ordenar pelo mesmo valor que se lê.
const COLUNAS = {
  data: (l) => l.data,
  pessoa: (l) => l.nome,
  tipo: (l) => TIPO[l.tipo],
  status: (l) => STATUS_PROCESSO[l.status] || l.status,
  obra: (l) => l.local_obra,
  ct: (l) => l.cod_ct,
  cliente: (l) => l.cliente_phd,
  gestor: (l) => l.ger_phd,
  origem: (l) => l.origem,
  hoje: (l) => SITUACAO[l.situacaoAtual],
};

const FILTROS_VAZIOS = {
  busca: '', tipo: '', status: '', ct: '', cliente: '', de: '', ate: '', pessoa: '',
};

/**
 * Histórico de Mob / Desmob — todas as entradas e saídas de cada pessoa.
 *
 * Complementa "Quem está mobilizado" (o estado de hoje): aqui cada movimento é
 * uma linha. Clicar no nome filtra a trajetória inteira daquela pessoa. A regra
 * mora em lib/historicoPessoas.js, testada à parte.
 */
export default function HistoricoMob() {
  const [processos, setProcessos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [f, setF] = useState(FILTROS_VAZIOS);
  const [ordem, setOrdem] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setProcessos(await listarProcessos({ apenasAbertos: false }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const linhas = useMemo(() => movimentosDePessoas(processos), [processos]);
  const filtradas = useMemo(() => filtrarMovimentos(linhas, f), [linhas, f]);
  const visiveis = useMemo(() => ordenarLinhas(filtradas, ordem, COLUNAS), [filtradas, ordem]);
  const resumo = useMemo(() => resumoMovimentos(filtradas), [filtradas]);
  const cts = useMemo(() => opcoes(linhas, 'cod_ct'), [linhas]);
  const clientes = useMemo(() => opcoes(linhas, 'cliente_phd'), [linhas]);
  const nomePessoa = f.pessoa ? (linhas.find((l) => l.chave === f.pessoa)?.nome || '') : '';
  const filtrando = Object.entries(f).some(([k, v]) => v !== FILTROS_VAZIOS[k]);

  const mudar = (campo) => (e) => setF((x) => ({ ...x, [campo]: e.target.value }));

  function exportar() {
    const cab = ['Data', 'Pessoa', 'Movimento', 'Situacao do processo', 'Local da obra', 'CT',
      'Cliente', 'Gestor', 'Coordenador', 'Origem', 'Situacao hoje', 'Processo'];
    const linhasCsv = visiveis.map((l) => [
      dataBr(l.data), l.nome, TIPO[l.tipo], STATUS_PROCESSO[l.status] || l.status, l.local_obra,
      l.cod_ct, l.cliente_phd, l.ger_phd, l.coo_phd, l.origem, SITUACAO[l.situacaoAtual] || '', l.numero,
    ]);
    const csv = [cab, ...linhasCsv]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    // BOM: sem ele o Excel em português abre os acentos errados.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'historico-mob-desmob.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const tiles = [
    { chave: '', label: 'Movimentos', total: resumo.total },
    { chave: 'mobilizacao', label: 'Mobilizações', total: resumo.mobilizacoes },
    { chave: 'desmobilizacao', label: 'Desmobilizações', total: resumo.desmobilizacoes },
  ];

  return (
    <div className="mob-page mob-page-wide">
      <h1 className="mob-title"><History size={24} /> Histórico Mob / Desmob</h1>
      <p className="mob-sub">
        Cada entrada e cada saída de cada pessoa, da planilha antiga e do portal. Clique no nome
        para ver a trajetória inteira de alguém.
      </p>

      {erro && <div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      <div className="mob-ind-tiles" style={{ marginTop: 12 }}>
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            className={`mob-ind-tile ${f.tipo === t.chave && t.chave ? 'is-destaque' : ''}`}
            onClick={() => setF((x) => ({ ...x, tipo: x.tipo === t.chave ? '' : t.chave }))}
            aria-pressed={!!t.chave && f.tipo === t.chave}
          >
            <span className="mob-ind-rot">{t.label}</span>
            <strong className="mob-ind-num">{t.total}</strong>
          </button>
        ))}
        <div className="mob-ind-tile">
          <span className="mob-ind-rot">Pessoas</span>
          <strong className="mob-ind-num">{resumo.pessoas}</strong>
        </div>
      </div>

      {f.pessoa && (
        <div className="mob-aviso tom-info">
          <UserRound size={16} />
          <span>Trajetória de <strong>{nomePessoa}</strong></span>
          <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm"
            onClick={() => setF((x) => ({ ...x, pessoa: '' }))}>
            <X size={15} /> Ver todos
          </button>
        </div>
      )}

      <div className="mob-filtros">
        <div className="mob-filtro" style={{ minWidth: 220 }}>
          <label htmlFor="mob-h-busca">Buscar</label>
          <input id="mob-h-busca" type="text" value={f.busca} onChange={mudar('busca')}
            placeholder="Pessoa, obra, CT, cliente ou gestor" />
        </div>

        <div className="mob-filtro">
          <label htmlFor="mob-h-tipo">Movimento</label>
          <select id="mob-h-tipo" value={f.tipo} onChange={mudar('tipo')}>
            <option value="">Todos</option>
            {Object.entries(TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div className="mob-filtro">
          <label htmlFor="mob-h-status">Situação do processo</label>
          <select id="mob-h-status" value={f.status} onChange={mudar('status')}>
            {/* Cancelado não aconteceu: fica fora até alguém pedir por ele. */}
            <option value="">Todos, menos cancelados</option>
            {Object.entries(STATUS_PROCESSO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            <option value="todos">Todos, com cancelados</option>
          </select>
        </div>

        <div className="mob-filtro">
          <label htmlFor="mob-h-ct">Centro de custo</label>
          <select id="mob-h-ct" value={f.ct} onChange={mudar('ct')}>
            <option value="">Todos</option>
            {cts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="mob-filtro">
          <label htmlFor="mob-h-cli">Cliente</label>
          <select id="mob-h-cli" value={f.cliente} onChange={mudar('cliente')}>
            <option value="">Todos</option>
            {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="mob-filtro">
          <label htmlFor="mob-h-de">De</label>
          <input id="mob-h-de" type="date" value={f.de} onChange={mudar('de')} />
        </div>

        <div className="mob-filtro">
          <label htmlFor="mob-h-ate">Até</label>
          <input id="mob-h-ate" type="date" value={f.ate} onChange={mudar('ate')} />
        </div>

        {filtrando && (
          <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm mob-filtro-limpa"
            onClick={() => setF(FILTROS_VAZIOS)}>
            <X size={15} /> Limpar
          </button>
        )}

        <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm mob-filtro-limpa"
          onClick={exportar} disabled={!visiveis.length}>
          <Download size={15} /> Exportar CSV
        </button>
      </div>

      {carregando ? (
        <div className="mob-vazio"><Loader2 size={20} className="mob-spin" /> Carregando…</div>
      ) : !visiveis.length ? (
        <div className="mob-vazio">
          {filtrando ? 'Nenhum movimento com esses filtros.' : 'Nenhum movimento registrado ainda.'}
        </div>
      ) : (
        <div className="mob-tabela-scroll">
          <table className="mob-tabela">
            <thead>
              <tr>
                <ThOrdena coluna="data" ordem={ordem} setOrdem={setOrdem}>Data</ThOrdena>
                <ThOrdena coluna="pessoa" ordem={ordem} setOrdem={setOrdem}>Pessoa</ThOrdena>
                <ThOrdena coluna="tipo" ordem={ordem} setOrdem={setOrdem}>Movimento</ThOrdena>
                <ThOrdena coluna="obra" ordem={ordem} setOrdem={setOrdem}>Local da obra</ThOrdena>
                <ThOrdena coluna="ct" ordem={ordem} setOrdem={setOrdem}>CT</ThOrdena>
                <ThOrdena coluna="cliente" ordem={ordem} setOrdem={setOrdem}>Cliente</ThOrdena>
                <ThOrdena coluna="gestor" ordem={ordem} setOrdem={setOrdem}>Gestor</ThOrdena>
                <ThOrdena coluna="status" ordem={ordem} setOrdem={setOrdem}>Processo</ThOrdena>
                <ThOrdena coluna="origem" ordem={ordem} setOrdem={setOrdem}>Origem</ThOrdena>
                <ThOrdena coluna="hoje" ordem={ordem} setOrdem={setOrdem}>Hoje</ThOrdena>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={l.id}>
                  <td className="num">{dataBr(l.data)}</td>
                  <td>
                    <button type="button" className="mob-link-btn"
                      onClick={() => setF((x) => ({ ...x, pessoa: l.chave }))}
                      title="Ver a trajetória desta pessoa">
                      {l.nome || '—'}
                    </button>
                    {l.movimentos > 1 && !f.pessoa && (
                      <span className="mob-campo-dica"> · {l.movimentos} movimentos</span>
                    )}
                  </td>
                  <td>
                    <Link to={`/mobilizacao/processo/${l.id}`} title="Abrir o processo">
                      {TIPO[l.tipo]}
                    </Link>
                  </td>
                  <td>{l.local_obra || '—'}</td>
                  <td className="num">{l.cod_ct || '—'}</td>
                  <td>{l.cliente_phd || '—'}</td>
                  <td>{l.ger_phd || '—'}</td>
                  <td><span className={`mob-pill tom-${l.status}`}>{STATUS_PROCESSO[l.status] || l.status}</span></td>
                  <td>{l.origem}</td>
                  <td>
                    {l.situacaoAtual
                      ? <span className={`mob-pill tom-sit-${l.situacaoAtual}`}>{SITUACAO[l.situacaoAtual]}</span>
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
