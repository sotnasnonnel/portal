import {
  AlertTriangle, MessageSquare, Pencil, Plus, Sofa, Trash2,
} from 'lucide-react';
import {
  DEST_C, doAloj, fdate, inteiro, invest, money, totalItem,
} from '../../lib/regras';
import { Nil, Pill, Vazio } from '../components/Ui';

export function AbaMobiliario({ a, base, acoes }) {
  const itens = doAloj(base.itens, a.id).sort((x, y) => String(x.produto).localeCompare(String(y.produto), 'pt-BR'));
  const destinos = {};
  itens.forEach((i) => {
    const k = i.destino || 'Em uso';
    destinos[k] = (destinos[k] || 0) + totalItem(i);
  });

  return (
    <div className="aloj-pilha">
      {a.status !== 'ativo' && itens.length > 0 && (
        <div className="aloj-nota tom-warn">
          <AlertTriangle size={14} />
          <p>Alojamento {a.status === 'inativo' ? 'inativo' : 'em desmobilização'}: defina o destino de cada item (transferir, vender, doar, descartar ou deixar no imóvel).</p>
        </div>
      )}
      <div className="aloj-card">
        <div className="aloj-card-h">
          <h3><Sofa size={15} /> Itens comprados pela PHD</h3>
          <button type="button" className="aloj-btn pequeno primario" onClick={() => acoes.novoItem(a.id)}><Plus size={14} /> Adicionar item</button>
        </div>
        <div className="aloj-card-b">
          {Object.keys(destinos).length > 0 && (
            <div className="aloj-metas topo">
              {Object.entries(destinos).map(([k, v]) => <span key={k} className="aloj-chip">{k} <b>{money(v)}</b></span>)}
            </div>
          )}
          {itens.length ? (
            <div className="aloj-tab-scroll">
              <table className="aloj-tab">
                <thead>
                  <tr><th>Produto</th><th className="r">Qtd.</th><th className="r">Preço unit.</th><th className="r">Total</th><th>Fornecedor</th><th>Compra</th><th>Destino na devolução</th><th className="acao" /></tr>
                </thead>
                <tbody>
                  {itens.map((i) => (
                    <tr key={i.id}>
                      <td><b>{i.produto}</b>{i.obs && <small>{i.obs}</small>}</td>
                      <td className="r">{inteiro(+i.quantidade || 0)}</td>
                      <td className="r">{money(i.preco_unitario) || <Nil />}</td>
                      <td className="r"><b>{money(totalItem(i))}</b></td>
                      <td>{i.fornecedor || <Nil />}</td>
                      <td>{fdate(i.data_compra) || <Nil />}</td>
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
                    <td>Total investido</td>
                    <td className="r">{inteiro(itens.reduce((s, i) => s + (+i.quantidade || 0), 0))}</td>
                    <td />
                    <td className="r">{money(invest(base, a.id))}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : <Vazio titulo="Nenhum item registrado" texto="Registre o que a PHD comprou para mobiliar o imóvel: isso orienta a decisão na devolução." />}
        </div>
      </div>
    </div>
  );
}

const TOM_OCORRENCIA = { Contrato: 'accent', Contas: 'info', 'Manutenção': 'warn' };

export function AbaOcorrencias({ a, base, acoes }) {
  const lista = doAloj(base.ocorrencias, a.id).sort((x, y) => String(y.data).localeCompare(String(x.data)));
  return (
    <div className="aloj-card">
      <div className="aloj-card-h">
        <h3><MessageSquare size={15} /> Ocorrências</h3>
        <button type="button" className="aloj-btn pequeno primario" onClick={() => acoes.novaOcorrencia(a.id)}><Plus size={14} /> Registrar ocorrência</button>
      </div>
      <div className="aloj-card-b">
        {lista.length ? lista.map((o) => (
          <div key={o.id} className="aloj-linhatempo">
            <span className="d">{fdate(o.data) || '—'}</span>
            <div>
              <Pill c={TOM_OCORRENCIA[o.tipo] || ''} semPonto>{o.tipo || 'Outro'}</Pill>
              <p className="aloj-pre">{o.descricao}</p>
            </div>
            <div>
              <button type="button" className="aloj-mini" title="Editar" aria-label="Editar ocorrência" onClick={() => acoes.editarOcorrencia(o)}><Pencil size={14} /></button>
              <button type="button" className="aloj-mini" title="Excluir" aria-label="Excluir ocorrência" onClick={() => acoes.excluirOcorrencia(o)}><Trash2 size={14} /></button>
            </div>
          </div>
        )) : <Vazio titulo="Nenhuma ocorrência registrada" texto="Registre vistorias, manutenções, contatos com a imobiliária e cancelamentos com protocolo." />}
      </div>
    </div>
  );
}
