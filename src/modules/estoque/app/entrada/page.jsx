import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { MOTIVOS_ENTRADA, CATEGORIAS, ehOperadorEstoque } from '../../../../config/estoque';
import { listarPosicao, lancarMovimentos } from '../../lib/estoque';
import { linhaVazia, validarCarrinho, montarMovimentos } from '../../lib/carrinho';
import Carrinho from '../components/Carrinho';

export default function EntradaEstoque() {
  const { modules } = useAuth();
  const operador = ehOperadorEstoque(modules);

  const [posicao, setPosicao] = useState([]);
  const [linhas, setLinhas] = useState([linhaVazia()]);
  const [motivo, setMotivo] = useState(MOTIVOS_ENTRADA[0]);
  const [documento, setDocumento] = useState('');
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

  const enviar = async (e) => {
    e.preventDefault();
    setFeito('');
    const problema = validarCarrinho(linhas, { tipo: 'entrada' });
    if (problema) { setErro(problema); return; }

    setOcupado(true);
    setErro('');
    try {
      const movs = montarMovimentos(linhas, { tipo: 'entrada', motivo, documento });
      const n = await lancarMovimentos(movs);
      setFeito(`${n} ${n === 1 ? 'lançamento registrado' : 'lançamentos registrados'} com sucesso.`);
      setLinhas([linhaVazia()]);
      setDocumento('');
      // Recarrega para o saldo da próxima entrada já sair certo.
      await carregar();
    } catch (err) {
      setErro(err.message);
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
    <div className="est-page">
      <div className="est-cab">
        <div className="est-cab-txt">
          <h1 className="est-title"><ArrowDownToLine size={22} /> Entrada de material</h1>
          <p className="est-sub">
            Recebimento de compra, devolução ou transferência. Cada linha vira um
            movimento no histórico do item.
          </p>
        </div>
      </div>

      {erro && <div className="est-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}
      {feito && <div className="est-aviso tom-ok"><CheckCircle2 size={16} /> {feito}</div>}

      <form onSubmit={enviar}>
        <div className="est-card">
          <h2 className="est-card-tit">Dados do lançamento</h2>
          <div className="est-linha">
            <div className="est-campo">
              <label htmlFor="e-motivo">Motivo<span className="req">*</span></label>
              <select id="e-motivo" className="est-select" value={motivo}
                onChange={(ev) => setMotivo(ev.target.value)}>
                {MOTIVOS_ENTRADA.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="est-campo">
              <label htmlFor="e-doc">Nota fiscal / documento</label>
              <input id="e-doc" className="est-input" value={documento}
                placeholder="NF 12345" onChange={(ev) => setDocumento(ev.target.value)} />
            </div>
            <div className="est-campo">
              <label htmlFor="e-cat">Filtrar catálogo por</label>
              <select id="e-cat" className="est-select" value={categoria}
                onChange={(ev) => setCategoria(ev.target.value)}>
                <option value="">Todas as categorias</option>
                {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.plural}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="est-card">
          <h2 className="est-card-tit">Itens recebidos</h2>
          {carregando ? (
            <div className="est-vazio"><Loader2 size={20} className="est-spin" /> Carregando catálogo…</div>
          ) : (
            <Carrinho
              linhas={linhas} onMudar={setLinhas} posicao={posicao}
              categoria={categoria} tipo="entrada" desabilitado={ocupado}
            />
          )}
          <div className="est-acoes">
            <button type="submit" className="est-btn est-btn-primary" disabled={ocupado || carregando}>
              {ocupado ? <Loader2 size={16} className="est-spin" /> : <ArrowDownToLine size={16} />}
              Registrar entrada
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
