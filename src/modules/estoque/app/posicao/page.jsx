import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Boxes, Search, Loader2, AlertCircle, Pencil, Check, X, Plus, TriangleAlert, TrendingUp, EyeOff, Eye,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  CATEGORIAS, SITUACOES, GENEROS, SETORES, TAMANHOS_ALFA, ehOperadorEstoque,
} from '../../../../config/estoque';
import { listarPosicao, salvarVariante, garantirItem, criarVariante } from '../../lib/estoque';
import { filtrarPosicao, detalheVariante, EM_ALERTA } from '../../lib/catalogo';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moeda = (v) => (v === null || v === undefined ? '—' : BRL.format(v));

const NOVO = {
  categoria: 'epi', descricao: '', tamanho: '', ca: '', genero: '', setor: '',
  codigo: '', referencia: '', estoque_minimo: '', estoque_maximo: '', custo_unitario: '',
};

export default function PosicaoEstoque() {
  const { modules } = useAuth();
  const operador = ehOperadorEstoque(modules);

  const [posicao, setPosicao] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState('');

  const [termo, setTermo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [apenasAlerta, setApenasAlerta] = useState(false);
  const [verInativas, setVerInativas] = useState(false);

  // O painel manda para cá com a situação na URL ao clicar num indicador
  // (/estoque/posicao?situacao=acima_maximo). Fica na URL, e não no estado, para
  // o link ser compartilhável e o voltar do navegador funcionar.
  const [params, setParams] = useSearchParams();
  const situacao = params.get('situacao') || '';
  const trocarSituacao = (nova) => {
    const p = new URLSearchParams(params);
    if (nova) p.set('situacao', nova); else p.delete('situacao');
    setParams(p, { replace: true });
  };

  const [editando, setEditando] = useState(null);   // id da variante em edição
  const [rascunho, setRascunho] = useState({});
  const [novoAberto, setNovoAberto] = useState(false);
  const [novo, setNovo] = useState(NOVO);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setPosicao(await listarPosicao({ incluirInativas: verInativas }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [verInativas]);

  useEffect(() => { carregar(); }, [carregar]);

  const lista = useMemo(
    () => filtrarPosicao(posicao, { termo, categoria, apenasAlerta, situacao }),
    [posicao, termo, categoria, apenasAlerta, situacao],
  );

  const emAlerta = useMemo(() => posicao.filter((v) => EM_ALERTA.has(v.situacao)).length, [posicao]);
  const acimaMaximo = useMemo(() => posicao.filter((v) => v.situacao === 'acima_maximo').length, [posicao]);

  const abrirEdicao = (v) => {
    setEditando(v.id);
    setRascunho({
      estoque_minimo: v.estoque_minimo ?? 0,
      estoque_maximo: v.estoque_maximo ?? '',
      custo_unitario: v.custo_unitario ?? '',
    });
  };

  const salvarLinha = async (id) => {
    setOcupado(id);
    setErro('');
    try {
      await salvarVariante(id, rascunho);
      setEditando(null);
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado('');
    }
  };

  const alternarAtivo = async (v) => {
    setOcupado(v.id);
    setErro('');
    try {
      await salvarVariante(v.id, { ativo: !v.ativo });
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado('');
    }
  };

  const criar = async (e) => {
    e.preventDefault();
    if (!novo.descricao.trim()) { setErro('Informe a descrição do item.'); return; }
    setOcupado('novo');
    setErro('');
    try {
      const itemId = await garantirItem({ categoria: novo.categoria, descricao: novo.descricao });
      await criarVariante({ ...novo, item_id: itemId });
      setNovo({ ...NOVO, categoria: novo.categoria });
      setNovoAberto(false);
      await carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado('');
    }
  };

  return (
    <div className="est-page est-page-wide">
      <div className="est-cab">
        <div className="est-cab-txt">
          <h1 className="est-title"><Boxes size={22} /> Posição de estoque</h1>
          <p className="est-sub">
            Saldo por item e variação. O saldo só muda por movimento — para corrigir
            contagem, use o Inventário; aqui edita-se mínimo, máximo e custo.
          </p>
        </div>
        {operador && (
          <button type="button" className="est-btn est-btn-primary est-btn-sm"
            onClick={() => setNovoAberto((v) => !v)}>
            <Plus size={15} /> Novo item
          </button>
        )}
      </div>

      {erro && <div className="est-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {operador && novoAberto && (
        <form className="est-card" onSubmit={criar}>
          <h2 className="est-card-tit"><Plus size={13} /> Cadastrar item</h2>
          <p className="est-campo-dica" style={{ marginBottom: 14 }}>
            O item nasce com saldo zero. Para dar entrada nas peças, use a tela de Entrada —
            assim o saldo tem origem registrada.
          </p>
          <div className="est-linha">
            <div className="est-campo">
              <label htmlFor="n-cat">Categoria<span className="req">*</span></label>
              <select id="n-cat" className="est-select" value={novo.categoria}
                onChange={(e) => setNovo({ ...novo, categoria: e.target.value })}>
                {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
              </select>
            </div>
            <div className="est-campo" style={{ flex: '2 1 280px' }}>
              <label htmlFor="n-desc">Descrição<span className="req">*</span></label>
              <input id="n-desc" className="est-input" value={novo.descricao}
                placeholder="Ex.: CAPACETE 3M"
                onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
            </div>
          </div>

          <div className="est-linha">
            <div className="est-campo">
              <label htmlFor="n-tam">Tamanho</label>
              <input id="n-tam" className="est-input" value={novo.tamanho}
                list="est-tamanhos" placeholder="42, M…"
                onChange={(e) => setNovo({ ...novo, tamanho: e.target.value })} />
              <datalist id="est-tamanhos">
                {TAMANHOS_ALFA.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
            {novo.categoria === 'epi' ? (
              <div className="est-campo">
                <label htmlFor="n-ca">CA</label>
                <input id="n-ca" className="est-input" value={novo.ca} inputMode="numeric"
                  onChange={(e) => setNovo({ ...novo, ca: e.target.value })} />
              </div>
            ) : (
              <>
                <div className="est-campo">
                  <label htmlFor="n-gen">Gênero</label>
                  <select id="n-gen" className="est-select" value={novo.genero}
                    onChange={(e) => setNovo({ ...novo, genero: e.target.value })}>
                    <option value="">—</option>
                    {GENEROS.map((g) => <option key={g.valor} value={g.valor}>{g.label}</option>)}
                  </select>
                </div>
                <div className="est-campo">
                  <label htmlFor="n-ref">Referência</label>
                  <input id="n-ref" className="est-input" value={novo.referencia}
                    placeholder="Modelo, código do fornecedor…"
                    onChange={(e) => setNovo({ ...novo, referencia: e.target.value })} />
                </div>
                <div className="est-campo">
                  <label htmlFor="n-set">Setor</label>
                  <select id="n-set" className="est-select" value={novo.setor}
                    onChange={(e) => setNovo({ ...novo, setor: e.target.value })}>
                    <option value="">—</option>
                    {SETORES.map((s) => <option key={s.valor} value={s.valor}>{s.label}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="est-linha">
            <div className="est-campo">
              <label htmlFor="n-min">Estoque mínimo</label>
              <input id="n-min" className="est-input est-input-num" type="number" min="0" step="1"
                value={novo.estoque_minimo}
                onChange={(e) => setNovo({ ...novo, estoque_minimo: e.target.value })} />
            </div>
            <div className="est-campo">
              <label htmlFor="n-max">Estoque máximo</label>
              <input id="n-max" className="est-input est-input-num" type="number" min="0" step="1"
                value={novo.estoque_maximo}
                onChange={(e) => setNovo({ ...novo, estoque_maximo: e.target.value })} />
            </div>
            <div className="est-campo">
              <label htmlFor="n-cus">Custo unitário (R$)</label>
              <input id="n-cus" className="est-input est-input-num" inputMode="decimal"
                value={novo.custo_unitario} placeholder="50,70"
                onChange={(e) => setNovo({ ...novo, custo_unitario: e.target.value })} />
            </div>
          </div>

          <div className="est-acoes">
            <button type="button" className="est-btn est-btn-ghost"
              onClick={() => { setNovoAberto(false); setNovo(NOVO); }}>Cancelar</button>
            <button type="submit" className="est-btn est-btn-primary" disabled={ocupado === 'novo'}>
              {ocupado === 'novo' ? <Loader2 size={16} className="est-spin" /> : <Check size={16} />} Cadastrar
            </button>
          </div>
        </form>
      )}

      <div className="est-card">
        <div className="est-campo">
          <label htmlFor="p-busca">Buscar item</label>
          <div className="est-busca">
            <Search size={16} />
            <input id="p-busca" className="est-input" value={termo}
              placeholder="Nome, tamanho ou CA…"
              onChange={(e) => setTermo(e.target.value)} />
          </div>
        </div>
        <div className="est-chips">
          <button type="button" className={`est-chip ${!categoria ? 'is-on' : ''}`}
            onClick={() => setCategoria('')}>Todas</button>
          {CATEGORIAS.map((c) => (
            <button key={c.valor} type="button"
              className={`est-chip ${categoria === c.valor ? 'is-on' : ''}`}
              onClick={() => setCategoria(c.valor)}>
              <c.icon size={14} /> {c.plural}
            </button>
          ))}
          <button type="button" className={`est-chip ${apenasAlerta ? 'is-on' : ''}`}
            onClick={() => setApenasAlerta((v) => !v)}>
            <TriangleAlert size={14} /> Precisa repor ({emAlerta})
          </button>
          {/* Excesso é o oposto: não falta material, sobra. Chip próprio para
              não se misturar ao "precisa repor". */}
          <button type="button"
            className={`est-chip ${situacao === 'acima_maximo' ? 'is-on' : ''}`}
            onClick={() => trocarSituacao(situacao === 'acima_maximo' ? '' : 'acima_maximo')}>
            <TrendingUp size={14} /> Estoque alto ({acimaMaximo})
          </button>
          {situacao && situacao !== 'acima_maximo' && (
            <button type="button" className="est-chip is-on" onClick={() => trocarSituacao('')}>
              {SITUACOES[situacao]?.label || situacao} ✕
            </button>
          )}
          {operador && (
            <button type="button" className={`est-chip ${verInativas ? 'is-on' : ''}`}
              onClick={() => setVerInativas((v) => !v)}>
              {verInativas ? <Eye size={14} /> : <EyeOff size={14} />} Mostrar inativos
            </button>
          )}
        </div>
      </div>

      {carregando ? (
        <div className="est-vazio"><Loader2 size={20} className="est-spin" /> Carregando…</div>
      ) : lista.length === 0 ? (
        <div className="est-vazio">
          {posicao.length === 0
            ? 'O catálogo está vazio. Use “Novo item” para cadastrar a primeira variação.'
            : 'Nenhum item encontrado com esses filtros.'}
        </div>
      ) : (
        <div className="est-tabela-scroll">
          <table className="est-tabela">
            <thead>
              <tr>
                <th>Item</th>
                <th>Categoria</th>
                <th className="num">Nova</th>
                <th className="num">Usada</th>
                <th className="num">Total</th>
                <th className="num">Mín.</th>
                <th className="num">Máx.</th>
                <th className="num">Custo un.</th>
                <th className="num">Valor</th>
                <th>Situação</th>
                {operador && <th aria-label="Ações" />}
              </tr>
            </thead>
            <tbody>
              {lista.map((v) => {
                const edit = editando === v.id;
                const sit = SITUACOES[v.situacao] || SITUACOES.ok;
                return (
                  <tr key={v.id} style={v.ativo ? undefined : { opacity: 0.55 }}>
                    <td>
                      <span className="est-item-nome">{v.descricao}</span>
                      <span className="est-item-det">{detalheVariante(v) || '—'}</span>
                    </td>
                    <td><span className={`est-badge tom-${v.categoria}`}>{v.categoria === 'epi' ? 'EPI' : 'Uniforme'}</span></td>
                    <td className="num">{v.saldo_novo}</td>
                    <td className="num">{v.saldo_usado}</td>
                    <td className={`num ${v.situacao === 'sem_estoque' ? 'is-critico'
                      : v.situacao === 'abaixo_minimo' ? 'is-alerta' : ''}`}>
                      {v.saldo}
                    </td>
                    <td className="num est-col-min">
                      {edit ? (
                        <input className="est-input est-input-num" type="number" min="0" step="1"
                          aria-label="Estoque mínimo" value={rascunho.estoque_minimo}
                          onChange={(e) => setRascunho({ ...rascunho, estoque_minimo: e.target.value })} />
                      ) : (v.estoque_minimo || 0)}
                    </td>
                    <td className="num est-col-min">
                      {edit ? (
                        <input className="est-input est-input-num" type="number" min="0" step="1"
                          aria-label="Estoque máximo" value={rascunho.estoque_maximo}
                          onChange={(e) => setRascunho({ ...rascunho, estoque_maximo: e.target.value })} />
                      ) : (v.estoque_maximo ?? '—')}
                    </td>
                    <td className="num est-col-min">
                      {edit ? (
                        <input className="est-input est-input-num" inputMode="decimal"
                          aria-label="Custo unitário" value={rascunho.custo_unitario}
                          onChange={(e) => setRascunho({ ...rascunho, custo_unitario: e.target.value })} />
                      ) : moeda(v.custo_unitario)}
                    </td>
                    <td className="num">{v.custo_unitario ? BRL.format(v.valor_total) : '—'}</td>
                    <td><span className={`est-badge tom-${sit.tom}`}>{sit.label}</span></td>
                    {operador && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {edit ? (
                            <>
                              <button type="button" className="est-btn-icone" title="Salvar"
                                disabled={ocupado === v.id} onClick={() => salvarLinha(v.id)}>
                                {ocupado === v.id ? <Loader2 size={15} className="est-spin" /> : <Check size={15} />}
                              </button>
                              <button type="button" className="est-btn-icone" title="Cancelar"
                                onClick={() => setEditando(null)}><X size={15} /></button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="est-btn-icone" title="Editar mínimo, máximo e custo"
                                onClick={() => abrirEdicao(v)}><Pencil size={15} /></button>
                              <button type="button" className="est-btn-icone"
                                title={v.ativo ? 'Desativar (some das telas de movimentação)' : 'Reativar'}
                                disabled={ocupado === v.id} onClick={() => alternarAtivo(v)}>
                                {v.ativo ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
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
