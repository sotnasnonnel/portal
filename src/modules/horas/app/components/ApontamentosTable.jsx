import { Trash2 } from 'lucide-react';
import { fmtData, fmtDur } from '../../lib/format';

// Tabela de apontamentos reutilizada em Apontar, Registros e drill-down.
//  - list: apontamentos já normalizados (ver lib/data)
//  - projetoNome(projetoId) -> nome do projeto (+ cor opcional via projetoCor)
//  - onDelete: se passado, mostra a coluna de excluir (chamada por linha permitida)
//  - podeExcluir(apont) -> bool; sem ele, todas as linhas mostram o botão
//  - nameOf: se passado, mostra a coluna Colaborador (colaboradorId -> nome)
// Sigla, tarefa, etiqueta e tarefa 2 aparecem como tags, com a descrição abaixo.
// `ativ` é o legado (atividades controladas por gerência) e só aparece nos
// apontamentos antigos, que não têm os campos novos.
export default function ApontamentosTable({ list, projetoNome, projetoCor, onDelete, podeExcluir, nameOf }) {
  if (!list.length) {
    return <div className="horas-empty">Nenhum apontamento.</div>;
  }
  const tags = (a) => {
    const novos = [a.sigla, a.tarefa, a.etiqueta, a.tarefa2].filter(Boolean);
    return novos.length ? novos : (a.ativ || []).filter(Boolean);
  };
  // horas-tbl-resp + data-label: no mobile o CSS transforma cada linha num
  // cartao e usa o data-label no lugar do cabecalho (7 colunas nao cabem).
  return (
    <table className="horas-tbl-resp">
      <thead>
        <tr>
          {nameOf ? <th>Colaborador</th> : null}
          <th>Projeto</th>
          <th>Tarefa</th>
          <th>Início</th>
          <th>Fim</th>
          <th className="horas-right">Duração</th>
          {onDelete ? <th></th> : null}
        </tr>
      </thead>
      <tbody>
        {list.map((a) => (
          <tr key={a.id}>
            {nameOf ? <td data-label="Colaborador">{nameOf(a.colaboradorId) || '—'}</td> : null}
            <td data-label="Projeto">
              <span
                className="horas-pill"
                style={projetoCor ? { background: projetoCor(a.projetoId) } : undefined}
              />
              {projetoNome ? projetoNome(a.projetoId) : '—'}
            </td>
            <td data-label="Tarefa">
              {tags(a).map((v, i) => (
                <span className="horas-tag" key={i}>
                  {v}
                </span>
              ))}
              {a.descricao ? (
                <div className="horas-muted" style={{ fontSize: '.72rem', marginTop: 3 }}>
                  {a.descricao}
                </div>
              ) : null}
              {!a.descricao && !tags(a).length ? <span className="horas-muted">—</span> : null}
            </td>
            <td className="horas-muted" data-label="Início">{fmtData(a.inicio)}</td>
            <td className="horas-muted" data-label="Fim">{fmtData(a.fim)}</td>
            <td className="horas-right" data-label="Duração" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmtDur(a.duracao)}
            </td>
            {onDelete ? (
              <td className="horas-right horas-td-acao">
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
