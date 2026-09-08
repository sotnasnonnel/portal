import {
  COLUNAS_CHAMADO, ROTULO_TOM_CHAMADO, totalDaColuna, vencidosDaColuna,
} from '../../lib/matrizChamados';

/**
 * A matriz de chamados do Adm — tipo de chamado na linha, situação na coluna.
 *
 * Vive ao lado da matriz de mobilização, na mesma tela, para a reunião de torre
 * não ter que trocar de página no meio.
 *
 * A célula é um NÚMERO tingido, e não uma bolinha como na matriz de cima. É
 * deliberado: aqui uma célula guarda vários chamados, então "quantos" é metade
 * da informação — e a diferença de forma avisa o olho que as duas tabelas não
 * se leem igual. Na de cima, verde é etapa concluída; aqui, verde é chamado em
 * dia. Mesma cor, perguntas diferentes.
 */
// `agora` vem de fora, e nao de um Date.now() aqui dentro: a cor das celulas ja
// foi decidida com UM instante, no montarMatrizChamados, e ler o relogio de novo
// no render deixaria o rodape contando por um instante diferente do da cor.
export default function MatrizChamados({ linhas, agora }) {
  if (!linhas.length) {
    return <div className="mob-vazio">Nenhum chamado em aberto.</div>;
  }

  return (
    <div className="mob-matriz-scroll">
      <table className="mob-matriz mob-matriz-chamados">
        <thead>
          <tr>
            <th className="mob-matriz-nome">Tipo de chamado</th>
            {COLUNAS_CHAMADO.map((c) => (
              <th key={c.status} className="mob-matriz-col mob-matriz-col-larga" title={c.label}>
                <span className="mob-matriz-col-txt">{c.curto}</span>
              </th>
            ))}
            <th className="mob-matriz-falta">Total</th>
          </tr>
        </thead>

        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave}>
              <th scope="row" className="mob-matriz-nome" title={`${l.classe} · ${l.servico}`}>
                <span className="mob-matriz-titulo">{l.servico}</span>
                {/* A classe só aparece quando acrescenta algo: em classe de
                    serviço único ela repete o nome do serviço, e a linha virava
                    "Solicitação de compra / Solicitação de compra". */}
                {l.classe && l.classe !== l.servico && (
                  <span className="mob-matriz-sub">{l.classe}</span>
                )}
              </th>

              {l.celulas.map((c) => (
                <td key={c.status} className="mob-matriz-celula">
                  {c.total > 0 ? (
                    <span className={`mob-conta tom-${c.tom}`}
                      title={`${c.total} em "${c.label}" — ${ROTULO_TOM_CHAMADO[c.tom]}`}>
                      {c.total}
                    </span>
                  ) : (
                    <span className="mob-conta-vazia" aria-hidden="true">·</span>
                  )}
                </td>
              ))}

              <td className="mob-matriz-falta num">{l.total}</td>
            </tr>
          ))}
        </tbody>

        {/* Rodapé: quantos chamados em cada situação, e quantos deles vencidos.
            É o número que a reunião pergunta depois de olhar a cor. */}
        <tfoot>
          <tr>
            <th scope="row" className="mob-matriz-nome mob-matriz-rodape-rot">Total · vencidos</th>
            {COLUNAS_CHAMADO.map((c, i) => {
              const total = totalDaColuna(linhas, i);
              const vencidos = vencidosDaColuna(linhas, i, agora);
              return (
                <td key={c.status} className="mob-matriz-celula">
                  <span className="mob-matriz-rodape-num">{total || '—'}</span>
                  {vencidos > 0 && (
                    <span className="mob-matriz-vencidas" title={`${vencidos} vencido(s) em "${c.label}"`}>
                      {vencidos}
                    </span>
                  )}
                </td>
              );
            })}
            <td className="mob-matriz-falta num">
              {linhas.reduce((s, l) => s + l.total, 0)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Legenda própria: as cores aqui respondem outra pergunta que as da matriz de cima. */
export function LegendaChamados() {
  const tons = ['em-dia', 'atencao', 'vencido', 'sem-prazo'];
  return (
    <div className="mob-legenda">
      {tons.map((t) => (
        <span key={t} className="mob-legenda-item">
          <span className={`mob-conta tom-${t}`} aria-hidden="true">&nbsp;</span>
          {ROTULO_TOM_CHAMADO[t]}
        </span>
      ))}
    </div>
  );
}
