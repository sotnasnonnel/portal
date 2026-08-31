import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Search, ArrowRight } from 'lucide-react';
import { SITUACOES } from '../../../../config/estoque';
import { detalheVariante, normalizar, rotuloVariante } from '../../lib/catalogo';
import { listaPorSituacao } from '../../lib/indicadores';

/**
 * O que está por trás de um número do painel.
 *
 * Um indicador que só diz "7 sem estoque" obriga a pessoa a ir para outra tela e
 * refazer o filtro para descobrir QUAIS são — e é isso que ela quer saber. Aqui
 * a lista abre por cima, ordenada pelo que decide a ação (maior falta primeiro,
 * ou maior excesso), e o rodapé leva para a Posição já filtrada quando a pessoa
 * precisa editar mínimo/máximo.
 *
 * Recebe a posição que o painel já carregou: nenhuma consulta nova.
 */

const TITULO = {
  sem_estoque: 'Itens sem estoque',
  abaixo_minimo: 'Itens abaixo do mínimo',
  acima_maximo: 'Itens acima do máximo',
};

const EXPLICACAO = {
  sem_estoque: 'Saldo zerado. Se houver pedido em aberto, não há o que entregar.',
  abaixo_minimo: 'Ainda há peça, mas abaixo do mínimo cadastrado — hora de repor.',
  acima_maximo: 'Mais peças do que o máximo cadastrado: dinheiro parado e risco de vencer.',
};

export default function ListaSituacao({ situacao, posicao, onFechar }) {
  const [termo, setTermo] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar]);

  const todos = useMemo(() => listaPorSituacao(posicao, situacao), [posicao, situacao]);

  const lista = useMemo(() => {
    const partes = normalizar(termo).split(' ').filter(Boolean);
    if (!partes.length) return todos;
    return todos.filter((v) => {
      const alvo = normalizar(rotuloVariante(v));
      return partes.every((p) => alvo.includes(p));
    });
  }, [todos, termo]);

  const excesso = situacao === 'acima_maximo';

  return (
    <div className="estRoot est-modal-overlay" onClick={onFechar}>
      <div
        className="est-modal"
        role="dialog"
        aria-modal="true"
        aria-label={TITULO[situacao] || 'Itens'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="est-modal-cab">
          <div>
            <h2>{TITULO[situacao] || 'Itens'}</h2>
            <p>{EXPLICACAO[situacao]}</p>
          </div>
          <button type="button" className="est-btn-icone" onClick={onFechar} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {todos.length > 8 && (
          <div className="est-busca est-modal-busca">
            <Search size={16} />
            <input
              className="est-input" value={termo} autoFocus
              placeholder="Filtrar esta lista…"
              aria-label="Filtrar a lista"
              onChange={(e) => setTermo(e.target.value)}
            />
          </div>
        )}

        <div className="est-modal-corpo">
          {lista.length === 0 ? (
            <div className="est-vazio">
              {todos.length === 0 ? 'Nenhum item nesta situação. ' : 'Nada encontrado com esse filtro.'}
            </div>
          ) : (
            <table className="est-tabela">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Nova</th>
                  <th className="num">Usada</th>
                  <th className="num">Total</th>
                  <th className="num">{excesso ? 'Máx.' : 'Mín.'}</th>
                  <th className="num">{excesso ? 'Excedem' : 'Faltam'}</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <span className="est-item-nome">{v.descricao}</span>
                      <span className="est-item-det">{detalheVariante(v) || '—'}</span>
                    </td>
                    <td className="num">{v.saldo_novo}</td>
                    <td className="num">{v.saldo_usado}</td>
                    <td className={`num ${v.saldo === 0 ? 'is-critico' : ''}`}>{v.saldo}</td>
                    <td className="num">
                      {excesso ? (v.estoque_maximo ?? '—') : (v.estoque_minimo || '—')}
                    </td>
                    <td className={`num ${excesso ? '' : 'is-alerta'}`}>
                      {excesso ? v.excesso : v.deficit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="est-modal-rodape">
          <span>
            <strong>{lista.length}</strong>
            {lista.length === todos.length ? '' : ` de ${todos.length}`}
            {lista.length === 1 ? ' item' : ' itens'}
          </span>
          {/* A Posição é onde se edita mínimo e máximo — que é a ação que
              costuma vir depois de olhar esta lista. */}
          <Link
            className="est-btn est-btn-ghost est-btn-sm est-acoes-fim"
            to={`/estoque/posicao?situacao=${situacao}`}
            onClick={onFechar}
          >
            Abrir na Posição de estoque <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
