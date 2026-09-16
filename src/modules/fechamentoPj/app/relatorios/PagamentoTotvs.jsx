import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Wallet, CheckCircle2, AlertTriangle, FileCheck2 } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { StatCard, Badge, Vazio } from '../components/ui';
import { salvarDocumentoPagamento, auditar } from '../../lib/dados';
import { prontoParaTxt, ratearLiquido, ccValido } from '../../lib/totvs';
import { fmtBRL, fmtNum, somar } from '../../lib/formato';

const RAIZ = '/admin/fechamento-pj';

const FILTROS = [['todos', 'Todos'], ['prontos', 'Prontos'], ['pendentes', 'Pendentes']];

/**
 * Tela de trabalho do pagamento no RM. Nº da NF e Nº do documento RM chegam
 * depois do fechamento, então são editáveis mesmo em competência fechada (o
 * gatilho do banco libera essas duas colunas).
 */
export default function PagamentoTotvs({ linhas, competencia, onSalvo }) {
  const { notificar } = useFechamentoPj();
  const [filtro, setFiltro] = useState('todos');
  const [rascunho, setRascunho] = useState({}); // `${envelopeId}:nf|documento` -> texto
  const [gravando, setGravando] = useState({});

  const comStatus = useMemo(() => linhas.map((l) => {
    const rateio = ratearLiquido(l);
    return { ...l, rateioCalc: rateio, pronto: prontoParaTxt(l) };
  }), [linhas]);

  const kpis = useMemo(() => ({
    total: comStatus.length,
    liquido: somar(comStatus, 'liquido'),
    localizados: comStatus.filter((l) => l.codigoRm).length,
    prontos: comStatus.filter((l) => l.pronto).length,
  }), [comStatus]);

  const visiveis = useMemo(() => comStatus.filter((l) => (
    filtro === 'todos' || (filtro === 'prontos' ? l.pronto : !l.pronto)
  )), [comStatus, filtro]);

  const pendencias = useMemo(() => {
    const semCodigo = comStatus.filter((l) => !l.codigoRm);
    const semRateio = comStatus.filter((l) => !l.rateioCalc.length);
    const ccs = new Map();
    comStatus.forEach((l) => l.rateioCalc.filter((a) => !ccValido(a.cc)).forEach((a) => {
      ccs.set(a.origem, (ccs.get(a.origem) || 0) + 1);
    }));
    return { semCodigo, semRateio, ccs: [...ccs.entries()].sort(([a], [b]) => a.localeCompare(b)) };
  }, [comStatus]);

  const chave = (id, campo) => `${id}:${campo}`;

  async function salvar(linha, campo) {
    const k = chave(linha.envelopeId, campo);
    if (!(k in rascunho)) return;
    const valor = rascunho[k].trim();
    const atual = campo === 'nf' ? linha.nf : linha.documento;
    const limpar = () => setRascunho((r) => { const n = { ...r }; delete n[k]; return n; });
    if (valor === (atual || '')) { limpar(); return; }
    const patch = campo === 'nf' ? { nf_numero: valor } : { rm_documento: valor };
    setGravando((g) => ({ ...g, [k]: true }));
    try {
      await salvarDocumentoPagamento(linha.envelopeId, patch);
      onSalvo(linha.envelopeId, campo === 'nf' ? { nf_numero: valor || null } : { rm_documento: valor || null });
      limpar();
      await auditar(campo === 'nf' ? 'Nº da NF informado' : 'Nº do documento RM informado',
        `${linha.nome} • ${valor || '(apagado)'}`, { competencia, prestadorId: linha.prestadorId });
    } catch (e) {
      // O rascunho fica na célula para a pessoa não perder o que digitou.
      notificar(e.message, 'erro');
    } finally {
      setGravando((g) => { const n = { ...g }; delete n[k]; return n; });
    }
  }

  const celula = (linha, campo) => {
    const k = chave(linha.envelopeId, campo);
    const valor = k in rascunho ? rascunho[k] : (campo === 'nf' ? linha.nf : linha.documento) || '';
    return (
      <input className={`form-input pj-rel-celula ${k in rascunho ? 'pj-rel-celula--editando' : ''}`} value={valor}
        disabled={Boolean(gravando[k])} placeholder={campo === 'nf' ? 'Nº NF' : 'Automático'}
        title={campo === 'documento' ? 'Vazio: o TXT numera como PJ{MM}{AA}-{NNN}' : undefined}
        onChange={(e) => setRascunho((r) => ({ ...r, [k]: e.target.value }))}
        onBlur={() => salvar(linha, campo)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
    );
  };

  return (
    <section id="pagamento-totvs" className="pj-rel-pagamento">
      <h2 className="pj-rel-secao">Pagamento PJ — TOTVS RM</h2>

      <div className="pj-kpis">
        <StatCard tom="secondary" icone={<Users size={22} />} valor={kpis.total} rotulo="PJs" />
        <StatCard tom="primary" icone={<Wallet size={22} />} valor={fmtBRL(kpis.liquido)} rotulo="Líquido NF" />
        <StatCard tom="success" icone={<CheckCircle2 size={22} />} valor={kpis.localizados} rotulo="Fornecedor localizado" />
        <StatCard tom="danger" icone={<AlertTriangle size={22} />} valor={kpis.total - kpis.localizados} rotulo="Fornecedor pendente" />
        <StatCard tom="accent" icone={<FileCheck2 size={22} />} valor={kpis.prontos} rotulo="Prontos para TXT"
          ativo={filtro === 'prontos'} onClick={() => setFiltro(filtro === 'prontos' ? 'todos' : 'prontos')} />
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Conferência ({visiveis.length}/{comStatus.length})</div>
          <div className="filter-chips">
            {FILTROS.map(([v, rotulo]) => (
              <button key={v} type="button" className={`filter-chip ${filtro === v ? 'active' : ''}`} onClick={() => setFiltro(v)}>
                {rotulo}
              </button>
            ))}
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table pj-rel-tabela">
            <thead>
              <tr>
                <th>#</th><th>Prestador</th><th>Razão social</th><th>CNPJ</th><th>Cód. RM</th>
                <th className="pj-direita">Bruto</th><th className="pj-direita">Líquido NF</th>
                <th>Nº NF</th><th>Nº Doc. RM</th><th>Rateio</th><th>Fornecedor</th><th>Documento</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={l.envelopeId}>
                  <td className="pj-num">{l.seq}</td>
                  <td>
                    <Link className="pj-link" to={`${RAIZ}/prestadores/${l.prestadorId}`}>{l.nome}</Link>
                    <div className="pj-sub">{l.empresa}</div>
                  </td>
                  <td>{l.razaoSocial || '—'}</td>
                  <td className="pj-num">{l.cnpj || '—'}</td>
                  <td className="pj-num">{l.codigoRm || <span className="pj-rel-falta">sem código</span>}</td>
                  <td className="pj-direita pj-num">{fmtBRL(l.bruto)}</td>
                  <td className="pj-direita pj-num pj-num--forte">{fmtBRL(l.liquido)}</td>
                  <td>{celula(l, 'nf')}</td>
                  <td>{celula(l, 'documento')}</td>
                  <td>
                    {l.rateioCalc.length ? l.rateioCalc.map((a) => (
                      <div key={a.origem} className={ccValido(a.cc) ? 'pj-rel-cc' : 'pj-rel-cc pj-rel-falta'}
                        title={a.origem !== a.cc ? `COD CT ${a.origem}` : undefined}>
                        {ccValido(a.cc) ? a.cc : `${a.origem} (sem código RM)`} · {fmtNum(a.pct)}%
                      </div>
                    )) : <span className="pj-rel-falta">Sem rateio</span>}
                  </td>
                  <td><Badge tipo="fornecedor" valor={l.statusFornecedor} /></td>
                  <td>
                    {l.nf && l.documento
                      ? <span className="badge aprovada">OK</span>
                      : <span className="badge pendente">Pendente</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visiveis.length && <Vazio>Nenhum prestador neste filtro.</Vazio>}
        </div>
      </div>

      {(pendencias.semCodigo.length > 0 || pendencias.ccs.length > 0 || pendencias.semRateio.length > 0) && (
        <div className="pj-cartao pj-rel-pendencias">
          <h3>Pendências para o TXT</h3>
          {pendencias.semCodigo.length > 0 && (
            <div className="pj-rel-pendencia">
              <div>
                <strong>{pendencias.semCodigo.length} prestador(es) sem código RM de fornecedor</strong>
                <div className="pj-sub">{pendencias.semCodigo.slice(0, 8).map((l) => l.nome).join(' · ')}
                  {pendencias.semCodigo.length > 8 ? ` · +${pendencias.semCodigo.length - 8}` : ''}</div>
              </div>
              <Link className="btn btn-outline btn-sm" to={`${RAIZ}/fornecedores`}>Fornecedores TOTVS</Link>
            </div>
          )}
          {pendencias.ccs.length > 0 && (
            <div className="pj-rel-pendencia">
              <div>
                <strong>{pendencias.ccs.length} centro(s) de custo sem código RM</strong>
                <div className="pj-sub">{pendencias.ccs.map(([cc, n]) => `${cc} (${n})`).join(' · ')}</div>
              </div>
              <Link className="btn btn-outline btn-sm" to={`${RAIZ}/configuracoes?aba=centros`}>Centros de custo</Link>
            </div>
          )}
          {pendencias.semRateio.length > 0 && (
            <div className="pj-rel-pendencia">
              <div>
                <strong>{pendencias.semRateio.length} prestador(es) sem rateio</strong>
                <div className="pj-sub">{pendencias.semRateio.slice(0, 8).map((l) => l.nome).join(' · ')}
                  {pendencias.semRateio.length > 8 ? ` · +${pendencias.semRateio.length - 8}` : ''}</div>
              </div>
              <Link className="btn btn-outline btn-sm" to={`${RAIZ}/prestadores/${pendencias.semRateio[0].prestadorId}`}>Abrir o primeiro</Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
