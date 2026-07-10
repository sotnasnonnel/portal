import { Trash2 } from 'lucide-react';
import { fmtData, fmtDur } from '../../lib/format';

// Tabela de apontamentos reutilizada em Apontar, Registros e drill-down.
//  - list: apontamentos já normalizados (ver lib/data)
//  - projetoNome(projetoId) -> nome do projeto (+ cor opcional via projetoCor)
//  - onDelete: se passado, mostra a coluna de excluir (chamada por linha permitida)
//  - podeExcluir(apont) -> bool; sem ele, todas as linhas mostram o botão
//  - nameOf: se passado, mostra a coluna Colaborador (colaboradorId -> nome)
// As 3 atividades controladas aparecem como tags, com a descrição abaixo.
export default function ApontamentosTable({ list, projetoNome, projetoCor, onDelete, podeExcluir, nameOf }) {
  if (!list.length) {
    return <div className="horas-empty">Nenhum apontamento.</div>;
  }
  return (
    <table>
      <thead>
        <tr>
          {nameOf ? <th>Colaborador</th> : null}
          <th>Projeto</th>
          <th>Atividades</th>
          <th>Início</th>
          <th>Fim</th>
          <th className="horas-right">Duração</th>
          {onDelete ? <th></th> : null}
        </tr>
      </thead>
      <tbody>
        {list.map((a) => (
          <tr key={a.id}>
            {nameOf ? <td>{nameOf(a.colaboradorId) || '—'}</td> : null}
            <td>
              <span
                className="horas-pill"
                style={projetoCor ? { background: projetoCor(a.projetoId) } : undefined}
              />
              {projetoNome ? projetoNome(a.projetoId) : '—'}
            </td>
            <td>
              {(a.ativ || []).filter(Boolean).map((v, i) => (
                <span className="horas-tag" key={i}>
                  {v}
                </span>
              ))}
              {a.descricao ? (
                <div className="horas-muted" style={{ fontSize: '.72rem', marginTop: 3 }}>
                  {a.descricao}
                </div>
              ) : null}
              {!a.descricao && !(a.ativ || []).filter(Boolean).length ? (
                <span className="horas-muted">—</span>
              ) : null}
            </td>
            <td className="horas-muted">{fmtData(a.inicio)}</td>
            <td className="horas-muted">{fmtData(a.fim)}</td>
            <td className="horas-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmtDur(a.duracao)}
            </td>
            {onDelete ? (
              <td className="horas-right">
                {!podeExcluir || podeExcluir(a) ? (
                  <button
                    className="horas-btn-icon"
                    title="Excluir"
                    type="button"
                    onClick={() => onDelete(a)}
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
