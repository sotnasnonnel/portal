import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, Save, RotateCcw } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Aviso, Vazio } from '../components/ui';
import { salvarCentros, excluirCentro, auditar } from '../../lib/dados';
import { CC_RM_REGEX, codigoRmCentroCusto, normalizar } from '../../lib/formato';
import TableScroll from '../../../../components/UI/TableScroll';

const paraLinha = (c) => ({ cod_ct: c.cod_ct, codigo_rm: c.codigo_rm || '', descricao: c.descricao || '', origem: c.origem, salvo: true });

// Vazio é aceito (fica PENDENTE); preenchido precisa virar d.ddd.dddddd.
const validarCodigo = (v) => {
  const s = String(v || '').trim();
  if (!s) return { ok: true, valor: '' };
  const f = codigoRmCentroCusto(s);
  return f ? { ok: true, valor: f } : { ok: false, valor: s };
};

/**
 * Base de centros de custo — TOTVS RM. O organograma fala COD CT; o TXT exige o
 * código RM. Centro pendente bloqueia o rateio do prestador no TXT.
 */
export default function AbaCentros({ onSujo }) {
  const { centros = [], rateios = [], recarregar, notificar } = useFechamentoPj();
  const [linhas, setLinhas] = useState(() => centros.map(paraLinha));
  const [busca, setBusca] = useState('');
  const [novoCt, setNovoCt] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const originais = useMemo(() => new Map(centros.map((c) => [c.cod_ct, paraLinha(c)])), [centros]);
  const alteradas = useMemo(() => linhas.filter((l) => {
    const o = originais.get(l.cod_ct);
    return !o || o.codigo_rm !== l.codigo_rm.trim() || o.descricao !== l.descricao.trim();
  }), [linhas, originais]);
  const sujo = alteradas.length > 0;
  useEffect(() => { onSujo?.(sujo); }, [sujo, onSujo]);

  // Quantos prestadores usam cada COD CT no rateio do cadastro.
  const uso = useMemo(() => {
    const m = new Map();
    rateios.forEach((r) => {
      if (!m.has(r.cod_ct)) m.set(r.cod_ct, new Set());
      m.get(r.cod_ct).add(r.prestador_id);
    });
    return m;
  }, [rateios]);

  const semCadastro = useMemo(() => {
    const existentes = new Set(linhas.map((l) => l.cod_ct));
    return [...uso.keys()].filter((ct) => !existentes.has(ct)).sort();
  }, [uso, linhas]);

  const resumo = useMemo(() => {
    const com = linhas.filter((l) => CC_RM_REGEX.test(l.codigo_rm.trim())).length;
    return { total: linhas.length, com, pendentes: linhas.length - com };
  }, [linhas]);

  const visiveis = useMemo(() => {
    const q = normalizar(busca);
    return linhas
      .filter((l) => !q || normalizar(`${l.cod_ct} ${l.codigo_rm} ${l.descricao}`).includes(q))
      .sort((a, b) => a.cod_ct.localeCompare(b.cod_ct));
  }, [linhas, busca]);

  const setCampo = (codCt, campo, valor) => setLinhas((ls) => ls.map((l) => (l.cod_ct === codCt ? { ...l, [campo]: valor } : l)));

  function incluir(cts) {
    const existentes = new Set(linhas.map((l) => normalizar(l.cod_ct)));
    const novos = cts.map((c) => c.trim()).filter((c) => c && !existentes.has(normalizar(c)));
    if (!novos.length) { setErro('Esse COD CT já está na base.'); return; }
    setErro('');
    setLinhas((ls) => [...ls, ...novos.map((cod_ct) => ({ cod_ct, codigo_rm: '', descricao: '', origem: 'Manual', salvo: false }))]);
    setNovoCt('');
  }

  function formatarAoSair(codCt, valor) {
    const v = validarCodigo(valor);
    if (v.ok && v.valor !== valor) setCampo(codCt, 'codigo_rm', v.valor);
  }

  async function remover(l) {
    if (!l.salvo) { setLinhas((ls) => ls.filter((x) => x.cod_ct !== l.cod_ct)); return; }
    const n = uso.get(l.cod_ct)?.size || 0;
    const aviso = n ? ` ${n} prestador(es) usam este COD CT no rateio e ficarão sem código RM.` : '';
    if (!window.confirm(`Excluir o centro ${l.cod_ct}?${aviso}`)) return;
    try {
      await excluirCentro(l.cod_ct);
      await auditar('Centro de custo excluído', `${l.cod_ct}${l.codigo_rm ? ` → ${l.codigo_rm}` : ''}`);
      setLinhas((ls) => ls.filter((x) => x.cod_ct !== l.cod_ct));
      await recarregar();
      notificar(`Centro ${l.cod_ct} excluído.`);
    } catch (e) {
      notificar(e.message, 'erro');
    }
  }

  async function salvar() {
    const invalidos = alteradas.filter((l) => !validarCodigo(l.codigo_rm).ok);
    if (invalidos.length) {
      setErro(`Código RM inválido em ${invalidos.map((l) => l.cod_ct).join(', ')}. Use d.ddd.dddddd (ou 10 dígitos).`);
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      const lote = alteradas.map((l) => ({ cod_ct: l.cod_ct, codigo_rm: validarCodigo(l.codigo_rm).valor || null, descricao: l.descricao.trim() || null, origem: l.origem }));
      const gravados = await salvarCentros(lote);
      const porCt = new Map(gravados.map((g) => [g.cod_ct, paraLinha(g)]));
      setLinhas((ls) => ls.map((l) => porCt.get(l.cod_ct) || l));
      await auditar('Configuração alterada', `Centros de custo RM • ${lote.length} alterado(s): ${lote.slice(0, 10).map((l) => `${l.cod_ct}→${l.codigo_rm || 'pendente'}`).join(', ')}`);
      await recarregar();
      notificar(`${lote.length} centro(s) de custo salvos.`);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="pj-cfg-aba pj-cfg-aba--solta">
      <div className="pj-cfg-resumo">
        <div><small>Centros na base</small><b>{resumo.total}</b></div>
        <div><small>Com código RM</small><b>{resumo.com}</b></div>
        <div className={resumo.pendentes ? 'pj-cfg-resumo--alerta' : ''}><small>Pendentes</small><b>{resumo.pendentes}</b></div>
      </div>

      <Aviso tipo="info">Centro pendente bloqueia o rateio no TXT: o prestador que usa esse COD CT não entra no arquivo do RM.</Aviso>
      {semCadastro.length > 0 && (
        <Aviso tipo="alerta" acao={(
          <button type="button" className="btn btn-outline btn-sm" onClick={() => incluir(semCadastro)}>Incluir {semCadastro.length}</button>
        )}>
          {semCadastro.length} COD CT usados no rateio dos prestadores não estão na base: {semCadastro.slice(0, 8).join(', ')}
          {semCadastro.length > 8 ? '…' : ''}
        </Aviso>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Base de Centros de Custo — TOTVS RM</div>
          <div className="pj-toolbar">
            <div className="table-search">
              <Search size={16} />
              <input type="text" placeholder="COD CT, código RM, descrição…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <input className="form-input pj-cfg-novo-ct" placeholder="Novo COD CT" value={novoCt} onChange={(e) => setNovoCt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') incluir([novoCt]); }} />
            <button type="button" className="btn btn-outline" onClick={() => incluir([novoCt])} disabled={!novoCt.trim()}>
              <Plus size={16} /> Adicionar
            </button>
          </div>
        </div>
        <TableScroll>
          <table className="data-table">
            <thead>
              <tr><th>COD CT</th><th>Código RM</th><th>Descrição</th><th className="pj-centro">Prestadores</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {visiveis.map((l) => {
                const v = validarCodigo(l.codigo_rm);
                const ok = v.ok && CC_RM_REGEX.test(v.valor);
                const alterada = alteradas.includes(l);
                return (
                  <tr key={l.cod_ct} className={alterada ? 'pj-cfg-alterada' : ''}>
                    <td><strong>{l.cod_ct}</strong>{!l.salvo && <div className="pj-sub">novo</div>}</td>
                    <td>
                      <input className={`form-input pj-cfg-cc ${v.ok ? '' : 'pj-cfg-invalido'}`} value={l.codigo_rm} placeholder="0.000.000000"
                        onChange={(e) => setCampo(l.cod_ct, 'codigo_rm', e.target.value)} onBlur={(e) => formatarAoSair(l.cod_ct, e.target.value)} />
                    </td>
                    <td>
                      <input className="form-input pj-cfg-desc" value={l.descricao} onChange={(e) => setCampo(l.cod_ct, 'descricao', e.target.value)} />
                    </td>
                    <td className="pj-centro pj-num">{uso.get(l.cod_ct)?.size || 0}</td>
                    <td>{ok ? <span className="badge aprovada">OK</span> : <span className="badge reprovada">Pendente</span>}</td>
                    <td className="pj-direita">
                      <button type="button" className="btn btn-ghost btn-icon" aria-label={`Excluir ${l.cod_ct}`} onClick={() => remover(l)} disabled={salvando}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visiveis.length && <Vazio>{linhas.length ? 'Nenhum centro com essa busca.' : 'Nenhum centro de custo cadastrado.'}</Vazio>}
        </TableScroll>
      </div>

      <div className="pj-cfg-barra">
        <div className="pj-cfg-barra-extra" />
        <span className={`pj-cfg-estado ${sujo ? 'pj-cfg-estado--sujo' : ''}`}>{sujo ? `${alteradas.length} alteração(ões) não salvas` : 'Tudo salvo'}</span>
        <button type="button" className="btn btn-outline" onClick={() => { setLinhas(centros.map(paraLinha)); setErro(''); }} disabled={!sujo || salvando}>
          <RotateCcw size={16} /> Descartar
        </button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={!sujo || salvando}>
          <Save size={16} /> {salvando ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}
