import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Loader2, AlertCircle, Download, X, Info,
} from 'lucide-react';
import { listarProcessos } from '../../lib/mobilizacao';
import {
  situacaoPorPessoa, filtrarPessoas, centrosDeCusto, contarPorSituacao,
  SITUACAO, ORDEM_SITUACAO,
} from '../../lib/situacaoPessoas';

const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');

/**
 * Quem está mobilizado — a lista por PESSOA.
 *
 * A tela de Processos responde "como vai esta mobilização?"; esta responde
 * "quem está na obra hoje?", que é outra pergunta e não se tira da primeira:
 * quem passou por três obras aparece três vezes lá.
 *
 * A consulta traz TODOS os processos, inclusive encerrados, porque é
 * justamente o processo encerrado que diz que a pessoa está mobilizada. A
 * regra de derivação mora em lib/situacaoPessoas.js, testada à parte.
 */
export default function MobilizadosMob() {
  const [processos, setProcessos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');
  const [ct, setCt] = useState('');

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

  const linhas = useMemo(() => situacaoPorPessoa(processos), [processos]);
  const visiveis = useMemo(
    () => filtrarPessoas(linhas, { busca, situacao, ct }),
    [linhas, busca, situacao, ct]
  );
  const cts = useMemo(() => centrosDeCusto(linhas), [linhas]);
  const contagem = useMemo(() => contarPorSituacao(linhas), [linhas]);
  const filtrando = !!busca || !!situacao || !!ct;

  function exportar() {
    const cab = ['Nome', 'Situacao', 'Local da obra', 'CT', 'Gestor', 'Cliente', 'Contrato', 'Data base'];
    const linhasCsv = visiveis.map((l) => [
      l.nome, SITUACAO[l.situacao], l.local_obra, l.cod_ct, l.ger_phd,
      l.cliente_phd, l.contrato, dataBr(l.data_base),
    ]);
    const csv = [cab, ...linhasCsv]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    // BOM: sem ele o Excel em português abre os acentos errados.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mobilizados.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mob-page mob-page-wide">
      <h1 className="mob-title"><Users size={24} /> Quem está mobilizado</h1>
      <p className="mob-sub">
        Uma linha por pessoa, com a situação atual, a obra, o centro de custo e o gestor.
      </p>

      {erro && <div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {/* O aviso não é decoração: a base veio de uma planilha que só registrava
          entradas, então quem saiu antes do portal ainda aparece mobilizado.
          Publicar o número sem dizer isso seria entregar uma lista que parece
          exata e não é. */}
      <div className="mob-aviso tom-info">
        <Info size={16} />
        <span>
          A situação é calculada pelo último processo de cada pessoa. Quem saiu da obra sem que a
          <strong> desmobilização fosse registrada no portal</strong> continua aparecendo como
          mobilizado — a lista fica fiel conforme as saídas passem a ser registradas aqui.
        </span>
      </div>

      <div className="mob-ind-tiles" style={{ marginTop: 12 }}>
        {contagem.map((c) => (
          <button
            key={c.chave}
            type="button"
            className={`mob-ind-tile ${situacao === c.chave ? 'is-destaque' : ''}`}
            onClick={() => setSituacao(situacao === c.chave ? '' : c.chave)}
            aria-pressed={situacao === c.chave}
          >
            <span className="mob-ind-rot">{c.label}</span>
            <strong className="mob-ind-num">{c.total}</strong>
          </button>
        ))}
      </div>

      <div className="mob-filtros">
        <div className="mob-filtro" style={{ minWidth: 240 }}>
          <label htmlFor="mob-mz-busca">Buscar</label>
          <input id="mob-mz-busca" type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Pessoa, obra, gestor, cliente ou CT" />
        </div>

        <div className="mob-filtro">
          <label htmlFor="mob-mz-ct">Centro de custo</label>
          <select id="mob-mz-ct" value={ct} onChange={(e) => setCt(e.target.value)}>
            <option value="">Todos</option>
            {cts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="mob-filtro">
          <label htmlFor="mob-mz-sit">Situação</label>
          <select id="mob-mz-sit" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
            <option value="">Todas</option>
            {ORDEM_SITUACAO.map((s) => <option key={s} value={s}>{SITUACAO[s]}</option>)}
          </select>
        </div>

        {filtrando && (
          <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm mob-filtro-limpa"
            onClick={() => { setBusca(''); setSituacao(''); setCt(''); }}>
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
          {filtrando ? 'Ninguém com esses filtros.' : 'Nenhuma pessoa mobilizada ainda.'}
        </div>
      ) : (
        <div className="mob-tabela-scroll">
          <table className="mob-tabela">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Situação</th>
                <th>Local da obra</th>
                <th>CT</th>
                <th>Gestor</th>
                <th>Cliente</th>
                <th>Desde</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={l.chave}>
                  <td>
                    <Link to={`/mobilizacao/processo/${l.processoId}`}>{l.nome || '—'}</Link>
                    {/* Quem já passou por mais de uma obra: sem isto, a linha
                        parece a história inteira da pessoa, e é só a última. */}
                    {l.processos > 1 && (
                      <span className="mob-campo-dica"> · {l.processos} processos</span>
                    )}
                  </td>
                  <td><span className={`mob-pill tom-sit-${l.situacao}`}>{SITUACAO[l.situacao]}</span></td>
                  <td>{l.local_obra || '—'}</td>
                  <td className="num">{l.cod_ct || '—'}</td>
                  <td>{l.ger_phd || '—'}</td>
                  <td>{l.cliente_phd || '—'}</td>
                  <td className="num">{dataBr(l.data_base)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
