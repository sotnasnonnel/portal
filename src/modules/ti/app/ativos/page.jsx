import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, ChevronsUpDown, Download, Laptop, Plus, RotateCcw, X,
} from 'lucide-react';
import TableScroll from '../../../../components/UI/TableScroll';
import { useTi } from '../components/TiContext';
import {
  Busca, Chip, Esqueleto, Estado, LinhaVazia, PageHead, Pill, Selecao,
} from '../components/Pecas';
import { linhaClicavel, money, tomSituacao, tomTermo } from '../../lib/formato';
import { casaBusca, uniq } from '../../lib/regras';
import { exportarAtivos } from '../../lib/exportar';
import { SITUACOES } from '../../../../config/ti';
import './ativos.css';

const ID_BUSCA = 'ta-q';

// Colunas ordenáveis. `chave` devolve o valor comparado; vazio vai sempre para o fim.
const COLUNAS = [
  { k: 'serie', l: 'Número de série', chave: (a) => a.numero_serie },
  { k: 'tipo', l: 'Tipo / modelo', chave: (a) => [a.tipo, a.modelo].filter(Boolean).join(' ') },
  { k: 'resp', l: 'Responsável', chave: (a, nomeDe) => (a.responsavel ? nomeDe(a.responsavel) : '') },
  { k: 'situacao', l: 'Situação', chave: (a) => a.situacao },
  { k: 'termo', l: 'Termo', chave: (a) => a.situacao_termo },
  { k: 'forn', l: 'Fornecedor', chave: (a) => a.fornecedor },
  {
    k: 'valor', l: 'Valor mensal', n: true, chave: (a) => (a.valor_mensal == null || a.valor_mensal === '' ? null : Number(a.valor_mensal)),
  },
];
const ORDEM_INICIAL = { k: 'resp', dir: 'asc' };
const FILTRO_LIMPO = {
  q: '', fornecedor: '', tipo: '', situacao: '', termo: '',
};

/** Situações na ordem da regra (config/ti.js); o que vier fora dela, no fim. */
const ordemSituacao = (s) => {
  const i = SITUACOES.indexOf(s);
  return i < 0 ? SITUACOES.length : i;
};

const campoDeTexto = (el) => el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

