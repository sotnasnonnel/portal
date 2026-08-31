import { Plus, Trash2 } from 'lucide-react';
import SeletorItens from './SeletorItens';
import { linhaVazia, variantesSemSaldo, linhaSemSaldo, saldoDaCondicao, totalizar } from '../../lib/carrinho';
import { CONDICOES } from '../../../../config/estoque';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Lista de itens de um lançamento (entrada ou saída). Compartilhado pelas duas
 * telas porque a diferença entre elas é uma coluna — "quem recebeu", que só a
 * saída tem (e o banco exige, por constraint).
 *
 * O saldo aparece embaixo de cada linha e a linha inteira fica vermelha quando o
 * LOTE não cabe no saldo — somando as linhas repetidas do mesmo item, que é o
 * caso que passaria batido validando linha a linha.
 */
export default function Carrinho({
  linhas, onMudar, posicao, categoria = '', tipo, pessoas = [], desabilitado = false,
}) {
  const semSaldo = tipo === 'saida' ? variantesSemSaldo(linhas) : new Set();
  const total = totalizar(linhas);

  const mexer = (i, patch) => onMudar(linhas.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const remover = (i) => onMudar(linhas.filter((_, j) => j !== i));
  const adicionar = () => onMudar([...linhas, linhaVazia()]);

  return (
    <>
      <div className="est-carrinho">
        {linhas.map((l, i) => {
          const v = l.variante;
          return (
            <div
              key={i}
              className={`est-carrinho-linha ${tipo === 'saida' ? '' : 'sem-quem'} `
                + `${linhaSemSaldo(l, semSaldo) ? 'is-erro' : ''}`}
            >
              <div className="est-campo">
                <label htmlFor={`item-${i}`}>Item{i === 0 ? <span className="req">*</span> : null}</label>
                <SeletorItens
                  id={`item-${i}`}
                  posicao={posicao}
                  categoria={categoria}
                  escolhida={v}
                  onEscolher={(esc) => mexer(i, { variante_id: esc.id, variante: esc })}
                />
                {v && (
                  // O saldo do BOLSO escolhido é o que decide a linha; o outro
                  // aparece ao lado para a pessoa poder trocar de condição.
                  <span className={`est-saldo-dica ${saldoDaCondicao(v, l.condicao) === 0 ? 'is-critico' : ''}`}>
                    Disponível: {saldoDaCondicao(v, l.condicao)} {v.unidade || 'un'}
                    {' · '}nova {v.saldo_novo} / usada {v.saldo_usado}
                  </span>
                )}
              </div>

              <div className="est-campo">
                <label htmlFor={`cond-${i}`}>Condição{i === 0 ? <span className="req">*</span> : null}</label>
                <select
                  id={`cond-${i}`}
                  className="est-select"
                  value={l.condicao || 'novo'}
                  disabled={desabilitado}
                  onChange={(e) => mexer(i, { condicao: e.target.value })}
                >
                  {CONDICOES.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
                </select>
              </div>

              <div className="est-campo">
                <label htmlFor={`qtd-${i}`}>Qtd.{i === 0 ? <span className="req">*</span> : null}</label>
                <input
                  id={`qtd-${i}`}
                  className="est-input est-input-num"
                  type="number" min="1" step="1" inputMode="numeric"
                  value={l.quantidade}
                  onChange={(e) => mexer(i, { quantidade: e.target.value })}
                />
              </div>

              {tipo === 'saida' && (
                <div className="est-campo">
                  <label htmlFor={`quem-${i}`}>Quem recebeu{i === 0 ? <span className="req">*</span> : null}</label>
                  <select
                    id={`quem-${i}`}
                    className="est-select"
                    value={l.colaborador_id}
                    onChange={(e) => mexer(i, { colaborador_id: e.target.value })}
                  >
                    <option value="">Selecione…</option>
                    {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}

              <button
                type="button"
                className="est-btn-icone"
                title="Remover item"
                aria-label={`Remover item ${i + 1}`}
                disabled={desabilitado || linhas.length === 1}
                onClick={() => remover(i)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="est-carrinho-rodape">
        <button type="button" className="est-btn est-btn-ghost est-btn-sm"
          onClick={adicionar} disabled={desabilitado}>
          <Plus size={15} /> Adicionar item
        </button>
        <span><strong>{total.linhas}</strong> {total.linhas === 1 ? 'linha' : 'linhas'}</span>
        <span><strong>{total.pecas}</strong> {total.pecas === 1 ? 'peça' : 'peças'}</span>
        {total.valor > 0 && <span>Valor: <strong>{BRL.format(total.valor)}</strong></span>}
      </div>
    </>
  );
}
