import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Boxes, Loader2, MapPin, Search, Send, X } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { listarIniciativas, areaLabel, tomDoEstagio } from '../../lib/iniciativas';
import { criarPedido } from '../../lib/pedidosIniciativa';
import PedirModal from './PedirModal';

/**
 * Iniciativas em uso — as soluções que a PHD JÁ TEM, e em quais obras cada uma
 * está aplicada.
 *
 * Tela de CONSULTA, e é por isso que ela não fica no Campo de Ideias: lá se
 * registra o que ainda não existe (ideia) ou o que a pessoa está construindo
 * sozinha (iniciativa). Aqui é o catálogo do que já roda em obra, mantido pela
 * Inovação no backoffice — ver lib/iniciativas.js.
 *
 * Além de consultar, dá para PEDIR a iniciativa para uma obra. O pedido é do
 * portal (programas_iniciativa_pedidos) — a Inovação responde por aqui, e quem
 * pediu acompanha na lista do fim da página.
 */

// Busca tolerante a acento e caixa: "producao" acha "Produção".
const normalizar = (s) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export default function IniciativasEmUso() {
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [obras, setObras] = useState(null);   // iniciativa com a lista de obras em popup
  const [pedindo, setPedindo] = useState(null);   // iniciativa em pedido
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelado = false;
    listarIniciativas()
      .then((d) => { if (!cancelado) setLinhas(d); })
      .catch((e) => { if (!cancelado) setErro(e.message); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, []);

  // Esc fecha o popup das obras, como nos outros diálogos do módulo.
  useEffect(() => {
    if (!obras) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setObras(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [obras]);

  const termo = normalizar(busca);
  const filtradas = useMemo(() => {
    if (!termo) return linhas;
    // A busca alcança as obras também: quem procura "AURA" quer saber o que
    // está rodando lá, não o que se chama AURA.
    return linhas.filter((i) => normalizar(`${i.titulo} ${i.subtitulo} ${i.responsavel}`).includes(termo)
      || i.aplicacoes.some((a) => normalizar(a.onde).includes(termo)));
  }, [linhas, termo]);

  const totalAtivas = linhas.reduce((n, i) => n + i.ativas, 0);

  // Enviado, a pessoa é levada para a tela dos pedidos: é lá que ela acompanha,
  // e ficar no catálogo depois de pedir deixa a impressão de que nada aconteceu.
  const enviarPedido = async (dados) => {
    await criarPedido(dados, user.id);
    setPedindo(null);
    navigate('/programas/pedidos');
  };

  return (
    <div className="pg-page pg-page-wide">
      <h1 className="pg-title"><Boxes size={24} /> Iniciativas em uso</h1>
      <p className="pg-sub">
        As soluções que a PHD já tem e em quais obras cada uma está aplicada.
        Quem mantém esta lista é a Inovação.
      </p>

      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div>
      ) : (
        <>
          {linhas.length > 0 && (
          <div className="pg-painel-topo">
            <div className="pg-busca">
              <Search size={18} />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por iniciativa, responsável ou obra"
                aria-label="Buscar iniciativa"
              />
              {busca && (
                <button type="button" className="pg-busca-limpa" onClick={() => setBusca('')} title="Limpar busca">
                  <X size={16} />
                </button>
              )}
            </div>
            <p className="pg-resumo">
              <strong>{linhas.length}</strong> iniciativas
              <span> · {totalAtivas} aplicação(ões) ativa(s)</span>
            </p>
          </div>

          )}

          {(linhas.length === 0 ? (
            <div className="pg-vazio">Nenhuma iniciativa cadastrada na Inovação.</div>
          ) : filtradas.length === 0 ? (
            <div className="pg-vazio">Nada encontrado para “{busca}”.</div>
          ) : (
            <div className="pg-inic-grid">
              {filtradas.map((i) => (
                  <div className="pg-card pg-inic" key={i.id}>
                    <div className="pg-inic-cab">
                      <h2>{i.titulo}</h2>
                      <span className={`pg-badge ${tomDoEstagio(i.estagio)}`}>{i.estagio}</span>
                    </div>
                    <p className="pg-inic-desc">{i.subtitulo}</p>

                    <dl className="pg-inic-meta">
                      <div><dt>Área</dt><dd>{areaLabel(i.area)}</dd></div>
                      <div><dt>Responsável</dt><dd>{i.responsavel || '—'}</dd></div>
                    </dl>

                    <div className="pg-inic-acoes">
                      <button
                        type="button"
                        className="pg-btn pg-btn-primary pg-btn-sm"
                        onClick={() => setPedindo(i)}
                      >
                        <Send size={14} /> Pedir para minha obra
                      </button>
                    </div>

                    {i.aplicacoes.length === 0 ? (
                      <p className="pg-inic-sem">Ainda não aplicada em nenhuma obra.</p>
                    ) : (
                      // As obras abrem em popup: uma iniciativa está em 8
                      // delas, e expandir no card empurrava a grade inteira
                      // para ler uma lista de códigos.
                      <button
                        type="button"
                        className="pg-inic-toggle"
                        onClick={() => setObras(i)}
                        aria-haspopup="dialog"
                      >
                        <MapPin size={15} />
                        {i.ativas > 0
                          ? `Aplicada em ${i.ativas} obra(s)`
                          : `${i.aplicacoes.length} aplicação(ões) encerrada(s)`}
                      </button>
                    )}
                  </div>
              ))}
            </div>
          ))}
        </>
      )}

      {pedindo && (
        <PedirModal
          iniciativa={pedindo}
          jaAplicada={pedindo.aplicacoes.filter((a) => a.ativa).map((a) => a.onde)}
          onFechar={() => setPedindo(null)}
          onEnviar={enviarPedido}
        />
      )}

      {obras && (
        <div className="pg-modal-overlay" onClick={() => setObras(null)}>
          <div
            className="pg-modal pg-obras-modal" onClick={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-label={`Obras de ${obras.titulo}`}
          >
            <div className="pg-modal-cab">
              <h2>{obras.titulo}</h2>
              <button type="button" className="pg-modal-x" onClick={() => setObras(null)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="pg-modal-corpo">
              <p className="pg-campo-dica">
                {obras.ativas} de {obras.aplicacoes.length} aplicação(ões) em uso hoje.
              </p>
              <ul className="pg-inic-obras">
                {obras.aplicacoes.map((a) => (
                  <li key={a.id} className={a.ativa ? '' : 'is-encerrada'}>
                    <strong>{a.onde}</strong>
                    <span>
                      {a.gerente ? `${a.gerente} · ` : ''}
                      {a.produto ? `${a.produto} · ` : ''}
                      {a.ativa ? `em uso desde ${a.inicio}` : `encerrada em ${a.fim}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pg-modal-pe">
              <button type="button" className="pg-btn pg-btn-ghost" onClick={() => setObras(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
