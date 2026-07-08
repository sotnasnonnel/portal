import { Trash2 } from 'lucide-react';
import { fmtData, fmtDur } from '../../lib/format';

// Tabela de apontamentos reutilizada em Apontar, Registros e drill-down.
//  - list: apontamentos já normalizados (ver lib/data)
//  - projetoNome(projetoId) -> nome do projeto (+ cor opcional via projetoCor)
//  - onDelete: se passado, mostra a coluna de excluir
//  - nameOf: se passado, mostra a coluna Colaborador (colaboradorId -> nome)
export default function ApontamentosTable({ list, projetoNome, projetoCor, onDelete, nameOf }) {
  if (!list.length) {
    return <div className="horas-empty">Nenhum apontamento.</div>;
  }
  return (
    <table>
      <thead>
        <tr>
          {nameOf ? <th>Colaborador</th> : null}
          <th>Projeto</th>
          <th>Descrição</th>
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
            <td className="horas-muted">{a.descricao || '—'}</td>
            <td className="horas-muted">{fmtData(a.inicio)}</td>
            <td className="horas-muted">{fmtData(a.fim)}</td>
            <td className="horas-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmtDur(a.duracao)}
            </td>
            {onDelete ? (
              <td className="horas-right">
                <button
                  className="horas-btn-icon"
                  title="Excluir"
                  type="button"
                  onClick={() => onDelete(a)}
                >
                  <Trash2 size={15} />
                </button>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
