import { useMemo, useState } from 'react';
import { Search, Loader2, Boxes, ChevronDown, Hammer } from 'lucide-react';
import { listarPosicao } from '../../lib/estoque';
import { filtrarPosicao, detalheVariante } from '../../lib/catalogo';
import { SITUACOES } from '../../../../config/estoque';
import { ESTOQUE_VITRINE } from '../../../../config/estoqueModo';
// O CSS do módulo vem junto: este componente é usado DENTRO do Administrativo,
// que não carrega o estoque.css. Tudo está escopado em .estRoot, então importar
// aqui não vaza estilo para o módulo hospedeiro.
import '../../estoque.css';

/**
 * Consulta de saldo embutível — feita para o card do chamado do Administrativo,
 * onde o atendente precisa saber se TEM o item antes de prometer a entrega, sem
 * trocar de módulo.
 *
 * Mora no módulo de Estoque e é importado pelo Adm: dependência de mão única.
 *
 * Nasce fechado e SÓ CARREGA quando aberto — assim ele não custa uma query em
 * toda abertura de chamado. Funciona para qualquer pessoa logada porque a policy
 * de select do catálogo é `using (true)`; movimentar é que exige ser do time.
 *
 * Props: `categoria` ('epi' | 'uniforme' | '') sugere o filtro inicial.
 */
export default function ConsultaEstoque({ categoria = '', titulo = 'Consultar estoque' }) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [termo, setTermo] = useState('');
  const [cat, setCat] = useState(categoria);

  // A carga é disparada pelo clique, não por efeito: abrir o painel é um evento
  // do usuário, e buscar no efeito só adicionaria um render intermediário.
  const alternar = () => {
    const vaiAbrir = !aberto;
    setAberto(vaiAbrir);
    if (!vaiAbrir || posicao !== null || carregando) return;
    setCarregando(true);
    listarPosicao()
      .then(setPosicao)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  };

  const lista = useMemo(
    () => filtrarPosicao(posicao || [], { termo, categoria: cat }).slice(0, 40),
    [posicao, termo, cat],
  );

  return (
    <div className="estRoot est-embed">
      <div className="est-card">
        <button
          type="button"
          className="est-embed-toggle"
          onClick={alternar}
          aria-expanded={aberto}
        >
          <Boxes size={15} />
          <strong>{titulo}</strong>
          {/* A marca fica NO próprio cabeçalho, e não numa faixa acima: é aqui
              que a pessoa clica, e é aqui que ela precisa saber que o número
              ainda não é para valer. */}
          {ESTOQUE_VITRINE && <span className="est-tag-dev">Em desenvolvimento</span>}
          <span className="est-embed-dica">
            {aberto ? 'Fechar' : 'Ver se tem o item antes de responder'}
          </span>
          <ChevronDown size={16} className={aberto ? 'est-embed-chev is-open' : 'est-embed-chev'} />
        </button>

        {aberto && (
          <>
            {ESTOQUE_VITRINE && (
              <div className="est-aviso tom-alerta" style={{ marginTop: 12, marginBottom: 0 }}>
                <Hammer size={16} />
                <span>
                  Módulo de Estoque <strong>em desenvolvimento</strong>. A consulta já está
                  aqui para você conhecer, mas o catálogo só entra no lançamento — até lá
                  não use estes números para decidir uma entrega.
                </span>
              </div>
            )}

            <div className="est-linha" style={{ marginTop: 12 }}>
              <div className="est-busca" style={{ flex: '2 1 220px' }}>
                <Search size={16} />
                <input
                  className="est-input" value={termo} autoFocus
                  placeholder="Buscar por nome, tamanho ou CA…"
                  aria-label="Buscar item no estoque"
                  onChange={(e) => setTermo(e.target.value)}
                />
              </div>
              <div>
                <select className="est-select" value={cat} aria-label="Categoria"
                  onChange={(e) => setCat(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="epi">EPIs</option>
                  <option value="uniforme">Uniformes</option>
                </select>
              </div>
            </div>

            {erro && <div className="est-aviso tom-erro" style={{ marginTop: 12 }}>{erro}</div>}

            {carregando ? (
              <div className="est-vazio" style={{ marginTop: 12 }}>
                <Loader2 size={18} className="est-spin" /> Carregando…
              </div>
            ) : (
              <div className="est-consulta-res est-tabela-scroll" style={{ marginTop: 12 }}>
                <table className="est-tabela">
                  <thead>
                    <tr><th>Item</th><th className="num">Saldo</th><th>Situação</th></tr>
                  </thead>
                  <tbody>
                    {lista.length === 0 ? (
                      <tr>
                        {/* Catálogo vazio e busca sem resultado são coisas
                            diferentes, e no modo vitrine a primeira é a regra —
                            sem dizer isso, a consulta parece quebrada. */}
                        <td colSpan={3}>
                          {(posicao || []).length === 0
                            ? (ESTOQUE_VITRINE
                              ? 'O módulo de Estoque ainda não entrou no ar — o catálogo será carregado no lançamento.'
                              : 'O catálogo do estoque ainda está vazio.')
                            : 'Nenhum item encontrado para esta busca.'}
                        </td>
                      </tr>
                    ) : lista.map((v) => {
                      const sit = SITUACOES[v.situacao] || SITUACOES.ok;
                      return (
                        <tr key={v.id}>
                          <td>
                            <span className="est-item-nome">{v.descricao}</span>
                            <span className="est-item-det">{detalheVariante(v) || '—'}</span>
                          </td>
                          <td className={`num ${v.situacao === 'sem_estoque' ? 'is-critico'
                            : v.situacao === 'abaixo_minimo' ? 'is-alerta' : ''}`}>
                            {v.saldo}
                          </td>
                          <td><span className={`est-badge tom-${sit.tom}`}>{sit.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
