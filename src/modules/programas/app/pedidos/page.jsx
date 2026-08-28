import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, ClipboardList, Loader2, MapPin, MessageSquare, Search, User, X,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { ehAdminProgramas, STATUS_PEDIDO, STATUS_PEDIDO_LABEL, tomDoPedido } from '../../../../config/programas';
import { listarPedidos, responderPedido } from '../../lib/pedidosIniciativa';
import AndamentoModal from '../iniciativas/AndamentoModal';

/**
 * Pedidos de iniciativa para uma obra.
 *
 * Tela própria, e não um bloco em "Iniciativas em uso": lá é catálogo — o que a
 * empresa tem — e aqui é fila de trabalho, com dono, situação e andamento.
 *
 * O CONTROLE são os contadores por situação, que também filtram. É a leitura
 * que o admin faz primeiro ("o que está parado comigo?") e a que uma tabela
 * sozinha não dá: para saber quantos estão em análise, era preciso contar na
 * mão. Recusado fica no fim porque é saída da fila, não etapa dela.
 *
 * Cartão em vez de linha de tabela: cada pedido tem um texto livre
 * (justificativa) e outro de resposta, e texto corrido espremido em célula de
 * tabela é o que fazia esta tela pedir rolagem lateral.
 *
 * A lista é a mesma consulta para todos: quem pediu vê os seus, o admin vê
 * todos. Quem decide isso é a RLS, não esta tela.
 */

const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—');

const normalizar = (s) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export default function PedidosIniciativa() {
  const { modules } = useAuth();
  const souAdmin = ehAdminProgramas(modules);

  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [andamento, setAndamento] = useState(null);
  const [fStatus, setFStatus] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    listarPedidos()
      .then(setPedidos)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  const termo = normalizar(busca);
  const filtrados = useMemo(() => pedidos.filter((p) => (
    (!fStatus || p.status === fStatus)
    && (!termo || normalizar(`${p.iniciativa_titulo} ${p.obra_cod_phd} ${p.solicitanteNome} ${p.justificativa}`).includes(termo))
  )), [pedidos, fStatus, termo]);

  // Contagem sobre o conjunto SEM o filtro de situação: o número da etiqueta
  // diz quantos o clique traz, e não quantos sobraram do clique anterior.
  const semStatus = useMemo(() => pedidos.filter((p) => (
    !termo || normalizar(`${p.iniciativa_titulo} ${p.obra_cod_phd} ${p.solicitanteNome} ${p.justificativa}`).includes(termo)
  )), [pedidos, termo]);
  const contar = (valor) => semStatus.filter((p) => p.status === valor).length;

  // Salvar vem do modal: ele fica aberto depois, mostrando o passo novo no
  // histórico — fechar sozinho esconderia justamente a confirmação do que
  // acabou de ser feito.
  const responder = async (valores) => {
    const atualizado = await responderPedido(andamento, valores);
    setPedidos((atual) => atual.map((p) => (p.id === atualizado.id ? atualizado : p)));
    setAndamento(atualizado);
  };

  return (
    <div className="pg-page pg-page-wide">
      <h1 className="pg-title">
        <ClipboardList size={24} /> {souAdmin ? 'Pedidos recebidos' : 'Meus pedidos'}
      </h1>
      <p className="pg-sub">
        {souAdmin
          ? 'Iniciativas pedidas para obras. Mude a situação e responda a quem pediu.'
          : 'As iniciativas que você pediu para a sua obra, e em que pé cada uma está.'}
      </p>

      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div>
      ) : pedidos.length === 0 ? (
        <div className="pg-vazio">
          {souAdmin ? (
            'Ninguém pediu nenhuma iniciativa ainda.'
          ) : (
            <>
              Você ainda não pediu nenhuma iniciativa.{' '}
              <Link className="pg-link" to="/programas/iniciativas">Ver o que a PHD já tem</Link>.
            </>
          )}
        </div>
      ) : (
        <>
          {/* ---- controle: contadores por situação, que também filtram ---- */}
          <div className="pg-controle">
            <button
              type="button"
              className={`pg-controle-item ${fStatus === '' ? 'is-on' : ''}`}
              onClick={() => setFStatus('')}
              aria-pressed={fStatus === ''}
            >
              <strong>{semStatus.length}</strong>
              <span>Todos</span>
            </button>
            {STATUS_PEDIDO.map((s) => (
              <button
                key={s.valor}
                type="button"
                className={`pg-controle-item ${s.tom} ${fStatus === s.valor ? 'is-on' : ''}`}
                onClick={() => setFStatus(fStatus === s.valor ? '' : s.valor)}
                aria-pressed={fStatus === s.valor}
              >
                <strong>{contar(s.valor)}</strong>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          <div className="pg-busca pg-busca-solta">
            <Search size={18} />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por iniciativa, obra ou quem pediu"
              aria-label="Buscar pedido"
            />
            {busca && (
              <button type="button" className="pg-busca-limpa" onClick={() => setBusca('')} title="Limpar busca">
                <X size={16} />
              </button>
            )}
          </div>

          {filtrados.length === 0 ? (
            <div className="pg-vazio">Nenhum pedido com esse filtro.</div>
          ) : (
            <div className="pg-pedido-lista">
              {filtrados.map((p) => (
                // O cartão inteiro abre o pedido: responder exige ler o que a
                // pessoa pediu, e a decisão se toma lá dentro. Botão, e não div
                // com onClick, para entrar na navegação por teclado.
                <button
                  type="button"
                  className="pg-card pg-pedido"
                  key={p.id}
                  onClick={() => setAndamento(p)}
                  aria-haspopup="dialog"
                >
                  <span className="pg-pedido-cab">
                    <span className="pg-pedido-num">#{p.numero}</span>
                    <span className="pg-pedido-tit">{p.iniciativa_titulo}</span>
                    <span className={`pg-badge ${tomDoPedido(p.status)}`}>
                      {STATUS_PEDIDO_LABEL[p.status] || p.status}
                    </span>
                  </span>

                  <span className="pg-pedido-meta">
                    <span><MapPin size={14} /> {p.obra_cod_phd}</span>
                    {souAdmin && (
                      <span title={p.solicitanteNomeCompleto || ''}>
                        <User size={14} /> {p.solicitanteNome || '—'}
                      </span>
                    )}
                    <span>{dataHora(p.criado_em)}</span>
                  </span>

                  <span className="pg-pedido-just">{p.justificativa}</span>

                  {p.resposta && (
                    <span className="pg-pedido-resposta">
                      <MessageSquare size={14} /> {p.resposta}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {andamento && (
        <AndamentoModal
          pedido={andamento}
          podeResponder={souAdmin}
          onResponder={responder}
          onFechar={() => setAndamento(null)}
        />
      )}
    </div>
  );
}
