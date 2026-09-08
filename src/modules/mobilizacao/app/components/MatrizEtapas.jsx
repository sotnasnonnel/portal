import { ROTULO_COR, resumoDaColuna } from '../../lib/matriz';

const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');

/**
 * O que a bolinha diz ao passar o mouse. É o que substitui a legenda para quem
 * está apresentando: em vez de "por que essa está amarela?", o título já traz a
 * etapa, a situação e as datas.
 */
function tituloDaCelula(celula) {
  const { titulo, cor, etapa } = celula;
  const partes = [`${titulo} — ${ROTULO_COR[cor]}`];
  if (etapa?.data_prevista) partes.push(`Previsto: ${dataBr(etapa.data_prevista)}`);
  if (etapa?.data_real) partes.push(`Real: ${dataBr(etapa.data_real)}`);
  if (etapa?.responsavelNome) partes.push(etapa.responsavelNome);
  if (Number(etapa?.dias_atraso) > 0) partes.push(`${etapa.dias_atraso} dia(s) de atraso`);
  return partes.join(' · ');
}

/**
 * A matriz de bolinhas — uma linha por processo, uma coluna por etapa.
 *
 * Recria a leitura que a planilha dava e a lista não dá: bater o olho e ver
 * ONDE a fila parou. Numa lista de 40 etapas ninguém percebe que oito processos
 * travaram no mesmo passo; numa coluna inteira de vermelho, percebe.
 *
 * Só leitura. As regras (cor, ordem das linhas, colunas do catálogo) vivem em
 * lib/matriz.js, testadas — aqui só se desenha.
 */
export default function MatrizEtapas({ blocos, onClicarCelula }) {
  if (!blocos.length) {
    return <div className="mob-vazio">Nenhum processo para mostrar.</div>;
  }

  return (
    <>
      {blocos.map((bloco) => (
        <section key={bloco.fluxo} className="mob-card mob-matriz-card">
          <h2 className="mob-card-tit">
            {bloco.label}
            <span className="mob-matriz-cont">{bloco.linhas.length}</span>
          </h2>

          <div className="mob-matriz-scroll">
            <table className="mob-matriz">
              <thead>
                <tr>
                  {/* A primeira coluna gruda na rolagem horizontal: sem isso,
                      ao chegar na última etapa a pessoa perde de vista de QUEM
                      é a linha — que é metade da informação. */}
                  <th className="mob-matriz-nome">Processo</th>
                  {bloco.colunas.map((c) => (
                    <th key={c.codigo} className="mob-matriz-col" title={c.titulo}>
                      <span className="mob-matriz-col-txt">{c.curto}</span>
                    </th>
                  ))}
                  <th className="mob-matriz-falta">Faltam</th>
                </tr>
              </thead>

              <tbody>
                {bloco.linhas.map((l) => (
                  <tr key={l.processo.id}>
                    {/* O title cobre o nome que a coluna corta: ela e estreita
                        de proposito, para a matriz nao ficar longe das bolinhas. */}
                    <th scope="row" className="mob-matriz-nome" title={l.processo.titulo}>
                      <span className="mob-matriz-titulo">{l.processo.titulo}</span>
                      <span className="mob-matriz-sub">
                        #{l.processo.numero}
                        {l.processo.cliente_phd ? ` · ${l.processo.cliente_phd}` : ''}
                      </span>
                    </th>

                    {l.celulas.map((c) => (
                      <td key={c.codigo} className="mob-matriz-celula">
                        {onClicarCelula && c.etapa ? (
                          <button type="button" className={`mob-bolinha tom-${c.cor}`}
                            title={tituloDaCelula(c)}
                            onClick={() => onClicarCelula(c, l.processo)}>
                            <span className="mob-so-leitor">{ROTULO_COR[c.cor]}</span>
                          </button>
                        ) : (
                          <span className={`mob-bolinha tom-${c.cor}`} title={tituloDaCelula(c)}>
                            <span className="mob-so-leitor">{ROTULO_COR[c.cor]}</span>
                          </span>
                        )}
                      </td>
                    ))}

                    <td className="mob-matriz-falta num">
                      {l.faltam === 0
                        ? <span className="mob-matriz-ok">✓</span>
                        : l.faltam}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Rodapé: quantos travaram em CADA passo. É o que responde
                  "este passo trava todo mundo?" sem contar bolinha na tela. */}
              <tfoot>
                <tr>
                  <th scope="row" className="mob-matriz-nome mob-matriz-rodape-rot">Vencidas</th>
                  {bloco.colunas.map((c, i) => {
                    const r = resumoDaColuna(bloco.linhas, i);
                    return (
                      <td key={c.codigo} className="mob-matriz-celula">
                        {r.vencida > 0 && (
                          <span className="mob-matriz-vencidas"
                            title={`${r.vencida} processo(s) travado(s) em "${c.titulo}"`}>
                            {r.vencida}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}

/** Legenda. Fora da tabela porque vale para os três blocos de uma vez. */
export function LegendaMatriz() {
  const tons = ['concluida', 'no-prazo', 'vencida', 'sem-prazo', 'dispensada', 'ausente'];
  return (
    <div className="mob-legenda">
      {tons.map((t) => (
        <span key={t} className="mob-legenda-item">
          <span className={`mob-bolinha tom-${t}`} aria-hidden="true" />
          {ROTULO_COR[t]}
        </span>
      ))}
    </div>
  );
}
