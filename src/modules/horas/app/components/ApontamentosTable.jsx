import { Trash2 } from 'lucide-react';
import { fmtData, fmtDur } from '../../lib/format';

// Tabela de apontamentos reutilizada em Apontar, Registros e drill-down.
//  - list: apontamentos já normalizados (ver lib/data)
//  - projetoNome(projetoId) -> nome do projeto (+ cor opcional via projetoCor)
//  - onDelete: se passado, mostra a coluna de excluir (chamada por linha permitida)
//  - podeExcluir(apont) -> bool; sem ele, todas as linhas mostram o botão
//  - nameOf: se passado, mostra a coluna Colaborador (colaboradorId -> nome)
// Os campos preenchidos (os que a equipe configurou) aparecem como tags, com a
// descrição abaixo. A lista pode misturar equipes com campos diferentes — e
// registros do catálogo fixo antigo —, então o rótulo de cada valor vai no
// title, que é o que dá sentido a uma tag solta como "PTA".
export default function ApontamentosTable({ list, projetoNome, projetoCor, onDelete, podeExcluir, nameOf }) {
  if (!list.length) {
    return <div className="horas-empty">Nenhum apontamento.</div>;
  }
  const tags = (a) => a.campos || [];
  // horas-tbl-resp + data-label: no mobile o CSS transforma cada linha num
  // cartao e usa o data-label no lugar do cabecalho (7 colunas nao cabem).
  return (
    <table className="horas-tbl-resp">
      <thead>
        <tr>
          {nameOf ? <th>Colaborador</th> : null}
          <th>Projeto</th>
          <th>Detalhes</th>
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
            <td data-label="Detalhes">
              {tags(a).map((c, i) => (
                <span className="horas-tag" key={i} title={`${c.label}: ${c.valor}`}>
                  {c.valor}
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
