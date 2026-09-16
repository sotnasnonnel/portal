import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Badge, Carregando, Vazio, SeletorCompetencia } from '../components/ui';
import { listarEnvelopes, nomesColaboradores, auditar } from '../../lib/dados';
import { gravarXlsx } from '../../lib/arquivos';
import { competenciaRotulo, dataHoraBr, fmtBRL, normalizar, digitos, partesCompetencia } from '../../lib/formato';

const RAIZ = '/admin/fechamento-pj';
const LIMITE_TELA = 500;

const ORIGEM_ENVELOPE = { app: 'Fechamento no app', historico: 'Carga histórica' };
const TIPO_IMPORTACAO = { folha: 'Input da folha', organograma: 'Organograma', bradesco: 'Bradesco', historico: 'Carga histórica' };
const nome = (nomes, id) => (id ? nomes.get(id) || '—' : '—');

function Busca({ valor, onTrocar, placeholder }) {
  return (
    <div className="table-search">
      <Search size={16} />
      <input type="text" placeholder={placeholder} value={valor} onChange={(e) => onTrocar(e.target.value)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
export function AbaCompetencias({ nomes }) {
  const { competencias = [], setCompetencia } = useFechamentoPj();
  const navigate = useNavigate();

  function abrir(c) {
    setCompetencia(c.competencia);
    navigate(RAIZ);
  }

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-header-title">Competências ({competencias.length})</div>
        <span className="pj-sub">Clique para abrir a competência na Folha de Pagamento.</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Competência</th><th>Status</th><th>Origem</th><th className="pj-direita">Prestadores</th>
              <th className="pj-direita">Bruto</th><th className="pj-direita">Descontos</th><th className="pj-direita">Líquido</th>
              <th>Fechada</th><th>Reaberta</th>
            </tr>
          </thead>
          <tbody>
            {competencias.map((c) => (
              <tr key={c.competencia} className="pj-hist-clicavel" onClick={() => abrir(c)}>
                <td><strong>{competenciaRotulo(c.competencia)}</strong></td>
                <td><Badge tipo="competencia" valor={c.status} /></td>
                <td>{c.origem === 'historico' ? 'Carga histórica' : 'App'}</td>
                <td className="pj-direita pj-num">{c.prestadores ?? '—'}</td>
                <td className="pj-direita pj-num">{c.bruto == null ? '—' : fmtBRL(c.bruto)}</td>
                <td className="pj-direita pj-num">{c.descontos == null ? '—' : fmtBRL(c.descontos)}</td>
                <td className="pj-direita pj-num pj-num--forte">{c.liquido == null ? '—' : fmtBRL(c.liquido)}</td>
                <td>
                  {c.fechada_em ? <>{dataHoraBr(c.fechada_em)}<div className="pj-sub">{nome(nomes, c.fechada_por)}</div></> : '—'}
                </td>
                <td>
                  {c.reaberta_em ? (
                    <>
                      {dataHoraBr(c.reaberta_em)}
                      <div className="pj-sub">{nome(nomes, c.reaberta_por)}{c.motivo_reabertura ? ` • ${c.motivo_reabertura}` : ''}</div>
                    </>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!competencias.length && <Vazio>Nenhuma competência registrada.</Vazio>}
      </div>
      <p className="pj-sub pj-hist-nota">Totais de competência em aberto só aparecem depois do fechamento.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function AbaValores({ linhas }) {
  const { prestadores = [], notificar } = useFechamentoPj();
  const [comp, setComp] = useState('');
  const [busca, setBusca] = useState('');
  const [exportando, setExportando] = useState(false);

  const porId = useMemo(() => new Map(prestadores.map((p) => [p.id, p])), [prestadores]);

  const completas = useMemo(() => (linhas || []).map((e) => {
    const p = porId.get(e.prestador_id) || {};
    const cad = e.cadastro || {};
    return {
      id: e.id,
      competencia: e.competencia,
      nome: cad.nome || p.nome || '—',
      bruto: Number(e.bruto) || 0,
      descontos: Number(e.descontos) || 0,
      liquido: Number(e.liquido ?? (e.bruto - e.descontos)) || 0,
      email: cad.email || p.email || '',
      razaoSocial: cad.razaoSocial || p.razao_social || '',
      cnpj: cad.cnpj || p.cnpj || '',
      origem: ORIGEM_ENVELOPE[e.origem] || e.origem,
    };
  }), [linhas, porId]);

  const opcoes = useMemo(() => [...new Set(completas.map((l) => l.competencia))].sort().reverse(), [completas]);

  const filtradas = useMemo(() => {
    const q = normalizar(busca);
    const qDig = digitos(busca);
    return completas
      .filter((l) => !comp || l.competencia === comp)
      .filter((l) => !q || normalizar(`${l.nome} ${l.razaoSocial} ${l.email}`).includes(q) || (qDig.length >= 3 && digitos(l.cnpj).includes(qDig)))
      .sort((a, b) => (a.competencia === b.competencia ? normalizar(a.nome).localeCompare(normalizar(b.nome)) : b.competencia.localeCompare(a.competencia)));
  }, [completas, comp, busca]);

  async function exportar() {
    setExportando(true);
    try {
      const sufixo = comp ? `${partesCompetencia(comp).mm}-${partesCompetencia(comp).aaaa}` : 'todas';
      await gravarXlsx([{
        nome: 'Historico de valores',
        cabecalho: ['Competência', 'Prestador', 'Valor bruto', 'Descontos', 'Líquido NF', 'E-mail', 'Razão Social', 'CNPJ PJ', 'Origem'],
        linhas: filtradas.map((l) => [competenciaRotulo(l.competencia), l.nome, l.bruto, l.descontos, l.liquido, l.email, l.razaoSocial, l.cnpj, l.origem]),
        moeda: [2, 3, 4],
        larguras: [12, 38, 15, 15, 15, 34, 42, 20, 18],
      }], `Historico_valores_PJ_${sufixo}.xlsx`);
      await auditar('Relatório exportado', `Histórico de valores • ${comp ? competenciaRotulo(comp) : 'todas as competências'}`,
        { competencia: comp || null });
    } catch (e) {
      notificar(e.message || 'Não foi possível exportar.', 'erro');
    } finally {
      setExportando(false);
    }
  }

  if (!linhas) return <Carregando texto="Carregando histórico de valores…" />;

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-header-title">Valores por prestador ({filtradas.length})</div>
        <div className="pj-toolbar">
          <select className="form-select pj-hist-select" value={comp} onChange={(e) => setComp(e.target.value)}>
            <option value="">Todas as competências</option>
            {opcoes.map((c) => <option key={c} value={c}>{competenciaRotulo(c)}</option>)}
          </select>
          <Busca valor={busca} onTrocar={setBusca} placeholder="Prestador, razão social, CNPJ…" />
          <button type="button" className="btn btn-outline" onClick={exportar} disabled={exportando || !filtradas.length}>
            <Download size={16} /> {exportando ? 'Exportando…' : 'Exportar'}
          </button>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Competência</th><th>Prestador</th><th className="pj-direita">Bruto</th><th className="pj-direita">Descontos</th>
              <th className="pj-direita">Líquido NF</th><th>E-mail</th><th>Razão social</th><th>CNPJ</th><th>Origem</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.slice(0, LIMITE_TELA).map((l) => (
              <tr key={l.id}>
                <td>{competenciaRotulo(l.competencia)}</td>
                <td><strong>{l.nome}</strong></td>
                <td className="pj-direita pj-num">{fmtBRL(l.bruto)}</td>
                <td className="pj-direita pj-num">{fmtBRL(l.descontos)}</td>
                <td className="pj-direita pj-num pj-num--forte">{fmtBRL(l.liquido)}</td>
                <td>{l.email || '—'}</td>
                <td>{l.razaoSocial || '—'}</td>
                <td className="pj-num">{l.cnpj || '—'}</td>
                <td>{l.origem}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtradas.length && <Vazio>Nenhum registro de valores.</Vazio>}
      </div>
      {filtradas.length > LIMITE_TELA && (
        <p className="pj-sub pj-hist-nota">
          Mostrando {LIMITE_TELA} de {filtradas.length}. Filtre por competência ou exporte para ver tudo.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function AbaTermos() {
  const { competencias = [], competencia: compContexto, prestadores = [] } = useFechamentoPj();
  // Seletor local: olhar os termos de outro mês não troca a competência da Folha.
  const [comp, setComp] = useState(compContexto);
  const [dados, setDados] = useState(null);
  const [nomes, setNomes] = useState(new Map());

  useEffect(() => {
    if (!comp) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const envelopes = await listarEnvelopes(comp);
        const ids = envelopes.flatMap((e) => [e.termo_gerado_por, e.enviado_por]);
        const mapa = await nomesColaboradores(ids).catch(() => new Map());
        if (!cancelado) { setDados({ comp, envelopes, erro: '' }); setNomes(mapa); }
      } catch (e) {
        if (!cancelado) setDados({ comp, envelopes: [], erro: e.message });
      }
    })();
    return () => { cancelado = true; };
  }, [comp]);

  const porId = useMemo(() => new Map(prestadores.map((p) => [p.id, p])), [prestadores]);
  const linhas = useMemo(() => (dados?.comp === comp ? dados.envelopes : []).map((e) => {
    const p = porId.get(e.prestador_id) || {};
    const cad = e.cadastro || {};
    return { ...e, nome: cad.nome || p.nome || '—', codigo: cad.codigo || p.codigo || '', email: cad.email || p.email || '' };
  }).sort((a, b) => normalizar(a.nome).localeCompare(normalizar(b.nome))), [dados, comp, porId]);

  if (!competencias.length) return <Vazio>Nenhuma competência registrada.</Vazio>;

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-header-title">Termos ({linhas.length})</div>
        <SeletorCompetencia competencias={competencias} valor={comp} onTrocar={setComp} />
      </div>
      {dados?.comp !== comp ? <Carregando texto="Carregando termos…" /> : (
        <div className="table-scroll">
          {dados.erro && <div className="pj-aviso pj-aviso--erro">{dados.erro}</div>}
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th><th>Prestador</th><th>Termo</th><th>Envio</th><th>E-mail</th>
                <th className="pj-direita">Líquido</th><th>Gerado</th><th>Enviado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((e) => (
                <tr key={e.id}>
                  <td className="pj-num">{e.codigo || '—'}</td>
                  <td><strong>{e.nome}</strong></td>
                  <td><Badge tipo="termo" valor={e.termo} /></td>
                  <td><Badge tipo="envio" valor={e.envio} /></td>
                  <td>{e.email || '—'}</td>
                  <td className="pj-direita pj-num">{fmtBRL(e.liquido ?? (e.bruto - e.descontos))}</td>
                  <td>{e.termo_gerado_em ? <>{dataHoraBr(e.termo_gerado_em)}<div className="pj-sub">{nome(nomes, e.termo_gerado_por)}</div></> : '—'}</td>
                  <td>{e.enviado_em ? <>{dataHoraBr(e.enviado_em)}<div className="pj-sub">{nome(nomes, e.enviado_por)}</div></> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!linhas.length && <Vazio>Sem envelopes nesta competência.</Vazio>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function AbaImportacoes({ linhas, nomes }) {
  if (!linhas) return <Carregando texto="Carregando importações…" />;
  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-header-title">Importações ({linhas.length})</div>
        <span className="pj-sub">As últimas 200.</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tipo</th><th>Competência</th><th>Arquivo</th><th>Modo</th><th className="pj-direita">Linhas</th>
              <th className="pj-direita">Localizados</th><th className="pj-direita">Novos</th><th className="pj-direita">Sem corresp.</th>
              <th className="pj-direita">Bruto</th><th className="pj-direita">Descontos</th><th className="pj-direita">Líquido</th><th>Por</th><th>Em</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((i) => (
              <tr key={i.id}>
                <td>{TIPO_IMPORTACAO[i.tipo] || i.tipo}</td>
                <td>{i.competencia ? competenciaRotulo(i.competencia) : '—'}</td>
                <td className="pj-hist-quebra">{i.arquivo}</td>
                <td>{i.modo === 'descontos' ? 'Somente descontos' : i.modo === 'completo' ? 'Completo' : '—'}</td>
                <td className="pj-direita pj-num">{i.linhas}</td>
                <td className="pj-direita pj-num">{i.localizados}</td>
                <td className="pj-direita pj-num">{i.novos}</td>
                <td className="pj-direita pj-num">{i.sem_correspondencia}</td>
                <td className="pj-direita pj-num">{i.bruto == null ? '—' : fmtBRL(i.bruto)}</td>
                <td className="pj-direita pj-num">{i.descontos == null ? '—' : fmtBRL(i.descontos)}</td>
                <td className="pj-direita pj-num">{i.liquido == null ? '—' : fmtBRL(i.liquido)}</td>
                <td>{nome(nomes, i.importado_por)}</td>
                <td className="pj-num">{dataHoraBr(i.importado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!linhas.length && <Vazio>Nenhuma importação registrada.</Vazio>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function AbaAuditoria({ linhas, nomes }) {
  const { prestadores = [] } = useFechamentoPj();
  const [busca, setBusca] = useState('');
  const porId = useMemo(() => new Map(prestadores.map((p) => [p.id, p.nome])), [prestadores]);

  const filtradas = useMemo(() => {
    const q = normalizar(busca);
    if (!q) return linhas || [];
    return (linhas || []).filter((a) => normalizar([
      a.acao, a.detalhe, competenciaRotulo(a.competencia), porId.get(a.prestador_id), nomes.get(a.por),
    ].join(' ')).includes(q));
  }, [linhas, busca, porId, nomes]);

  if (!linhas) return <Carregando texto="Carregando auditoria…" />;

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-header-title">Auditoria ({filtradas.length})</div>
        <div className="pj-toolbar">
          <Busca valor={busca} onTrocar={setBusca} placeholder="Ação, detalhe, competência, pessoa…" />
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr><th>Em</th><th>Ação</th><th>Detalhe</th><th>Competência</th><th>Prestador</th><th>Por</th></tr>
          </thead>
          <tbody>
            {filtradas.map((a) => (
              <tr key={a.id}>
                <td className="pj-num">{dataHoraBr(a.em)}</td>
                <td><strong>{a.acao}</strong></td>
                <td className="pj-hist-detalhe">{a.detalhe || '—'}</td>
                <td>{a.competencia ? competenciaRotulo(a.competencia) : '—'}</td>
                <td>{a.prestador_id ? porId.get(a.prestador_id) || '—' : '—'}</td>
                <td>{nome(nomes, a.por)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtradas.length && <Vazio>Nenhum registro de auditoria.</Vazio>}
      </div>
      <p className="pj-sub pj-hist-nota">Os 500 registros mais recentes.</p>
    </div>
  );
}
