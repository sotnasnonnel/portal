import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Loader2, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { CATEGORIAS, MOTIVOS_AJUSTE, ehOperadorEstoque } from '../../../../config/estoque';
import { listarPosicao, lancarMovimentos } from '../../lib/estoque';
import { movimentosDeInventario } from '../../lib/carrinho';
import { filtrarPosicao, detalheVariante } from '../../lib/catalogo';

export default function AjusteEstoque() {
  const { modules } = useAuth();
  const operador = ehOperadorEstoque(modules);

  const [posicao, setPosicao] = useState([]);
  const [contagem, setContagem] = useState({});   // variante_id -> valor digitado
  const [motivo, setMotivo] = useState(MOTIVOS_AJUSTE[0]);
  const [termo, setTermo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setPosicao(await listarPosicao());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const lista = useMemo(
    () => filtrarPosicao(posicao, { termo, categoria }),
    [posicao, termo, categoria],
  );

  // Só o que foi contado E diverge vira movimento. Item não contado fica de fora
  // — inventário parcial é o normal (conta-se uma prateleira por vez).
  //
  // Conta os DOIS bolsos separadamente: quem contou 4 peças novas não disse nada
  // sobre as usadas, e um ajuste que somasse tudo zeraria as usadas em silêncio.
  const movimentos = useMemo(
    () => movimentosDeInventario(
      posicao.flatMap((v) => ['novo', 'usado'].map((condicao) => ({
        variante_id: v.id, condicao, contagem: contagem[`${v.id}|${condicao}`] ?? '', variante: v,
      }))),
      { motivo },
    ),
    [posicao, contagem, motivo],
  );

  const contados = Object.values(contagem).filter((c) => c !== '' && c !== undefined).length;

  const enviar = async () => {
    if (!movimentos.length) { setErro('Nenhuma divergência para ajustar.'); return; }
    setOcupado(true);
    setErro('');
    setFeito('');
    try {
      const n = await lancarMovimentos(movimentos);
      setFeito(`${n} ${n === 1 ? 'ajuste aplicado' : 'ajustes aplicados'}. O saldo agora bate com a contagem.`);
      setContagem({});
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  };

  if (!operador) {
    return (
      <div className="est-page">
        <div className="est-aviso tom-info">
          <AlertCircle size={16} />
          Só o time do Administrativo movimenta o estoque. Você pode{' '}
          <Link to="/estoque/posicao">consultar a posição</Link>.
        </div>
      </div>
    );
  }

  return (
    <div className="est-page est-page-wide">
      <div className="est-cab">
        <div className="est-cab-txt">
          <h1 className="est-title"><ClipboardCheck size={22} /> Inventário</h1>
          <p className="est-sub">
            Digite o que foi <strong>contado na prateleira</strong>, separando peça nova
            de peça usada. Só o que divergir do sistema vira um ajuste — campo deixado em
            branco não é tocado, então dá para conferir uma prateleira (ou só as novas)
            por vez.
          </p>
        </div>
      </div>

      {erro && <div className="est-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}
      {feito && <div className="est-aviso tom-ok"><CheckCircle2 size={16} /> {feito}</div>}

      <div className="est-card">
        <div className="est-linha">
          <div className="est-campo" style={{ flex: '2 1 260px' }}>
            <label htmlFor="a-busca">Buscar item</label>
            <div className="est-busca">
              <Search size={16} />
              <input id="a-busca" className="est-input" value={termo}
                placeholder="Nome, tamanho ou CA…"
                onChange={(e) => setTermo(e.target.value)} />
            </div>
          </div>
          <div className="est-campo">
            <label htmlFor="a-cat">Categoria</label>
            <select id="a-cat" className="est-select" value={categoria}
              onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Todas</option>
              {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.plural}</option>)}
            </select>
          </div>
          <div className="est-campo">
            <label htmlFor="a-motivo">Motivo do ajuste</label>
            <select id="a-motivo" className="est-select" value={motivo}
              onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS_AJUSTE.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {carregando ? (
        <div className="est-vazio"><Loader2 size={20} className="est-spin" /> Carregando…</div>
      ) : lista.length === 0 ? (
        <div className="est-vazio">Nenhum item encontrado.</div>
      ) : (
        <div className="est-tabela-scroll">
          <table className="est-tabela">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Nova (sistema)</th>
                <th className="num">Nova (contado)</th>
                <th className="num">Usada (sistema)</th>
                <th className="num">Usada (contado)</th>
                <th className="num">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((v) => {
                const deltaDe = (cond, sistema) => {
                  const cru = contagem[`${v.id}|${cond}`] ?? '';
                  const vale = cru !== '' && Number.isInteger(Number(cru)) && Number(cru) >= 0;
                  return vale ? Number(cru) - sistema : null;
                };
                const dNovo = deltaDe('novo', v.saldo_novo);
                const dUsado = deltaDe('usado', v.saldo_usado);
                const soma = (dNovo ?? 0) + (dUsado ?? 0);
                const nada = dNovo === null && dUsado === null;
                const campo = (cond) => (
                  <input
                    className="est-input est-input-num" type="number" min="0" step="1"
                    inputMode="numeric" value={contagem[`${v.id}|${cond}`] ?? ''}
                    aria-label={`Contagem de ${v.descricao} (${cond})`}
                    onChange={(e) => setContagem({ ...contagem, [`${v.id}|${cond}`]: e.target.value })}
                  />
                );
                return (
                  <tr key={v.id}>
                    <td>
                      <span className="est-item-nome">{v.descricao}</span>
                      <span className="est-item-det">{detalheVariante(v) || '—'}</span>
                    </td>
                    <td className="num">{v.saldo_novo}</td>
                    <td className="num est-col-min">{campo('novo')}</td>
                    <td className="num">{v.saldo_usado}</td>
                    <td className="num est-col-min">{campo('usado')}</td>
                    <td className={`num ${soma ? (soma > 0 ? 'is-alerta' : 'is-critico') : ''}`}>
                      {nada ? '—' : soma === 0 ? 'confere' : (soma > 0 ? `+${soma}` : soma)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="est-carrinho-rodape">
        <span><strong>{contados}</strong> {contados === 1 ? 'item contado' : 'itens contados'}</span>
        <span><strong>{movimentos.length}</strong> {movimentos.length === 1 ? 'divergência' : 'divergências'}</span>
        <button type="button" className="est-btn est-btn-primary est-acoes-fim"
          disabled={ocupado || !movimentos.length} onClick={enviar}>
          {ocupado ? <Loader2 size={16} className="est-spin" /> : <ClipboardCheck size={16} />}
          Aplicar ajustes
        </button>
      </div>
    </div>
  );
}
