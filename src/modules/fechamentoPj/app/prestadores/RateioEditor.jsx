import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Pencil, Network, AlertTriangle } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Aviso, Vazio } from '../components/ui';
import { dataHoraBr, fmtNum, paraNumero, round2 } from '../../lib/formato';
import { salvarRateio, auditar } from '../../lib/dados';
import { rateiosDoPrestador, situacaoRateio, ROTA_CONFIGURACOES, ROTA_FOLHA } from './comum';

/** Rateio fixo do prestador por centro de custo, com edição manual. */
export default function RateioEditor({ prestador, temEnvelopeAberto, onImportar }) {
  const { rateios = [], centros = [], centrosMapa, recarregar, notificar } = useFechamentoPj();
  const atuais = rateiosDoPrestador(rateios, prestador.id);
  const situacao = situacaoRateio(atuais, centrosMapa);
  const [itens, setItens] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const editando = itens !== null;

  const editar = () => {
    setErro('');
    setItens(atuais.length
      ? atuais.map((r) => ({ cod_ct: r.cod_ct, percentual: fmtNum(r.percentual) }))
      : [{ cod_ct: '', percentual: '100,00' }]);
  };
  const alterar = (i, campo, valor) => setItens((l) => l.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)));
  const total = editando ? round2(itens.reduce((s, it) => s + paraNumero(it.percentual), 0)) : situacao.total;

  function validar() {
    const vistos = new Set();
    for (const it of itens) {
      const cc = it.cod_ct.trim();
      const pct = paraNumero(it.percentual);
      if (!cc) return 'Informe o COD CT de todas as linhas.';
      if (vistos.has(cc)) return `O centro ${cc} aparece mais de uma vez.`;
      vistos.add(cc);
      if (!(pct > 0 && pct <= 100)) return `Percentual inválido em ${cc}: use um valor entre 0 e 100.`;
    }
    if (itens.length && Math.abs(total - 100) > 0.01) return `O rateio precisa somar 100% (hoje soma ${fmtNum(total)}%).`;
    return null;
  }

  async function salvar() {
    const problema = validar();
    if (problema) { setErro(problema); return; }
    setErro('');
    setSalvando(true);
    try {
      const lista = itens.map((it) => ({ cod_ct: it.cod_ct.trim(), percentual: paraNumero(it.percentual) }));
      await salvarRateio(prestador.id, lista, 'Manual');
      await auditar('Rateio do prestador atualizado',
        `${prestador.nome} • ${lista.map((i) => `${i.cod_ct} ${fmtNum(i.percentual)}%`).join(' + ') || 'sem rateio'}`,
        { prestadorId: prestador.id });
      await recarregar();
      setItens(null);
      notificar('Rateio salvo.');
    } catch (e) {
      setErro(e.message || 'Não foi possível salvar o rateio.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="pjp-painel">
      <div className="pj-toolbar">
        <div className="pjp-subtotal">
          <b>Total: <span className={Math.abs(total - 100) <= 0.01 ? 'pjp-ok' : 'pjp-erro-icone'}>{fmtNum(total)} %</span></b>
          {!editando && atuais[0] && <span className="pj-sub">Origem: {atuais[0].origem}</span>}
        </div>
        <div className="pj-toolbar-direita">
          {editando ? (
            <>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setItens((l) => [...l, { cod_ct: '', percentual: '' }])} disabled={salvando}>
                <Plus size={14} /> Linha
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setItens(null); setErro(''); }} disabled={salvando}>Cancelar</button>
              <button type="button" className="btn btn-sm btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar rateio'}</button>
            </>
          ) : (
            <>
              {onImportar && (
                <button type="button" className="btn btn-sm btn-outline" onClick={onImportar}><Network size={14} /> Importar organograma</button>
              )}
              <button type="button" className="btn btn-sm btn-outline" onClick={editar}><Pencil size={14} /> Editar rateio</button>
            </>
          )}
        </div>
      </div>

      {situacao.semRm.length > 0 && !editando && (
        <Aviso tipo="alerta">
          Centro(s) sem código RM: {situacao.semRm.join(', ')}. Preencha o de-para em <Link to={ROTA_CONFIGURACOES}>Configurações</Link>.
        </Aviso>
      )}

      {editando ? (
        <div className="table-scroll">
          <datalist id="pjp-centros">
            {centros.map((c) => <option key={c.cod_ct} value={c.cod_ct}>{c.codigo_rm || 'sem código RM'}</option>)}
          </datalist>
          <table className="data-table">
            <thead><tr><th>COD CT</th><th>Código RM</th><th className="pj-direita">Percentual</th><th /></tr></thead>
            <tbody>
              {itens.map((it, i) => (
                <tr key={i}>
                  <td><input className="form-input pjp-input-cc" list="pjp-centros" value={it.cod_ct} onChange={(e) => alterar(i, 'cod_ct', e.target.value)} aria-label="COD CT" /></td>
                  <td>{centrosMapa[it.cod_ct.trim()] || <span className="pjp-muted">sem código RM</span>}</td>
                  <td className="pj-direita">
                    <input className="form-input pjp-input-pct" inputMode="decimal" value={it.percentual} onChange={(e) => alterar(i, 'percentual', e.target.value)} aria-label="Percentual" />
                  </td>
                  <td className="pj-direita">
                    <button type="button" className="btn-icon" title="Remover linha" onClick={() => setItens((l) => l.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : atuais.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>COD CT</th><th>Código RM</th><th className="pj-direita">Percentual</th><th>Origem</th><th>Importado em</th></tr></thead>
            <tbody>
              {atuais.map((r) => (
                <tr key={r.id}>
                  <td>{r.cod_ct}</td>
                  <td>
                    {centrosMapa[r.cod_ct] || (
                      <Link to={ROTA_CONFIGURACOES} className="pjp-muted"><AlertTriangle size={14} className="pjp-alerta-icone" /> sem código RM</Link>
                    )}
                  </td>
                  <td className="pj-direita pj-num">{fmtNum(r.percentual)} %</td>
                  <td>{r.origem}</td>
                  <td className="pjp-nowrap">{dataHoraBr(r.importado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Vazio>Sem rateio cadastrado. Importe o organograma ou edite manualmente.</Vazio>}

      {editando && itens.length === 0 && <Aviso tipo="alerta">Sem linhas, o rateio do prestador será apagado.</Aviso>}
      {temEnvelopeAberto && (
        <p className="form-hint">
          O envelope da competência aberta guarda a conferência do rateio do último cálculo: depois de mudar o rateio, recalcule na <Link to={ROTA_FOLHA}>Folha do mês</Link>.
        </p>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </div>
  );
}
