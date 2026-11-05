import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Building2, LayoutGrid, Pencil, Plus, Receipt, Search, Sofa, Trash2,
} from 'lucide-react';
import { useBase } from '../../lib/useBase';
import {
  DEST_C, STATUS, alojs, byId, initials, inteiro, money, norm, plural, totalItem,
} from '../../lib/regras';
import { rotaFicha } from '../components/nav';
import { useAcoes } from '../components/useAcoes';
import Dialogos from '../components/Dialogos';
import {
  Carga, Kpi, Nil, Pill, Vazio,
} from '../components/Ui';

function Conteudo({ base, acoes }) {
  const [aloj, setAloj] = useState('');
  const [busca, setBusca] = useState('');

  const itens = base.itens.filter((i) => byId(base, i.alojamento_id));
  const nomeDe = (i) => byId(base, i.alojamento_id).nome;
  const total = itens.reduce((s, i) => s + totalItem(i), 0);
  const porAloj = {};
  itens.forEach((i) => { porAloj[i.alojamento_id] = (porAloj[i.alojamento_id] || 0) + totalItem(i); });
  const linhasAloj = Object.entries(porAloj).sort((x, y) => y[1] - x[1]);
  const maior = Math.max(1, ...linhasAloj.map((r) => r[1]));
  const emRisco = itens.filter((i) => {
    const a = byId(base, i.alojamento_id);
    return a && a.status !== 'ativo' && (i.destino || 'Em uso') === 'Em uso';
  });
  const valorRisco = emRisco.reduce((s, i) => s + totalItem(i), 0);
  const riscoPorAloj = {};
  emRisco.forEach((i) => { (riscoPorAloj[i.alojamento_id] = riscoPorAloj[i.alojamento_id] || []).push(i); });

  const q = norm(busca).trim();
  const lista = itens
    .filter((i) => (!aloj || i.alojamento_id === aloj) && (!q || norm(`${i.produto} ${i.fornecedor}`).includes(q)))
    .sort((x, y) => String(nomeDe(x)).localeCompare(nomeDe(y)) || String(x.produto).localeCompare(y.produto));
  const totalLista = lista.reduce((s, i) => s + totalItem(i), 0);
  const comItens = alojs(base, (a) => porAloj[a.id] !== undefined);

  return (
    <>
      <div className="aloj-kpis">
        <Kpi rotulo="Investimento total" Icon={Sofa} valor={money(total) || 'R$ 0,00'} sub="soma de quantidade × preço unitário" />
        <Kpi
          rotulo="Itens"
          Icon={LayoutGrid}
          valor={inteiro(itens.reduce((s, i) => s + (+i.quantidade || 0), 0))}
          sub={`${plural(itens.length, 'linha')} de compra`}
        />
        <Kpi rotulo="Alojamentos mobiliados" Icon={Building2} valor={linhasAloj.length} sub={`de ${base.alojamentos.length} cadastrados`} />
        <Kpi
          rotulo="Sem destino definido"
          Icon={AlertTriangle}
          valor={money(valorRisco) || 'R$ 0,00'}
          sub={`${plural(emRisco.length, 'item', 'itens')} em imóveis em desmobilização/inativos`}
        />
        <Kpi rotulo="Ticket médio por alojamento" Icon={Receipt} valor={linhasAloj.length ? money(total / linhasAloj.length) : <Nil />} sub="entre os mobiliados" />
      </div>

      <div className="aloj-g2" style={{ marginTop: 28 }}>
        <div className="aloj-card">
          <div className="aloj-card-h"><h3><Building2 size={15} /> Investimento por alojamento</h3></div>
          <div className="aloj-card-b">
            {linhasAloj.length ? (
              <div className="aloj-hbars">
                {linhasAloj.map(([id, v]) => (
                  <div key={id} className="aloj-hbar">
                    <span className="lb" title={byId(base, id).nome}>{byId(base, id).nome}</span>
                    <div className="tr"><i style={{ width: `${((v / maior) * 100).toFixed(1)}%` }} /></div>
                    <span className="vl">{money(v)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="aloj-muted aloj-m0">Nenhum item registrado.</p>}
          </div>
        </div>
        <div className="aloj-card">
          <div className="aloj-card-h"><h3><AlertTriangle size={15} /> Decisão na devolução</h3></div>
          <div className="aloj-card-b">
            {emRisco.length ? (
              <>
                <p className="aloj-texto">Itens ainda marcados “Em uso” em alojamentos que estão saindo de operação:</p>
                {Object.entries(riscoPorAloj).map(([id, lista2]) => {
                  const a = byId(base, id);
                  return (
                    <div key={id} className="aloj-linha">
                      <span className="aloj-ini">{initials(a.nome)}</span>
                      <span className="aloj-linha-tx">
                        <b>{a.nome}</b>
                        <small>{plural(lista2.length, 'item', 'itens')} · {STATUS[a.status].l}</small>
                      </span>
                      <Link className="aloj-btn pequeno" to={rotaFicha(id, 'mobiliario')}>Definir destino</Link>
                    </div>
                  );
                })}
              </>
            ) : <p className="aloj-muted aloj-m0">Nenhum item aguardando decisão. Itens de imóveis ativos seguem “Em uso”.</p>}
          </div>
        </div>
      </div>

      <h2 className="aloj-sec">Inventário</h2>
      <div className="aloj-toolbar">
        <label className="aloj-inline" htmlFor="aloj-mob-a">
          Alojamento
          <select id="aloj-mob-a" value={aloj} onChange={(e) => setAloj(e.target.value)}>
            <option value="">Todos</option>
            {comItens.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </label>
        <label className="aloj-inline cresce" htmlFor="aloj-mob-q">
          <Search size={14} />
          <input id="aloj-mob-q" placeholder="Buscar produto ou fornecedor" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
      </div>
      <div className="aloj-card aloj-card-b">
        {lista.length ? (
          <div className="aloj-tab-scroll">
            <table className="aloj-tab">
              <thead>
                <tr><th>Produto</th><th>Alojamento</th><th className="r">Qtd.</th><th className="r">Preço unit.</th><th className="r">Total</th><th>Fornecedor</th><th>Destino</th><th className="acao" /></tr>
              </thead>
              <tbody>
                {lista.map((i) => (
                  <tr key={i.id}>
                    <td><b>{i.produto}</b></td>
                    <td>{nomeDe(i)}</td>
                    <td className="r">{inteiro(+i.quantidade || 0)}</td>
                    <td className="r">{money(i.preco_unitario) || <Nil />}</td>
                    <td className="r"><b>{money(totalItem(i))}</b></td>
                    <td>{i.fornecedor || <Nil />}</td>
                    <td><Pill c={DEST_C[i.destino || 'Em uso'] ?? ''}>{i.destino || 'Em uso'}</Pill></td>
                    <td className="acao">
                      <button type="button" className="aloj-mini" title="Editar" aria-label="Editar item" onClick={() => acoes.editarItem(i)}><Pencil size={14} /></button>
                      <button type="button" className="aloj-mini" title="Excluir" aria-label="Excluir item" onClick={() => acoes.excluirItem(i)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total {aloj || q ? 'filtrado' : 'geral'}</td>
                  <td className="r">{money(totalLista)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : <Vazio titulo="Nenhum item encontrado" texto="Ajuste o filtro ou adicione um item." />}
      </div>
    </>
  );
}

export default function MobiliarioAlojamentos() {
  const { base, carregando, erro, recarregar } = useBase();
  const acoes = useAcoes({ base, recarregar });
  return (
    <div className="aloj-page larga">
      <div className="aloj-head">
        <div>
          <h1>Mobiliário</h1>
          <p>O que a PHD comprou para compor cada alojamento e o destino de cada item na devolução</p>
        </div>
        <div className="aloj-acoes">
          <button type="button" className="aloj-btn primario" onClick={() => acoes.novoItem()}><Plus size={14} /> Adicionar item</button>
        </div>
      </div>
      <Carga carregando={carregando} erro={erro}>
        <Conteudo base={base} acoes={acoes} />
      </Carga>
      <Dialogos acoes={acoes} />
    </div>
  );
}
