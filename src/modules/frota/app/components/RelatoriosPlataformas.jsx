import { useEffect, useMemo, useState } from 'react';
import {
  Download, ExternalLink, Eye, FileSpreadsheet, FileText, Trash2, Upload,
} from 'lucide-react';
import {
  ACEITA_RELATORIO, enviarAnexo, excluirRegistro, removerAnexos, salvarRegistro, urlDoAnexo,
} from '../../lib/frota';
import { ehPlanilha, lerPlanilha, letraDaColuna } from '../../lib/planilhas';
import {
  DESTINOS, PLATAFORMAS, adivinharColunas, casarComMensal, linhaDoCabecalho, numeroDeColunas, relatoriosDe,
} from '../../lib/importacao';
import {
  compLabel, compLong, lastComp, patchVeiculo, placaDe,
} from '../../lib/regras';
import { fmtDate, int, money } from '../../lib/formato';
import { useFrota } from './FrotaContext';
import { Pill } from './Pecas';
import Confirmar from './Confirmar';
import './relatoriosPlataformas.css';

// Relatórios mensais das plataformas (Ticket Log, Cobli, GPS da locadora...),
// anexados em Combustível e em Quilometragem. Planilha pode ser vista e ter uma
// coluna importada para o controle mensal (frota_mensal) da competência.

const TEXTO_AREA = {
  combustivel: 'relatório de combustível (Ticket Log ou cartão)',
  quilometragem: 'relatório de quilometragem (Cobli, GPS da locadora)',
};
const LINHAS_PREVIA = 40;
// Gravações em paralelo na importação: poucas por vez para não estourar o PostgREST.
const LOTE = 5;

