import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import SeletorItens from './SeletorItens';
import { listarPosicao } from '../../lib/estoque';
import { detalheVariante, situacaoDoSaldo } from '../../lib/catalogo';
import '../../estoque.css';

/**
 * Escolha de itens do catálogo COM QUANTIDADE, para quem está PEDINDO — usado
 * no formulário de EPI e uniforme do Administrativo.
 *
 * Diferença essencial para o carrinho da tela de saída: aqui o saldo é
 * informativo, nunca bloqueia. Pedir um item em falta é justamente o que faz o
 * Administrativo saber que precisa comprar; travar o pedido no saldo esconderia
 * a demanda.
 *
 * O valor é o array `itens` que vai para chamados_adm.campos, com os dados
 * DENORMALIZADOS de propósito: o detalhe do chamado precisa continuar legível
 * anos depois, mesmo que a variante seja renomeada ou desativada.
 *
 * Props: `itens`, `onMudar(itens)`, `categoria`, `desabilitado`.
 */
export default function SeletorPedido({ itens = [], onMudar, categoria, desabilitado = false }) {
  const [posicao, setPosicao] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let cancelado = false;
    listarPosicao()
      .then((p) => { if (!cancelado) setPosicao(p); })
      .catch((e) => { if (!cancelado) { setErro(e.message); setPosicao([]); } });
    return () => { cancelado = true; };
  }, []);

  const lista = itens.length ? itens : [{ variante_id: '', quantidade: 1 }];

  const emitir = (novos) => onMudar(novos.filter((i) => i.variante_id));

  const escolher = (i, v) => {
    const novos = [...lista];
    novos[i] = {
      ...novos[i],
      variante_id: v.id,
      // Congelado no pedido: é o que a tela do chamado lê depois.
      descricao: v.descricao,
      tamanho: v.tamanho || '',
      ca: v.ca || '',
      genero: v.genero || '',
      setor: v.setor || '',
      quantidade: Number(novos[i].quantidade) > 0 ? Number(novos[i].quantidade) : 1,
    };
    emitir(novos);
  };

  const mudarQtd = (i, valor) => {
    const novos = [...lista];
    novos[i] = { ...novos[i], quantidade: valor };
    emitir(novos);
  };

  const remover = (i) => emitir(lista.filter((_, j) => j !== i));
  const adicionar = () => onMudar([...itens, { variante_id: '', quantidade: 1 }]);

  if (posicao === null) {
    return (
      <div className="estRoot est-embed">
        <div className="est-vazio"><Loader2 size={18} className="est-spin" /> Carregando o catálogo…</div>
      </div>
    );
  }

  return (
    <div className="estRoot est-embed">
      {erro && <div className="est-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {posicao.length === 0 && !erro && (
        <div className="est-aviso tom-alerta">
          <AlertCircle size={16} />
          O catálogo do estoque ainda está vazio. Descreva o que precisa no campo de
          descrição do chamado, logo abaixo.
        </div>
      )}

      <div className="est-carrinho">
        {lista.map((it, i) => {
          const v = posicao.find((p) => p.id === it.variante_id) || null;
          const situacao = v ? situacaoDoSaldo(v) : null;
          return (
            <div key={i} className="est-carrinho-linha sem-quem">
              <div className="est-campo">
                <SeletorItens
                  posicao={posicao}
                  categoria={categoria}
                  escolhida={v}
                  placeholder="Buscar item por nome, tamanho ou CA…"
                  onEscolher={(esc) => escolher(i, esc)}
                />
                {v && (
                  <span className="est-item-det">
                    {detalheVariante(v) || 'Sem variação'}
                    {' · '}
                    {/* Informativo: pedir item em falta é o que sinaliza a compra. */}
                    <span className={situacao === 'sem_estoque' ? 'is-critico' : ''}>
                      {v.saldo === 0
                        ? 'sem estoque no momento — o pedido segue mesmo assim'
                        : `${v.saldo} em estoque`}
                    </span>
                  </span>
                )}
              </div>

              <div className="est-campo">
                <label htmlFor={`ped-qtd-${i}`}>Qtd.</label>
                <input
                  id={`ped-qtd-${i}`} className="est-input est-input-num"
                  type="number" min="1" step="1" inputMode="numeric"
                  value={it.quantidade} disabled={desabilitado}
                  onChange={(e) => mudarQtd(i, e.target.value)}
                />
              </div>

              <button
                type="button" className="est-btn-icone" title="Remover item"
                aria-label={`Remover item ${i + 1}`}
                disabled={desabilitado || lista.length === 1}
                onClick={() => remover(i)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10 }}>
        <button type="button" className="est-btn est-btn-ghost est-btn-sm"
          onClick={adicionar} disabled={desabilitado}>
          <Plus size={15} /> Adicionar item
        </button>
      </div>
    </div>
  );
}
