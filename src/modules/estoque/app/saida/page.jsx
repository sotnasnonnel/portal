import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpFromLine, Loader2, AlertCircle, CheckCircle2, Ticket, Info } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { MOTIVOS_SAIDA, CATEGORIAS, ehOperadorEstoque } from '../../../../config/estoque';
import {
  listarPosicao, listarPessoasEstoque, listarChamadosElegiveis, lancarMovimentos, baixarChamado,
} from '../../lib/estoque';
import { linhaVazia, validarCarrinho, montarMovimentos } from '../../lib/carrinho';
import Carrinho from '../components/Carrinho';

const RESOLUCAO_PADRAO = 'Itens entregues pelo Estoque.';

export default function SaidaEstoque() {
  const { modules } = useAuth();
  const operador = ehOperadorEstoque(modules);

  const [posicao, setPosicao] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [chamados, setChamados] = useState([]);
  const [linhas, setLinhas] = useState([linhaVazia()]);
  const [motivo, setMotivo] = useState(MOTIVOS_SAIDA[0]);
  const [categoria, setCategoria] = useState('');
  const [chamadoId, setChamadoId] = useState('');
  const [resolucao, setResolucao] = useState(RESOLUCAO_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState('');
  const [semItensDoChamado, setSemItensDoChamado] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [pos, pes, cham] = await Promise.all([
        listarPosicao(), listarPessoasEstoque(), listarChamadosElegiveis(),
      ]);
      setPosicao(pos);
      setPessoas(pes);
      setChamados(cham);
      return pos;
    } catch (e) {
      setErro(e.message);
      return [];
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const chamado = chamados.find((c) => c.id === chamadoId) || null;

  /**
   * Escolher o chamado pré-preenche o carrinho com o que foi PEDIDO e assume o
   * solicitante como quem recebe — que é o caso normal. Tudo continua editável:
   * o que foi entregue nem sempre é o que foi pedido.
   */
  const escolherChamado = (id) => {
    setChamadoId(id);
    setFeito('');
    setErro('');
    setSemItensDoChamado(false);

    if (!id) { setLinhas([linhaVazia()]); return; }

    const c = chamados.find((x) => x.id === id);
    const itens = Array.isArray(c?.itens) ? c.itens : [];
    // Chamado antigo (ou vindo do desdobramento da mobilização) não tem itens
    // estruturados — é o caso NORMAL de todo chamado aberto até hoje.
    const novas = itens
      .map((it) => {
        const v = posicao.find((p) => p.id === it.variante_id);
        return v ? {
          ...linhaVazia(),
          variante_id: v.id, variante: v,
          quantidade: Number(it.quantidade) > 0 ? Number(it.quantidade) : 1,
          colaborador_id: c.solicitante_id || '',
        } : null;
      })
      .filter(Boolean);

    setSemItensDoChamado(novas.length === 0);
    setLinhas(novas.length ? novas : [{ ...linhaVazia(), colaborador_id: c?.solicitante_id || '' }]);
  };

  const enviar = async (e) => {
    e.preventDefault();
    setFeito('');
    const problema = validarCarrinho(linhas, { tipo: 'saida' });
    if (problema) { setErro(problema); return; }
    if (chamadoId && !resolucao.trim()) {
      setErro('Escreva a resolução — é o texto que o solicitante lê ao avaliar o chamado.');
      return;
    }

    setOcupado(true);
    setErro('');
    try {
      const movs = montarMovimentos(linhas, { tipo: 'saida', motivo });
      if (chamadoId) {
        const r = await baixarChamado(chamadoId, resolucao, movs);
        setFeito(`Chamado #${r?.numero ?? ''} fechado e ${r?.movimentos ?? movs.length} `
          + `${(r?.movimentos ?? movs.length) === 1 ? 'item baixado' : 'itens baixados'} do estoque.`);
      } else {
        const n = await lancarMovimentos(movs);
        setFeito(`${n} ${n === 1 ? 'saída registrada' : 'saídas registradas'} com sucesso.`);
      }
      setChamadoId('');
      setResolucao(RESOLUCAO_PADRAO);
      setLinhas([linhaVazia()]);
      setSemItensDoChamado(false);
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
          <h1 className="est-title"><ArrowUpFromLine size={22} /> Saída de material</h1>
          <p className="est-sub">
            Entrega de EPI ou uniforme. Toda saída registra quem recebeu — é o que
            permite consultar depois o que cada pessoa já retirou.
          </p>
        </div>
      </div>

      {erro && <div className="est-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}
      {feito && <div className="est-aviso tom-ok"><CheckCircle2 size={16} /> {feito}</div>}

      <form onSubmit={enviar}>
        <div className="est-card">
          <h2 className="est-card-tit"><Ticket size={13} /> Chamado a quitar</h2>
          <div className="est-campo">
            <label htmlFor="s-chamado">Esta entrega atende a um chamado do Administrativo?</label>
            <select id="s-chamado" className="est-select" value={chamadoId}
              onChange={(ev) => escolherChamado(ev.target.value)} disabled={ocupado}>
              <option value="">Não — saída avulsa</option>
              {chamados.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.numero} · {c.solicitante_nome || 'Sem nome'} · {c.assunto}
                </option>
              ))}
            </select>
            <span className="est-campo-dica">
              {chamados.length === 0
                ? 'Nenhum chamado de EPI ou uniforme em andamento no momento.'
                : 'Ao escolher, os itens pedidos entram no carrinho e o chamado é fechado junto com a baixa.'}
            </span>
          </div>

          {semItensDoChamado && (
            <div className="est-aviso tom-alerta">
              <Info size={16} />
              Este chamado foi aberto antes de o pedido passar a escolher itens do catálogo
              (ou veio de uma mobilização). Escolha na mão o que está sendo entregue.
            </div>
          )}

          {chamado && (
            <div className="est-campo">
              <label htmlFor="s-res">Resolução da solicitação<span className="req">*</span></label>
              <textarea id="s-res" className="est-textarea" value={resolucao}
                onChange={(ev) => setResolucao(ev.target.value)}
                placeholder="O que foi feito para resolver o pedido." />
              <span className="est-campo-dica">
                Ao confirmar, o chamado #{chamado.numero} será fechado e este texto vai para o
                solicitante. Baixa e fechamento acontecem juntos — ou os dois, ou nenhum.
              </span>
            </div>
          )}
        </div>

        <div className="est-card">
          <h2 className="est-card-tit">Itens entregues</h2>
          <div className="est-linha">
            <div className="est-campo">
              <label htmlFor="s-motivo">Motivo<span className="req">*</span></label>
              <select id="s-motivo" className="est-select" value={motivo}
                onChange={(ev) => setMotivo(ev.target.value)}>
                {MOTIVOS_SAIDA.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="est-campo">
              <label htmlFor="s-cat">Filtrar catálogo por</label>
              <select id="s-cat" className="est-select" value={categoria}
                onChange={(ev) => setCategoria(ev.target.value)}>
                <option value="">Todas as categorias</option>
                {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.plural}</option>)}
              </select>
            </div>
          </div>

          {carregando ? (
            <div className="est-vazio"><Loader2 size={20} className="est-spin" /> Carregando catálogo…</div>
          ) : (
            <Carrinho
              linhas={linhas} onMudar={setLinhas} posicao={posicao} categoria={categoria}
              tipo="saida" pessoas={pessoas} desabilitado={ocupado}
            />
          )}

          <div className="est-acoes">
            <button type="submit" className="est-btn est-btn-primary" disabled={ocupado || carregando}>
              {ocupado ? <Loader2 size={16} className="est-spin" /> : <ArrowUpFromLine size={16} />}
              {chamadoId ? 'Baixar e fechar chamado' : 'Registrar saída'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
