import { Plus, Trash2, Loader2, PackageCheck, Info } from 'lucide-react';
import SeletorItens from '../../../estoque/app/components/SeletorItens';
import { variantesSemSaldo } from '../../../estoque/lib/carrinho';
import { detalheVariante } from '../../../estoque/lib/catalogo';
import '../../../estoque/estoque.css';

/**
 * Baixa de estoque dentro do card "Fechar chamado" do Administrativo.
 *
 * Só aparece em EPI e uniforme (ver chamadoUsaEstoque em lib/estoqueDoChamado.js);
 * para os outros ~24 serviços o card de fechamento continua exatamente como
 * sempre foi. Componentes e estilos vêm do módulo de Estoque — dependência de
 * mão única, o Adm importa de lá.
 *
 * Três casos que a tela precisa aguentar, e todos são comuns:
 *  - chamado LEGADO (aberto antes do pedido estruturado) ou filho de mobilização:
 *    chega sem itens, e é por isso que existe o "adicionar item do catálogo";
 *  - REABERTURA: a coluna "já entregue" impede baixar o mesmo material de novo;
 *  - fechar SEM movimentar: item comprado direto, pedido negado, catálogo ainda
 *    incompleto. É o checkbox.
 */
export default function BaixaEstoque({
  linhas, onMudar, posicao, pessoas, categoria, carregando,
  semMovimentar, onSemMovimentar, desabilitado = false,
}) {
  const semSaldo = variantesSemSaldo(linhas.filter((l) => Number(l.quantidade) > 0));

  const mexer = (i, patch) => onMudar(linhas.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const remover = (i) => onMudar(linhas.filter((_, j) => j !== i));
  const adicionar = () => onMudar([...linhas, {
    variante_id: '', variante: null, descricaoPedida: '', detalhePedido: '',
    pedido: 0, jaEntregue: 0, quantidade: 1, colaborador_id: '', motivo: 'Entrega por chamado',
  }]);

  return (
    <div className="estRoot est-embed" style={{ marginBottom: 16 }}>
      <div className="est-card">
        <h3 className="est-card-tit"><PackageCheck size={13} /> Baixa no estoque</h3>

        <label className="est-check" style={{ marginBottom: 12 }}>
          <input
            type="checkbox" checked={semMovimentar} disabled={desabilitado}
            onChange={(e) => onSemMovimentar(e.target.checked)}
          />
          Fechar sem movimentar o estoque
        </label>

        {semMovimentar ? (
          <div className="est-aviso tom-info" style={{ marginBottom: 0 }}>
            <Info size={16} />
            O chamado será fechado e o saldo do estoque ficará como está. Use quando o item
            foi comprado direto, o pedido não foi atendido, ou a baixa já foi lançada à mão.
          </div>
        ) : carregando ? (
          <div className="est-vazio"><Loader2 size={18} className="est-spin" /> Carregando o estoque…</div>
        ) : (
          <>
            {linhas.length === 0 ? (
              <p className="est-campo-dica" style={{ marginBottom: 12 }}>
                Este chamado não traz itens do catálogo — foi aberto antes de o pedido passar a
                escolher itens do estoque, ou veio de uma mobilização. Adicione o que está
                sendo entregue, ou marque a opção acima para fechar sem mexer no saldo.
              </p>
            ) : (
              <div className="est-tabela-scroll" style={{ marginBottom: 12 }}>
                <table className="est-tabela">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="num">Pedido</th>
                      <th className="num">Já entregue</th>
                      <th className="num">Saldo</th>
                      <th className="num">A entregar</th>
                      <th>Quem recebeu</th>
                      <th aria-label="Remover" />
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, i) => {
                      const v = l.variante;
                      const erro = l.variante_id && semSaldo.has(l.variante_id);
                      return (
                        <tr key={i} style={erro ? { background: '#fef2f2' } : undefined}>
                          <td style={{ minWidth: 230 }}>
                            {v || !l.variante_id ? (
                              <SeletorItens
                                posicao={posicao} categoria={categoria} escolhida={v}
                                onEscolher={(esc) => mexer(i, { variante_id: esc.id, variante: esc })}
                              />
                            ) : (
                              // Variante desativada ou removida do catálogo: mostra o que o
                              // pedido registrou, para a pessoa reconhecer e escolher o
                              // equivalente — em vez de uma linha em branco sem explicação.
                              <>
                                <span className="est-item-nome">{l.descricaoPedida || 'Item fora do catálogo'}</span>
                                <span className="est-item-det">
                                  {l.detalhePedido} · não está mais no catálogo
                                </span>
                              </>
                            )}
                            {v && <span className="est-item-det">{detalheVariante(v)}</span>}
                          </td>
                          <td className="num">{l.pedido || '—'}</td>
                          <td className="num">{l.jaEntregue || '—'}</td>
                          <td className={`num ${v && v.saldo === 0 ? 'is-critico' : ''}`}>
                            {v ? v.saldo : '—'}
                          </td>
                          <td className="num" style={{ width: 96 }}>
                            <input
                              className="est-input est-input-num" type="number" min="0" step="1"
                              inputMode="numeric" value={l.quantidade} disabled={desabilitado}
                              aria-label={`Quantidade a entregar do item ${i + 1}`}
                              onChange={(e) => mexer(i, { quantidade: e.target.value })}
                            />
                          </td>
                          <td style={{ minWidth: 170 }}>
                            <select
                              className="est-select" value={l.colaborador_id} disabled={desabilitado}
                              aria-label={`Quem recebeu o item ${i + 1}`}
                              onChange={(e) => mexer(i, { colaborador_id: e.target.value })}
                            >
                              <option value="">Selecione…</option>
                              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                            </select>
                          </td>
                          <td>
                            <button
                              type="button" className="est-btn-icone" title="Remover linha"
                              aria-label={`Remover linha ${i + 1}`} disabled={desabilitado}
                              onClick={() => remover(i)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <button type="button" className="est-btn est-btn-ghost est-btn-sm"
              onClick={adicionar} disabled={desabilitado}>
              <Plus size={15} /> Adicionar item do catálogo
            </button>
            <p className="est-campo-dica" style={{ marginTop: 10 }}>
              Deixe em <strong>0</strong> o que não foi entregue. Ao confirmar, a baixa e o
              fechamento acontecem juntos — ou os dois, ou nenhum.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
