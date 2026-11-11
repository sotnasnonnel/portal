import { Copy, Pencil, Trash2 } from 'lucide-react';
import { fmtData, fmtDur, fmtHoras } from '../../lib/format';

// Data e horário em colunas próprias: "Início 06/11/2026 08:00 | Fim
// 06/11/2026 12:30" repetia a data e obrigava a ler duas colunas para saber o
// intervalo. Quase todo apontamento começa e termina no mesmo dia; quando não,
// o fim ganha a data junto (o title guarda o início e o fim completos).
const DIA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const hora = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const mesmoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
function celulaData(ts) {
  const d = new Date(ts);
  return { dia: d.toLocaleDateString('pt-BR'), semana: DIA_SEMANA[d.getDay()] };
}
function textoHorario(inicio, fim) {
  if (!fim) return `${hora(inicio)} – em andamento`;
  return mesmoDia(inicio, fim)
    ? `${hora(inicio)} – ${hora(fim)}`
    : `${hora(inicio)} – ${new Date(fim).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora(fim)}`;
}

// Tabela de apontamentos reutilizada em Apontar, Registros e drill-down.
//  - list: apontamentos já normalizados (ver lib/data)
//  - projetoNome(projetoId) -> nome do projeto (+ cor opcional via projetoCor)
//  - onEdit/onDelete: se passados, mostram os botões da última coluna
//  - podeAlterar(apont) -> bool; sem ele, todas as linhas mostram os botões.
//    Vale para os dois: no banco, as policies de update e delete de
//    horas_apontamentos são a mesma regra (o próprio, ou a subárvore da gestão).
//  - onDuplicate: se passado, mostra o botão de duplicar nas linhas em que
//    podeDuplicar(apont) for verdadeiro (sem ele, em todas). É separado de
//    podeAlterar porque duplicar cria um registro NOVO, sempre em nome de quem
//    está logado — a gestão edita o da equipe, mas só duplica os próprios.
//  - nameOf: se passado, mostra a coluna Colaborador (colaboradorId -> nome)
//  - vazio: texto do estado vazio (cada tela diz o que fazer a seguir)
//  - rodape: mostra uma linha de total (quantidade e soma das durações) no pé
//    da tabela — útil quando a tabela rola e o total do topo sai de vista
// Os campos preenchidos (os que a equipe configurou) aparecem como tags, com a
// descrição abaixo. A lista pode misturar equipes com campos diferentes — e
// registros do catálogo fixo antigo —, então o rótulo de cada valor vai no
// title, que é o que dá sentido a uma tag solta como "PTA".
export default function ApontamentosTable({
  list, projetoNome, projetoCor, onEdit, onDelete, onDuplicate, podeAlterar, podeDuplicar, nameOf,
  vazio = 'Nenhum apontamento.', rodape = false,
}) {
  if (!list.length) {
    return <div className="horas-empty">{vazio}</div>;
  }
  const tags = (a) => a.campos || [];
  const temAcoes = Boolean(onEdit || onDelete || onDuplicate);
  const totalMs = list.reduce((s, a) => s + (a.duracao || 0), 0);
  // Colunas antes da Duração (para o "Total" do rodapé ocupar a largura certa).
  const colsAntes = (nameOf ? 1 : 0) + 4;
  // horas-tbl-resp + data-label: no mobile o CSS transforma cada linha num
  // cartao e usa o data-label no lugar do cabecalho (7 colunas nao cabem).
  return (
    <table className="horas-tbl-resp horas-tbl-apont">
      <thead>
        <tr>
          {nameOf ? <th>Colaborador</th> : null}
          <th>Projeto</th>
          <th>Detalhes</th>
          <th>Data</th>
          <th>Horário</th>
          <th className="horas-right">Duração</th>
          {temAcoes ? (
            <th>
              <span className="horas-sr">Ações</span>
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {list.map((a) => (
          <tr key={a.id}>
            {nameOf ? (
              <td className="horas-td-nome" data-label="Colaborador">{nameOf(a.colaboradorId) || '—'}</td>
            ) : null}
            <td className="horas-td-projeto" data-label="Projeto">
              <span className="horas-projeto">
                <span
                  aria-hidden="true"
                  className="horas-pill"
                  style={projetoCor ? { background: projetoCor(a.projetoId) } : undefined}
                />
                <span>{projetoNome ? projetoNome(a.projetoId) : '—'}</span>
              </span>
            </td>
            <td className="horas-td-detalhes" data-label="Detalhes">
              {tags(a).length ? (
                <div className="horas-tags">
                  {tags(a).map((c, i) => (
                    <span className="horas-tag" key={i} title={`${c.label}: ${c.valor}`}>
                      {c.valor}
                    </span>
                  ))}
                </div>
              ) : null}
              {a.descricao ? (
                <div className="horas-desc horas-desc-curta" title={a.descricao}>{a.descricao}</div>
              ) : null}
              {!a.descricao && !tags(a).length ? <span className="horas-muted">—</span> : null}
            </td>
            <td className="horas-num" data-label="Data">
              {celulaData(a.inicio).dia} <span className="horas-muted">{celulaData(a.inicio).semana}</span>
            </td>
            <td
              className="horas-muted horas-num"
              data-label="Horário"
              title={`Início ${fmtData(a.inicio)}${a.fim ? ` · Fim ${fmtData(a.fim)}` : ''}`}
            >
              {textoHorario(a.inicio, a.fim)}
            </td>
            <td className="horas-right horas-num horas-dur" data-label="Duração">
              {fmtDur(a.duracao)}
            </td>
            {temAcoes ? (
              <td className="horas-right horas-td-acao">
                {onDuplicate && (!podeDuplicar || podeDuplicar(a)) ? (
                  <button
                    className="horas-btn-icon"
                    title="Duplicar (mesmos dados, outro horário)"
                    aria-label="Duplicar apontamento"
                    type="button"
                    onClick={() => onDuplicate(a)}
                  >
                    <Copy size={15} />
                  </button>
                ) : null}
                {!podeAlterar || podeAlterar(a) ? (
                  <>
                    {onEdit ? (
                      <button
                        className="horas-btn-icon"
                        title="Editar"
                        aria-label="Editar apontamento"
                        type="button"
                        onClick={() => onEdit(a)}
                      >
                        <Pencil size={15} />
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button
                        className="horas-btn-icon is-danger"
                        title="Excluir"
                        aria-label="Excluir apontamento"
                        type="button"
                        onClick={() => onDelete(a)}
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                  </>
                ) : null}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
      {rodape ? (
        <tfoot>
          <tr>
            <td colSpan={colsAntes}>
              Total · {list.length} apontamento{list.length === 1 ? '' : 's'}
            </td>
            <td className="horas-right horas-num horas-dur" title={fmtHoras(totalMs)}>
              {fmtDur(totalMs)}
            </td>
            {temAcoes ? <td aria-hidden="true" /> : null}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}