const pad2 = (n) => String(n).padStart(2, '0');
/** Dia local de um timestamp ISO: o slice(0, 10) do UTC vira o dia seguinte depois das 21h. */
function diaDe(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return fmtDate(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
}

/** A aba abre antes do await: depois dele o navegador trata como pop-up. */
async function abrirArquivo(arquivo, toast) {
  const aba = window.open('', '_blank');
  try {
    const url = await urlDoAnexo(arquivo.path);
    if (aba) aba.location.href = url;
    else window.location.assign(url);
  } catch (e) {
    aba?.close();
    toast(e.message, 'err');
  }
}

async function baixarArquivo(arquivo, toast) {
  try {
    window.location.assign(await urlDoAnexo(arquivo.path, { download: arquivo.nome || true }));
  } catch (e) {
    toast(e.message, 'err');
  }
}

const fmtValor = (t, v) => (t === 'money' ? money(v) : int(v));

/** Prévia da planilha e importação de uma coluna para o controle mensal. */
function VisualizarPlanilha({ registro, onFechar }) {
  const {
    dados, recarregar, toast, podeEscrever,
  } = useFrota();
  const arquivo = registro.arquivo;
  const destinos = DESTINOS[registro.area] || [];
  const [estado, setEstado] = useState({ carregando: true, erro: '', abas: [] });
  const [aba, setAba] = useState(0);
  const [hdr, setHdr] = useState(0);
  const [hdrTxt, setHdrTxt] = useState('1');
  const [cols, setCols] = useState({ colPlaca: -1, colValor: -1 });
  const [campo, setCampo] = useState(destinos[0]?.campo || '');
  const [importando, setImportando] = useState(false);

  const linhas = useMemo(() => estado.abas[aba]?.linhas || [], [estado.abas, aba]);

  // Cabeçalho escolhido: refaz o palpite das colunas, como no protótipo.
  const aplicarCabecalho = (lins, h) => {
    setHdr(h);
    setHdrTxt(String(h + 1));
    setCols(adivinharColunas(lins[h] || [], lins.slice(h + 1), registro.area));
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(await urlDoAnexo(arquivo.path));
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const { abas } = await lerPlanilha(await r.arrayBuffer(), arquivo.nome);
        if (!vivo) return;
        if (!abas.length) throw new Error('sem abas');
        const lins = abas[0].linhas;
        setEstado({ carregando: false, erro: '', abas });
        setAba(0);
        aplicarCabecalho(lins, linhaDoCabecalho(lins));
      } catch {
        if (vivo) setEstado({ carregando: false, erro: 'Não foi possível ler a planilha. Baixe o arquivo para conferir.', abas: [] });
      }
    })();
    return () => { vivo = false; };
    // Lê uma vez por arquivo; aplicarCabecalho só usa setters e a área do registro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo.path, arquivo.nome]);

  // Na captura: Esc fecha só este modal, não o painel que estiver atrás dele.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (!importando) onFechar();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onFechar, importando]);

  const escolherAba = (i) => {
    setAba(i);
    const lins = estado.abas[i]?.linhas || [];
    aplicarCabecalho(lins, linhaDoCabecalho(lins));
  };
  const mudarCabecalho = (txt) => {
    setHdrTxt(txt);
    const n = parseInt(txt, 10);
    if (n >= 1 && n <= linhas.length) aplicarCabecalho(linhas, n - 1);
  };

  const cab = linhas[hdr] || [];
  const corpo = useMemo(() => linhas.slice(hdr + 1), [linhas, hdr]);
  const ncol = numeroDeColunas(linhas);
  const destino = destinos.find((d) => d.campo === campo) || destinos[0];
  const casamento = useMemo(
    () => (podeEscrever && destino
      ? casarComMensal(corpo, cols.colPlaca, cols.colValor, destino.agg, registro.competencia, dados.mensal)
      : { itens: [], casados: 0, semLancamento: 0 }),
    [podeEscrever, destino, corpo, cols, registro.competencia, dados.mensal],
  );
  const nomeColuna = (i) => `${letraDaColuna(i)} · ${String(cab[i] ?? '').slice(0, 28) || '(sem título)'}`;
  const opcoesColuna = (
    <>
      <option value={-1}>Selecione…</option>
      {Array.from({ length: ncol }, (_, i) => <option key={i} value={i}>{nomeColuna(i)}</option>)}
    </>
  );
  const pronto = !estado.carregando && !estado.erro;
  const podeImportar = podeEscrever && pronto && casamento.casados > 0 && !importando;

  const importar = async () => {
    const alvo = casamento.itens.filter((x) => x.mensal);
    if (!alvo.length || !destino) return;
    setImportando(true);
    const comp = registro.competencia;
    const agora = new Date().toISOString();
    // Hodômetro do mês mais recente também atualiza o veículo (o km só sobe).
    const atualizaVeiculo = destino.campo === 'km_atual' && comp === lastComp(dados.mensal);
    let gravados = 0;
    let ok = false;
    try {
      for (let i = 0; i < alvo.length; i += LOTE) {
        await Promise.all(alvo.slice(i, i + LOTE).map(async (x) => {
          const valores = { [destino.campo]: x.valor };
          // Km rodado vindo de planilha é "informado", não Cobli.
          if (destino.campo === 'km_rodado_inf') Object.assign(valores, { km_fonte: null, km_importado_em: agora });
          await salvarRegistro('mensal', x.mensal.id, valores);
          gravados += 1;
          if (atualizaVeiculo) {
            const v = dados.veiculos.find((y) => placaDe(y.placa) === x.placa);
            const patch = v && patchVeiculo(v, { km_atual: x.valor });
            if (patch) await salvarRegistro('veiculos', v.id, patch);
          }
        }));
      }
      await salvarRegistro('arquivos', registro.id, {
        importado_em: agora, importado_qtd: alvo.length, importado_campo: destino.campo,
      });
      ok = true;
    } catch (e) {
      toast(`${e.message} ${gravados} de ${alvo.length} lançamento(s) foram gravados antes do erro.`, 'err');
    }
    try {
      await recarregar(['mensal', 'veiculos', 'arquivos']);
    } catch (e) {
      if (ok) toast(e.message, 'err');
    }
    setImportando(false);
    if (ok) {
      toast(`${alvo.length} lançamento(s) de ${compLabel(comp)} atualizados`);
      onFechar();
    }
  };

  const fechar = () => { if (!importando) onFechar(); };

  return (
    <>
      <div className="frota-scrim alto" onClick={fechar} />
      <div className="frota-modal largo" role="dialog" aria-modal="true" aria-labelledby="frota-rp-t">
        <div className="frota-modal-h">
          <h3 id="frota-rp-t">{arquivo.nome || 'Relatório'}</h3>
          <p>{[registro.plataforma, compLong(registro.competencia)].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="frota-modal-b">
          {estado.carregando && (
            <div className="frota-stack" aria-busy="true">
              {[90, 80, 70, 60].map((w) => <div key={w} className="frota-skel" style={{ width: `${w}%` }} />)}
            </div>
          )}
          {estado.erro && <div className="frota-note warn" role="alert"><span>{estado.erro}</span></div>}
          {pronto && (
            <>
              <div className="frota-filters">
                {estado.abas.length > 1 && (
                  <div className="frota-fld">
                    <label htmlFor="frota-rp-aba">Aba</label>
                    <select id="frota-rp-aba" className="frota-inp" value={aba} onChange={(e) => escolherAba(Number(e.target.value))}>
                      {estado.abas.map((a, i) => <option key={a.nome} value={i}>{a.nome}</option>)}
                    </select>
                  </div>
                )}
                <div className="frota-fld">
                  <label htmlFor="frota-rp-hdr">Linha do cabeçalho</label>
                  <input
                    id="frota-rp-hdr"
                    className="frota-inp num"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={Math.max(1, linhas.length)}
                    value={hdrTxt}
                    onChange={(e) => mudarCabecalho(e.target.value)}
                  />
                </div>
                <div className="frota-fld">
                  <span className="frota-lbl">Linhas</span>
                  <span className="frota-rp-linhas">{Math.max(0, linhas.length - hdr - 1)} registros</span>
                </div>
              </div>

              <div className="frota-tbl frota-rp-previa">
                <table className="frota-t">
                  <thead>
                    <tr>
                      {Array.from({ length: ncol }, (_, i) => (
                        <th key={i}><span className="frota-rp-letra">{letraDaColuna(i)}</span>{String(cab[i] ?? '')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {corpo.slice(0, LINHAS_PREVIA).map((l, j) => (
                      // Linha de planilha não tem chave própria: a posição é a identidade.
                      <tr key={j}>
                        {Array.from({ length: ncol }, (_, i) => {
                          const t = String(l[i] ?? '');
                          return <td key={i} title={t}>{t}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {podeEscrever && (
                <section className="frota-rp-imp">
                  <h3>Importar para o controle mensal · {compLabel(registro.competencia)}</h3>
                  <div className="frota-fgrid">
                    <div className="frota-fld">
                      <label htmlFor="frota-rp-cp">Coluna da placa</label>
                      <select id="frota-rp-cp" className="frota-inp" value={cols.colPlaca} onChange={(e) => setCols((c) => ({ ...c, colPlaca: Number(e.target.value) }))}>
                        {opcoesColuna}
                      </select>
                    </div>
                    <div className="frota-fld">
                      <label htmlFor="frota-rp-cv">Coluna do valor</label>
                      <select id="frota-rp-cv" className="frota-inp" value={cols.colValor} onChange={(e) => setCols((c) => ({ ...c, colValor: Number(e.target.value) }))}>
                        {opcoesColuna}
                      </select>
                    </div>
                    <div className="frota-fld full">
                      <label htmlFor="frota-rp-dest">Gravar em</label>
                      <select id="frota-rp-dest" className="frota-inp" value={destino?.campo || ''} onChange={(e) => setCampo(e.target.value)}>
                        {destinos.map((d) => (
                          <option key={d.campo} value={d.campo}>
                            {d.l} — {d.agg === 'max' ? 'maior valor por placa' : 'soma por placa'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {casamento.itens.length ? (
                    <>
                      <div className="frota-tbl frota-rp-casamento">
                        <table className="frota-t">
                          <thead>
                            <tr><th>Placa</th><th className="n">No relatório</th><th className="n">Hoje no controle</th><th>Situação</th></tr>
                          </thead>
                          <tbody>
                            {casamento.itens.map((x) => (
                              <tr key={x.placa}>
                                <td>{x.placa}</td>
                                <td className="n">{fmtValor(destino.t, x.valor)}</td>
                                <td className="n">{x.mensal ? fmtValor(destino.t, x.mensal[destino.campo]) : '—'}</td>
                                <td>
                                  {x.mensal
                                    ? <Pill tone="ok">Será atualizado</Pill>
                                    : <Pill tone="warn">Sem lançamento em {compLabel(registro.competencia)}</Pill>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="frota-muted frota-rp-frase">
                        {casamento.casados} veículo(s) serão atualizados
                        {casamento.semLancamento ? `; ${casamento.semLancamento} placa(s) do relatório não têm lançamento no mês e serão ignoradas` : ''}.
                      </p>
                    </>
                  ) : (
                    <p className="frota-muted frota-rp-frase">Escolha a coluna da placa e a do valor para ver o que será importado.</p>
                  )}
                </section>
              )}
            </>
          )}
        </div>
        <div className="frota-modal-a">
          <button type="button" className="frota-btn" onClick={() => baixarArquivo(arquivo, toast)}><Download size={15} /> Baixar original</button>
          <button type="button" className="frota-btn" onClick={fechar} disabled={importando}>Fechar</button>
          {podeEscrever && (
            <button type="button" className="frota-btn primary" onClick={importar} disabled={!podeImportar}>
              {importando ? 'Importando…' : 'Importar valores'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Cartão "Relatórios das plataformas" da competência. `area` é 'combustivel' ou
 * 'quilometragem'; `comp` é 'AAAA-MM' (sem competência, não aparece).
 */
export default function RelatoriosPlataformas({ area, comp }) {
  const {
    dados, recarregar, toast, podeEscrever, ausentes,
  } = useFrota();
  const plataformas = PLATAFORMAS[area] || [];
  const [plataformaEscolhida, setPlataforma] = useState(plataformas[0] || '');
  const plataforma = plataformas.includes(plataformaEscolhida) ? plataformaEscolhida : (plataformas[0] || '');
  const [enviando, setEnviando] = useState(false);
  const [excluindo, setExcluindo] = useState(null);
  const [abertoId, setAbertoId] = useState(null);

  const lista = useMemo(() => relatoriosDe(dados.arquivos, area, comp), [dados.arquivos, area, comp]);
  const outros = useMemo(
    () => relatoriosDe(dados.arquivos, area).filter((a) => a.competencia !== comp).length,
    [dados.arquivos, area, comp],
  );
  const aberto = abertoId ? lista.find((a) => a.id === abertoId) : null;

  if (!comp) return null;
  if (ausentes.includes('arquivos')) {
    return (
      <div className="frota-note warn">
        <span>Relatórios das plataformas indisponíveis: a migração supabase_migration_frota_v3.sql ainda não foi aplicada no banco.</span>
      </div>
    );
  }

  const enviar = async (file) => {
    setEnviando(true);
    let arquivo = null;
    try {
      arquivo = await enviarAnexo('arquivos', file, null, { planilhas: true });
      await salvarRegistro('arquivos', null, {
        area, competencia: comp, plataforma, arquivo,
      });
      await recarregar(['arquivos']);
      toast('Relatório anexado');
    } catch (e) {
      // Subiu mas o registro não gravou: não deixa o arquivo órfão no bucket.
      if (arquivo) removerAnexos([arquivo.path]);
      toast(e.message, 'err');
    } finally {
      setEnviando(false);
    }
  };

  const excluir = async () => {
    const a = excluindo;
    try {
      await excluirRegistro('arquivos', a.id);
      if (a.arquivo?.path) removerAnexos([a.arquivo.path]);
      await recarregar(['arquivos']);
      toast('Relatório excluído');
      setExcluindo(null);
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  return (
    <section className="frota-card">
      <div className="frota-card-h">
        <h2>Relatórios das plataformas · {compLabel(comp)}</h2>
        <span className="frota-count">{lista.length}</span>
        {outros > 0 && <span className="frota-card-nota">{outros} em outros meses</span>}
      </div>
      <p className="frota-card-s">
        Anexe o {TEXTO_AREA[area]} do mês. Aceita PDF, Excel (.xlsx/.xls), CSV e imagem. Planilhas podem ser visualizadas e importadas para o controle mensal.
      </p>

      {lista.length ? (
        <div className="frota-files frota-rp-files">
          {lista.map((a) => {
            const f = a.arquivo;
            const planilha = ehPlanilha(f.nome);
            const Icone = planilha ? FileSpreadsheet : FileText;
            const detalhe = [
              a.plataforma,
              f.enviado_em ? `enviado em ${diaDe(f.enviado_em)}${a.atualizado_por_nome ? ` por ${a.atualizado_por_nome}` : ''}` : '',
              a.importado_em ? `importado em ${diaDe(a.importado_em)} (${a.importado_qtd || 0} veículos)` : '',
            ].filter(Boolean).join(' · ');
            return (
              <div key={a.id} className="frota-file">
                <Icone size={16} aria-hidden="true" />
                <div className="fn">
                  <b title={f.nome}>{f.nome || 'arquivo'}</b>
                  <span>{detalhe}</span>
                </div>
                {planilha ? (
                  <button type="button" className="frota-btn frota-rp-btn" onClick={() => setAbertoId(a.id)}>
                    <Eye size={15} aria-hidden="true" /> {podeEscrever ? 'Visualizar / importar' : 'Visualizar'}
                  </button>
                ) : (
                  <button type="button" className="frota-ibtn" onClick={() => abrirArquivo(f, toast)} aria-label="Abrir em nova aba" title="Abrir"><ExternalLink size={15} /></button>
                )}
                <button type="button" className="frota-ibtn" onClick={() => baixarArquivo(f, toast)} aria-label="Baixar" title="Baixar"><Download size={15} /></button>
                {podeEscrever && (
                  <button type="button" className="frota-ibtn" onClick={() => setExcluindo(a)} aria-label="Excluir" title="Excluir"><Trash2 size={15} /></button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="frota-muted frota-rp-vazio">Nenhum relatório anexado neste mês.</p>
      )}

      {podeEscrever && (
        <div className="frota-up-row">
          <select
            className="frota-inp frota-comp"
            value={plataforma}
            onChange={(e) => setPlataforma(e.target.value)}
            aria-label="Plataforma de origem"
            disabled={enviando}
          >
            {plataformas.map((p) => <option key={p}>{p}</option>)}
          </select>
          <label className={`frota-upl ${enviando ? 'busy' : ''}`}>
            <Upload size={16} aria-hidden="true" />
            <span>{enviando ? 'Enviando…' : `Anexar relatório de ${compLabel(comp)} — PDF, Excel, CSV ou imagem`}</span>
            <input
              type="file"
              accept={ACEITA_RELATORIO}
              disabled={enviando}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) enviar(file);
              }}
            />
          </label>
        </div>
      )}

      {excluindo && (
        <Confirmar
          titulo="Excluir relatório?"
          texto={`“${excluindo.arquivo?.nome || 'arquivo'}” será removido para todos. Valores já importados para o controle mensal não são alterados.`}
          ok="Excluir"
          perigo
          onOk={excluir}
          onFechar={() => setExcluindo(null)}
        />
      )}
      {aberto && <VisualizarPlanilha registro={aberto} onFechar={() => setAbertoId(null)} />}
    </section>
  );
}