export default function AtivosTi() {
  const {
    dados, carregando, erro, recarregar, filtros, setFiltro, abrirAtivo, abrirForm, podeEscrever, nomeDe, toast, drawer,
  } = useTi();
  const f = filtros.ativos;
  const set = (patch) => setFiltro('ativos', patch);
  const todos = dados.ativos;
  const [ordem, setOrdem] = useState(ORDEM_INICIAL);
  const [tentando, setTentando] = useState(false);

  const base = useMemo(() => todos.filter((a) => (!f.fornecedor || a.fornecedor === f.fornecedor)
    && (!f.tipo || a.tipo === f.tipo)
    && (!f.termo || a.situacao_termo === f.termo)
    && casaBusca({ ...a, observacoes: `${a.observacoes || ''} ${nomeDe(a.responsavel)}` }, f.q)), [todos, f, nomeDe]);
  const rows = useMemo(() => {
    const col = COLUNAS.find((c) => c.k === ordem.k) || COLUNAS[0];
    const sinal = ordem.dir === 'desc' ? -1 : 1;
    const valorDe = (a) => col.chave(a, nomeDe);
    return base.filter((a) => !f.situacao || a.situacao === f.situacao)
      .sort((x, y) => {
        const vx = valorDe(x);
        const vy = valorDe(y);
        const sx = vx == null || vx === '';
        const sy = vy == null || vy === '';
        if (sx || sy) return sx === sy ? 0 : (sx ? 1 : -1); // vazio no fim, nos dois sentidos
        const c = col.n ? vx - vy : String(vx).localeCompare(String(vy), 'pt-BR', { numeric: true, sensitivity: 'base' });
        return c * sinal || String(x.numero_serie).localeCompare(String(y.numero_serie), 'pt-BR');
      });
  }, [base, f.situacao, ordem, nomeDe]);
  const cnt = (s) => base.filter((a) => !s || a.situacao === s).length;
  const situacoes = uniq(todos.map((a) => a.situacao)).sort((x, y) => ordemSituacao(x) - ordemSituacao(y));
  const filtrando = Object.keys(FILTRO_LIMPO).some((k) => f[k]);
  const totalMensal = rows.reduce((s, a) => s + (Number(a.valor_mensal) || 0), 0);
  const falhou = !!erro && !todos.length;

  const limpar = () => {
    set(FILTRO_LIMPO);
    document.getElementById(ID_BUSCA)?.focus();
  };

  const ordenarPor = (k) => setOrdem((o) => (o.k === k ? { k, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { k, dir: 'asc' }));

  const exportar = () => exportarAtivos(rows, nomeDe).catch((e) => toast(e.message, 'err'));

  const tentarDeNovo = async () => {
    setTentando(true);
    try { await recarregar(); } finally { setTentando(false); }
  };

  // "/" leva à busca (com o painel fechado e fora de outro campo). Na busca, Enter
  // abre a ficha quando só sobra um ativo ou o texto é um número de série exato:
  // dá para ler a etiqueta com o leitor de código de barras e cair direto na ficha.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !drawer && !campoDeTexto(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        document.getElementById(ID_BUSCA)?.focus();
        return;
      }
      if (e.key === 'Enter' && e.target?.id === ID_BUSCA && !drawer) {
        const q = String(f.q || '').trim().toUpperCase();
        const exato = q && rows.find((a) => String(a.numero_serie || '').toUpperCase() === q);
        const alvo = exato || (rows.length === 1 ? rows[0] : null);
        if (alvo) {
          e.preventDefault();
          abrirAtivo(alvo.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer, f.q, rows, abrirAtivo]);

  const cabecalho = (c) => {
    const atual = ordem.k === c.k;
    const Icone = !atual ? ChevronsUpDown : (ordem.dir === 'asc' ? ArrowUp : ArrowDown);
    return (
      <th
        key={c.k}
        className={c.n ? 'n' : undefined}
        aria-sort={atual ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      >
        <button type="button" className={`ti-ativos-sort ${atual ? 'on' : ''}`} onClick={() => ordenarPor(c.k)}>
          {c.l}
          <Icone size={12} aria-hidden="true" />
        </button>
      </th>
    );
  };

  let vazio;
  if (!todos.length) {
    vazio = (
      <LinhaVazia
        colunas={COLUNAS.length}
        titulo="Nenhum ativo cadastrado"
        sub={podeEscrever ? 'Use "Novo ativo" para cadastrar o primeiro equipamento.' : 'Não há equipamentos com você nem com a sua equipe.'}
      />
    );
  } else {
    vazio = (
      <LinhaVazia
        colunas={COLUNAS.length}
        titulo="Nenhum ativo encontrado"
        sub={(
          <span className="ti-ativos-vazio-sub">
            {f.q ? <>Nada casa com “{f.q}” nos filtros atuais.</> : 'Nenhum ativo nos filtros atuais.'}
            {' '}
            <button type="button" className="ti-link" onClick={limpar}>Limpar busca e filtros</button>
          </span>
        )}
      />
    );
  }

  return (
    <div className="ti-page ti-stack ti-ativos">
      <PageHead
        Icon={Laptop}
        titulo="Ativos"
        sub="Todos os equipamentos, com responsável, situação, termo e contrato. Clique numa linha para abrir a ficha. Atalhos: / vai para a busca; Enter na busca abre a ficha quando sobra um ativo ou o número de série é exato."
      >
        <button
          type="button"
          className="ti-btn"
          onClick={exportar}
          disabled={!rows.length}
          title={filtrando ? 'Exporta só os ativos filtrados' : 'Exporta todos os ativos'}
        >
          <Download size={15} aria-hidden="true" /> {filtrando ? `Exportar ${rows.length}` : 'Exportar'}
        </button>
        {podeEscrever && (
          <button type="button" className="ti-btn primary" onClick={() => abrirForm(null, { situacao: 'Aguardando atribuição' })}>
            <Plus size={15} aria-hidden="true" /> Novo ativo
          </button>
        )}
      </PageHead>
      <Estado />
      {falhou && (
        <div>
          <button type="button" className="ti-btn" onClick={tentarDeNovo} disabled={tentando}>
            <RotateCcw size={15} aria-hidden="true" /> {tentando ? 'Carregando…' : 'Tentar de novo'}
          </button>
        </div>
      )}

      {!falhou && (
        <div className="ti-card ti-stack" role="search" aria-label="Filtrar ativos">
          <div className="ti-filters">
            <Busca id={ID_BUSCA} valor={f.q} onChange={(q) => set({ q })} placeholder="Número de série, responsável, modelo, contrato ou NF" />
            <Selecao id="ta-tipo" label="Tipo" opcoes={uniq(todos.map((a) => a.tipo))} valor={f.tipo} onChange={(tipo) => set({ tipo })} />
            <Selecao id="ta-termo" label="Situação do termo" opcoes={uniq(todos.map((a) => a.situacao_termo))} valor={f.termo} onChange={(termo) => set({ termo })} />
            <Selecao id="ta-forn" label="Fornecedor" opcoes={uniq(todos.map((a) => a.fornecedor))} valor={f.fornecedor} onChange={(fornecedor) => set({ fornecedor })} />
          </div>
          <div className="ti-chips" role="group" aria-label="Situação do equipamento">
            <Chip ativo={!f.situacao} onClick={() => set({ situacao: '' })} contagem={cnt('')}>Todos</Chip>
            {situacoes.map((s) => (
              <Chip key={s} ativo={f.situacao === s} onClick={() => set({ situacao: f.situacao === s ? '' : s })} contagem={cnt(s)}>{s}</Chip>
            ))}
          </div>
          <div className="ti-ativos-res">
            <span aria-live="polite">
              {carregando ? 'Carregando ativos…' : (
                <>
                  <b>{rows.length}</b>
                  {filtrando ? ` de ${todos.length}` : ''}
                  {rows.length === 1 ? ' ativo' : ' ativos'}
                  {rows.length > 0 && <> · {money(totalMensal)} por mês</>}
                </>
              )}
            </span>
            <label className="ti-ativos-ordem-m" htmlFor="ta-ordem">
              <span>Ordenar por</span>
              <select
                id="ta-ordem"
                className="ti-inp ti-comp"
                value={`${ordem.k}:${ordem.dir}`}
                onChange={(e) => { const [k, dir] = e.target.value.split(':'); setOrdem({ k, dir }); }}
              >
                {COLUNAS.flatMap((c) => [
                  <option key={`${c.k}:asc`} value={`${c.k}:asc`}>{c.l} {c.n ? '(menor primeiro)' : '(A–Z)'}</option>,
                  <option key={`${c.k}:desc`} value={`${c.k}:desc`}>{c.l} {c.n ? '(maior primeiro)' : '(Z–A)'}</option>,
                ])}
              </select>
            </label>
            {filtrando && (
              <button type="button" className="ti-btn ti-ativos-limpar" onClick={limpar}>
                <X size={14} aria-hidden="true" /> Limpar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {carregando && <Esqueleto />}
      {!carregando && !falhou && (
        <TableScroll className="ti-tbl">
          <table className="ti-t ti-ativos-t">
            <caption className="ti-ativos-sr">Lista de ativos. Clique ou tecle Enter numa linha para abrir a ficha.</caption>
            <thead>
              <tr>{COLUNAS.map(cabecalho)}</tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((a) => {
                const nome = a.responsavel ? nomeDe(a.responsavel) : '';
                const aberto = drawer?.id === a.id;
                return (
                  <tr
                    key={a.id}
                    className={`ti-click ${aberto ? 'ti-ativos-aberto' : ''}`}
                    aria-current={aberto || undefined}
                    {...linhaClicavel(() => abrirAtivo(a.id))}
                  >
                    <td className="ti-ativos-c-serie">
                      <div className="p ti-ativos-serie-txt">{a.numero_serie}</div>
                      {a.contrato && <div className="s">Contrato {a.contrato}</div>}
                    </td>
                    <td className="ti-ativos-c-tipo">
                      <div className="p">{a.tipo || '—'}</div>
                      {a.modelo && <div className="s ti-ativos-corta" title={a.modelo}>{a.modelo}</div>}
                    </td>
                    <td className="ti-ativos-c-resp">
                      {a.responsavel ? (
                        <>
                          <div className="p">{nome}</div>
                          {nome !== a.responsavel && <div className="s">{a.responsavel}</div>}
                        </>
                      ) : <span className="ti-muted">Sem responsável</span>}
                    </td>
                    <td className="ti-ativos-c-sit">{a.situacao ? <Pill tone={tomSituacao(a.situacao)}>{a.situacao}</Pill> : <span className="ti-muted">—</span>}</td>
                    <td className="ti-ativos-c-termo">
                      {a.situacao_termo
                        ? <Pill tone={tomTermo(a.situacao_termo)}><span className="ti-ativos-m-only">Termo: </span>{a.situacao_termo}</Pill>
                        : <span className="ti-muted">—</span>}
                    </td>
                    <td className="ti-ativos-c-forn">{a.fornecedor || <span className="ti-muted">—</span>}</td>
                    <td className="n ti-ativos-c-valor">{money(a.valor_mensal)}</td>
                  </tr>
                );
              }) : vazio}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={COLUNAS.length - 1}>{rows.length} {rows.length === 1 ? 'ativo' : 'ativos'}</td>
                  <td className="n">{money(totalMensal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </TableScroll>
      )}
    </div>
  );
}
