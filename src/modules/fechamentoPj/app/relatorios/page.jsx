import { useEffect, useMemo, useState } from 'react';
import { FileText, Wallet, FileSpreadsheet, FileCode2, Download, Banknote, ArrowDown } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Cabecalho, SeletorCompetencia, Carregando, Vazio, Aviso, Badge } from '../components/ui';
import { listarEnvelopes, auditar } from '../../lib/dados';
import {
  RM_PADRAO, montarLinhasPagamento, prontoParaTxt, gerarTxt, paraCp1252, dadosConferencia, csvPagamento,
} from '../../lib/totvs';
import { gravarXlsx, baixar } from '../../lib/arquivos';
import { partesCompetencia, competenciaRotulo, fmtBRL } from '../../lib/formato';
import FolhaAnalitica from './FolhaAnalitica';
import PlanilhaFinanceira from './PlanilhaFinanceira';
import PagamentoTotvs from './PagamentoTotvs';
import './relatorios.css';

/**
 * Relatórios do Fechamento PJ. Valem para competência aberta e fechada: na
 * fechada, montarLinhasPagamento usa o cadastro e o rateio congelados no
 * envelope, então o relatório de um mês antigo não muda com o cadastro de hoje.
 */
export default function PaginaRelatorios() {
  const {
    competencias = [], competencia, competenciaAtual, setCompetencia, prestadores = [], fornecedores = [], rateios = [],
    centrosMapa = {}, config, notificar, carregando: carregandoBase,
  } = useFechamentoPj();
  // Envelopes guardados junto da competência de origem: trocar de mês mostra
  // "carregando" sem precisar zerar estado dentro do efeito.
  const [dados, setDados] = useState(null);
  const [modal, setModal] = useState(null); // 'folha' | 'financeira'
  const [ocupado, setOcupado] = useState('');
  const [resultadoTxt, setResultadoTxt] = useState(null);

  useEffect(() => {
    if (!competencia) return undefined;
    let cancelado = false;
    listarEnvelopes(competencia)
      .then((envelopes) => { if (!cancelado) setDados({ competencia, envelopes, erro: '' }); })
      .catch((e) => { if (!cancelado) setDados({ competencia, envelopes: [], erro: e.message }); });
    return () => { cancelado = true; };
  }, [competencia]);

  const carregando = Boolean(competencia) && dados?.competencia !== competencia;
  const envelopes = useMemo(() => (dados?.competencia === competencia ? dados.envelopes : []), [dados, competencia]);
  const rm = useMemo(() => ({ ...RM_PADRAO, ...(config?.rm || {}) }), [config]);

  const linhas = useMemo(
    () => montarLinhasPagamento({ envelopes, prestadores, fornecedores, rateios, centros: centrosMapa }),
    [envelopes, prestadores, fornecedores, rateios, centrosMapa],
  );
  const prontos = useMemo(() => linhas.filter(prontoParaTxt).length, [linhas]);

  const partes = partesCompetencia(competencia);
  const rotulo = competenciaRotulo(competencia);

  // O NF/documento é gravado pela tabela; aqui só reflete no estado local.
  function aoSalvarDocumento(envelopeId, patch) {
    setDados((d) => (d ? { ...d, envelopes: d.envelopes.map((e) => (e.id === envelopeId ? { ...e, ...patch } : e)) } : d));
  }

  async function exportar(nome, acao) {
    setOcupado(nome);
    try {
      await acao();
      await auditar('Relatório exportado', `${nome} • ${rotulo}`, { competencia });
    } catch (e) {
      notificar(e.message || `Não foi possível gerar ${nome}.`, 'erro');
    } finally {
      setOcupado('');
    }
  }

  const gerarExcelConferencia = () => exportar('Excel de Conferência TOTVS RM', async () => {
    const { abas } = dadosConferencia({ linhas, competencia, rm, fornecedores });
    await gravarXlsx(abas, `Layout_Pagamento_PJ_TOTVS_RM_${partes.mm}_${partes.aaaa}.xlsx`);
    notificar('Excel de conferência gerado (7 abas).');
  });

  function gerarArquivoTxt() {
    const r = gerarTxt({ linhas, competencia, rm });
    setResultadoTxt(r);
    if (!r.prontos) {
      notificar('Nenhum prestador está pronto para o TXT. Confira código RM e rateio.', 'alerta');
      return;
    }
    exportar('TXT TOTVS RM', async () => {
      baixar(new Blob([paraCp1252(r.conteudo)], { type: 'text/plain' }), `Pagamento_PJ_${partes.mm}_${partes.aaaa}_TOTVS_RM_PRONTOS.txt`);
      notificar(`TXT gerado: ${r.prontos} prestador(es), ${fmtBRL(r.total)}.`);
    });
  }

  const gerarCsv = () => exportar('CSV Pagamento TOTVS RM', async () => {
    baixar(csvPagamento({ linhas, rm }), `Pagamento_PJ_${partes.mm}_${partes.aaaa}_TOTVS_RM.csv`, 'text/csv;charset=utf-8');
    notificar('CSV gerado.');
  });

  const aoExportarPlanilha = () => auditar('Relatório exportado', `Planilha Financeira • ${rotulo}`, { competencia });
  const aoImprimirFolha = () => auditar('Relatório exportado', `Folha Analítica PJ • ${rotulo}`, { competencia });

  if (carregandoBase) return <Carregando />;

  if (!competencias.length) {
    return (
      <>
        <Cabecalho titulo="Relatórios" subtitulo="Folha analítica, planilha do Financeiro e pagamento no TOTVS RM." />
        <Vazio>Nenhuma competência aberta ainda. Abra a primeira na Folha de Pagamento.</Vazio>
      </>
    );
  }

  const semEnvelopes = !carregando && !envelopes.length;

  return (
    <>
      <Cabecalho titulo="Relatórios"
        subtitulo="Folha analítica, planilha do Financeiro e pagamento no TOTVS RM. Competência fechada usa o cadastro congelado no fechamento.">
        <SeletorCompetencia competencias={competencias} valor={competencia} onTrocar={setCompetencia} />
      </Cabecalho>

      {dados?.erro && dados.competencia === competencia && <Aviso tipo="erro">{dados.erro}</Aviso>}

      {carregando ? <Carregando texto="Carregando envelopes da competência…" /> : (
        <>
          {semEnvelopes && <Aviso tipo="alerta">A competência {rotulo} não tem envelopes. Os relatórios sairiam vazios.</Aviso>}

          <div className="pj-cartoes">
            <div className="pj-cartao pj-rel-cartao">
              <div className="pj-rel-icone"><FileText size={20} /></div>
              <h3>Folha Analítica PJ</h3>
              <p>Eventos de cada prestador, totais e o TOTAL GERAL por código. Pronta para imprimir ou salvar em PDF.</p>
              <div className="pj-rel-meta">{rotulo} · {envelopes.length} prestador(es) · <Badge tipo="competencia" valor={competenciaAtual?.status} /></div>
              <button type="button" className="btn btn-primary" onClick={() => setModal('folha')} disabled={semEnvelopes}>
                Abrir Folha Analítica
              </button>
            </div>

            <div className="pj-cartao pj-rel-cartao">
              <div className="pj-rel-icone"><Wallet size={20} /></div>
              <h3>Planilha Financeira</h3>
              <p>Líquido para a nota fiscal e dados bancários de cada prestador, no formato que o Financeiro recebe.</p>
              <div className="pj-rel-meta">{fmtBRL(linhas.reduce((s, l) => s + l.liquido, 0))} líquido</div>
              <button type="button" className="btn btn-primary" onClick={() => setModal('financeira')} disabled={semEnvelopes}>
                Abrir Planilha Financeira
              </button>
            </div>

            <div className="pj-cartao pj-rel-cartao">
              <div className="pj-rel-icone"><Banknote size={20} /></div>
              <h3>Pagamento PJ — TOTVS RM</h3>
              <p>Conferência do pagamento: código RM, rateio, Nº da NF e Nº do documento RM de cada prestador.</p>
              <div className="pj-rel-meta">{prontos} pronto(s) · {linhas.length - prontos} pendente(s)</div>
              <a className="btn btn-outline" href="#pagamento-totvs"><ArrowDown size={16} /> Ir para a conferência</a>
            </div>

            <div className="pj-cartao pj-rel-cartao">
              <div className="pj-rel-icone"><FileSpreadsheet size={20} /></div>
              <h3>Excel de Conferência</h3>
              <p>7 abas no padrão TOTVS RM: parâmetros, fornecedores, entrada, rateio, base L/U, pendências e resumo.</p>
              <div className="pj-rel-meta">Layout_Pagamento_PJ_TOTVS_RM_{partes?.mm}_{partes?.aaaa}.xlsx</div>
              <button type="button" className="btn btn-primary" onClick={gerarExcelConferencia} disabled={semEnvelopes || Boolean(ocupado)}>
                <Download size={16} /> {ocupado === 'Excel de Conferência TOTVS RM' ? 'Gerando…' : 'Gerar Excel'}
              </button>
            </div>

            <div className="pj-cartao pj-rel-cartao">
              <div className="pj-rel-icone"><FileCode2 size={20} /></div>
              <h3>TXT TOTVS RM</h3>
              <p>Arquivo de layout fixo (L + U) para importar no RM. Só entram os prontos: código RM e rateio com centro de custo RM válido.</p>
              <div className="pj-rel-meta">Prontos para TXT: <strong>{prontos}</strong> · Pendências: <strong>{linhas.length - prontos}</strong></div>
              {resultadoTxt && (resultadoTxt.prontos ? (
                <div className="pj-rel-resultado">
                  Último TXT: {resultadoTxt.prontos} pronto(s) · {resultadoTxt.pendentes} pendente(s) · {fmtBRL(resultadoTxt.total)}
                </div>
              ) : (
                <Aviso tipo="alerta">
                  Nenhum prestador pronto. Cada um precisa de código RM no cadastro de fornecedor e de rateio com
                  código RM de centro de custo (d.ddd.dddddd). Veja as pendências abaixo.
                </Aviso>
              ))}
              <div className="pj-rel-botoes">
                <button type="button" className="btn btn-primary" onClick={gerarArquivoTxt} disabled={semEnvelopes || Boolean(ocupado)}>
                  <Download size={16} /> Gerar TXT
                </button>
                <button type="button" className="btn btn-outline" onClick={gerarCsv} disabled={semEnvelopes || Boolean(ocupado)}>
                  <Download size={16} /> CSV
                </button>
              </div>
            </div>
          </div>

          <div className="pj-rel-parametros">
            <span className="pj-rel-parametros-titulo">Parâmetros RM</span>
            <span className="pj-rel-chip">Filial <b>{rm.filial}</b></span>
            <span className="pj-rel-chip">Tipo doc. <b>{rm.tipoDocumento} - {rm.tipoDocumentoDesc}</b></span>
            <span className="pj-rel-chip">Série <b>{rm.serie}</b></span>
            <span className="pj-rel-chip">Natureza <b>{rm.natureza} - {rm.naturezaDesc}</b></span>
            <span className="pj-rel-chip">Conta/Caixa <b>{rm.contaCaixa} - {rm.contaCaixaDesc}</b></span>
            <span className="pj-rel-chip">Dados bancários <b>{rm.dadosBancarios} - {rm.dadosBancariosDesc}</b></span>
          </div>

          <PagamentoTotvs linhas={linhas} competencia={competencia} onSalvo={aoSalvarDocumento} />
        </>
      )}

      {modal === 'folha' && (
        <FolhaAnalitica envelopes={envelopes} prestadores={prestadores} competenciaAtual={competenciaAtual}
          onImprimir={aoImprimirFolha} onFechar={() => setModal(null)} />
      )}
      {modal === 'financeira' && (
        <PlanilhaFinanceira envelopes={envelopes} prestadores={prestadores} competencia={competencia}
          onExportado={aoExportarPlanilha} onFechar={() => setModal(null)} />
      )}
    </>
  );
}
