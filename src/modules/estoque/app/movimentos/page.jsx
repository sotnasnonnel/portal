import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Loader2, AlertCircle, Search } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { ehOperadorEstoque } from '../../../../config/estoque';
import { listarMovimentos, listarPessoasEstoque } from '../../lib/estoque';
import { normalizar, rotuloVariante } from '../../lib/catalogo';

const TIPO_LABEL = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' };
// Peça nova e usada têm saldos separados: sem esta coluna o histórico não
// explica de qual dos dois o movimento saiu.
const CONDICAO_LABEL = { novo: 'Nova', usado: 'Usada' };

const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : '—');

// Primeiro dia do mês, três meses atrás — janela que cobre o giro normal sem
// puxar o histórico inteiro a cada abertura.
const inicioPadrao = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 3, 1);
  return d.toISOString().slice(0, 10);
};

export default function MovimentosEstoque() {
  const { modules } = useAuth();
  const operador = ehOperadorEstoque(modules);

  const [movs, setMovs] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [de, setDe] = useState(inicioPadrao);
  const [ate, setAte] = useState('');
  const [colaboradorId, setColaboradorId] = useState('');
  const [termo, setTermo] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const filtros = { colaboradorId: colaboradorId || undefined };
      if (de) filtros.de = `${de}T00:00:00`;
      // O fim do dia entra inteiro: `<= 2026-08-28` sozinho cortaria tudo que
      // aconteceu depois da meia-noite do próprio dia escolhido.
      if (ate) filtros.ate = `${ate}T23:59:59`;
      setMovs(await listarMovimentos(filtros));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [de, ate, colaboradorId]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!operador) return;
    listarPessoasEstoque().then(setPessoas).catch(() => setPessoas([]));
  }, [operador]);

  const lista = useMemo(() => {
    const t = normalizar(termo);
    if (!t) return movs;
    const partes = t.split(' ').filter(Boolean);
    return movs.filter((m) => {
      const alvo = normalizar(
        `${rotuloVariante(m.variante)} ${m.colaboradorNome} ${m.motivo || ''} `
        + `${CONDICAO_LABEL[m.condicao] || ''} `
        + `${m.documento || ''} ${m.chamadoNumero ? `#${m.chamadoNumero}` : ''}`,
      );
      return partes.every((p) => alvo.includes(p));
    });
  }, [movs, termo]);

  return (
    <div className="est-page est-page-wide">
      <div className="est-cab">
        <div className="est-cab-txt">
          <h1 className="est-title"><History size={22} /> Movimentações</h1>
          <p className="est-sub">
            {operador
              ? 'Todo movimento do estoque, com quem recebeu e o chamado de origem. Movimento não se edita nem se apaga — correção é um novo lançamento.'
              : 'O que você já recebeu do almoxarifado e o que saiu nos seus chamados.'}
          </p>
        </div>
      </div>

      {erro && <div className="est-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      <div className="est-card">
        <div className="est-linha">
          <div className="est-campo" style={{ flex: '2 1 240px' }}>
            <label htmlFor="m-busca">Buscar</label>
            <div className="est-busca">
              <Search size={16} />
              <input id="m-busca" className="est-input" value={termo}
                placeholder="Item, pessoa, condição, motivo ou nº do chamado…"
                onChange={(e) => setTermo(e.target.value)} />
            </div>
          </div>
          <div className="est-campo">
            <label htmlFor="m-de">De</label>
            <input id="m-de" className="est-input" type="date" value={de}
              onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="est-campo">
            <label htmlFor="m-ate">Até</label>
            <input id="m-ate" className="est-input" type="date" value={ate}
              onChange={(e) => setAte(e.target.value)} />
          </div>
          {operador && (
            <div className="est-campo">
              <label htmlFor="m-quem">Colaborador</label>
              <select id="m-quem" className="est-select" value={colaboradorId}
                onChange={(e) => setColaboradorId(e.target.value)}>
                <option value="">Todos</option>
                {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {carregando ? (
        <div className="est-vazio"><Loader2 size={20} className="est-spin" /> Carregando…</div>
      ) : lista.length === 0 ? (
        <div className="est-vazio">Nenhuma movimentação no período.</div>
      ) : (
        <div className="est-tabela-scroll">
          <table className="est-tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Item</th>
                <th>Condição</th>
                <th className="num">Qtd.</th>
                <th>Quem recebeu</th>
                <th>Motivo</th>
                <th>Chamado</th>
                <th>Registrado por</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id}>
                  <td className="num">{dataHora(m.criado_em)}</td>
                  <td><span className={`est-badge tom-${m.tipo}`}>{TIPO_LABEL[m.tipo] || m.tipo}</span></td>
                  <td>
                    <span className="est-item-nome">{m.variante.descricao}</span>
                    <span className="est-item-det">{rotuloVariante(m.variante).replace(m.variante.descricao, '').replace(/^ · /, '') || '—'}</span>
                  </td>
                  <td>
                    <span className={`est-badge tom-${m.condicao === 'usado' ? 'alerta' : 'info'}`}>
                      {CONDICAO_LABEL[m.condicao] || m.condicao}
                    </span>
                  </td>
                  {/* O sinal é a informação: +5 recebido, -2 entregue. */}
                  <td className={`num ${m.quantidade < 0 ? 'is-critico' : ''}`}>
                    {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                  </td>
                  <td>{m.colaboradorNome || '—'}</td>
                  <td>{m.motivo || '—'}</td>
                  <td>
                    {m.chamado_id
                      ? <Link className="est-link" to={`/administrativo/chamado/${m.chamado_id}`}>#{m.chamadoNumero}</Link>
                      : '—'}
                  </td>
                  <td>{m.registradoPorNome || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
