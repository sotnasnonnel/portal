import { useEffect, useMemo, useState } from 'react';
import { Upload, FileSpreadsheet, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Modal, Aviso, Moeda } from '../components/ui';
import {
  listarImportacoes, salvarPrestador, incluirNoMes, listarEnvelopes, gravarEnvelopes, registrarImportacao, auditar,
} from '../../lib/dados';
import { lerArquivoXlsx } from '../../lib/arquivos';
import { lerFolha, casarLinhas } from '../../lib/planilha';
import { indexar, loteInput, atualizacaoCadastral, prestadorDaLinha } from '../../lib/lote';
import { competenciaRotulo, dataHoraBr, digitos, fmtBRL } from '../../lib/formato';
import TableScroll from '../../../../components/UI/TableScroll';

// Input da planilha Líquido PJ NF em 3 etapas: ler, conferir, confirmar.
// Nada é gravado antes da etapa 3.

const MODOS = {
  descontos: {
    rotulo: 'Somente descontos',
    texto: 'Mantém o valor contratual vigente e troca apenas os eventos de desconto.',
  },
  completo: {
    rotulo: 'Input completo',
    texto: 'Atualiza o cadastro com o que a planilha traz (inclusive o valor contratual), proventos, descontos e aplica a proporcionalidade.',
  },
};

export default function InputFolha({ envelopes, onFechar, onConcluido }) {
  const {
    competencia, prestadores, rateios, encerramentos, config, centrosMapa, recarregar, notificar,
  } = useFechamentoPj();
  const [etapa, setEtapa] = useState(1);
  const [modo, setModo] = useState('descontos');
  const [arquivo, setArquivo] = useState(null);
  const [leitura, setLeitura] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [historico, setHistorico] = useState(null);
  const [progresso, setProgresso] = useState('');

  useEffect(() => {
    let vivo = true;
    listarImportacoes(50)
      .then((lista) => { if (vivo) setHistorico(lista.filter((i) => i.tipo === 'folha').slice(0, 8)); })
      .catch(() => { if (vivo) setHistorico([]); });
    return () => { vivo = false; };
  }, []);

  const conferencia = useMemo(() => {
    if (!leitura) return null;
    const casamento = casarLinhas(leitura.linhas, prestadores);
    const casados = casamento.filter((c) => c.prestador);
    const conflitos = casamento.filter((c) => c.conflito);
    const semCorrespondencia = casamento.filter((c) => !c.prestador && !c.conflito);
    const automatico = Boolean(config?.cadastro_automatico);
    const noMes = new Set(envelopes.map((e) => e.prestador_id));
    return {
      casados,
      conflitos,
      novos: automatico ? semCorrespondencia : [],
      ignorados: automatico ? [] : semCorrespondencia,
      comDescontos: leitura.linhas.filter((l) => l.descontos_total > 0).length,
      comDocumento: leitura.linhas.filter((l) => digitos(l.cpf).length === 11 || digitos(l.cnpj).length === 14).length,
      totalDiferente: leitura.linhas.filter((l) => Math.abs(l.descontos_total - l.soma_colunas) > 0.009),
      foraDoMes: casados.filter((c) => !noMes.has(c.prestador.id)).length,
      desligados: casados.filter((c) => c.prestador.situacao !== 'ativo').length,
    };
  }, [leitura, prestadores, envelopes, config]);

  async function processar() {
    setLendo(true);
    setErro('');
    try {
      const abas = await lerArquivoXlsx(arquivo);
      setLeitura(lerFolha(abas));
      setEtapa(2);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLendo(false);
    }
  }

  async function confirmar() {
    let passo = '';
    setErro('');
    setProgresso('Iniciando…');
    try {
      const casados = conferencia.casados.map((c) => ({ linha: c.linha, prestador: c.prestador, novo: false }));
      const atualizados = new Map();

      if (modo === 'completo') {
        passo = 'Atualizar o cadastro dos prestadores localizados';
        for (let i = 0; i < casados.length; i += 1) {
          const patch = atualizacaoCadastral(casados[i].prestador, casados[i].linha);
          if (!Object.keys(patch).length) continue;
          setProgresso(`Atualizando cadastro ${i + 1} de ${casados.length}…`);
          const salvo = await salvarPrestador({ id: casados[i].prestador.id, ...patch });
          atualizados.set(salvo.id, salvo);
          casados[i] = { ...casados[i], prestador: salvo };
        }
      }

      passo = 'Cadastrar os prestadores novos';
      for (let i = 0; i < conferencia.novos.length; i += 1) {
        setProgresso(`Cadastrando prestador novo ${i + 1} de ${conferencia.novos.length}…`);
        const { linha } = conferencia.novos[i];
        const salvo = await salvarPrestador(prestadorDaLinha(linha, { competencia, empresaPadrao: config?.empresa_padrao }));
        await incluirNoMes(competencia, salvo.id);
        atualizados.set(salvo.id, salvo);
        casados.push({ linha, prestador: salvo, novo: true });
      }

      passo = 'Recarregar os envelopes do mês';
      setProgresso('Recarregando envelopes…');
      const envelopesAtuais = await listarEnvelopes(competencia);

      passo = 'Calcular e gravar os envelopes';
      setProgresso(`Calculando ${casados.length} envelope(s)…`);
      const todosPrestadores = [
        ...prestadores.map((p) => atualizados.get(p.id) || p),
        ...[...atualizados.values()].filter((p) => !prestadores.some((x) => x.id === p.id)),
      ];
      const payloads = loteInput({
        casados,
        envelopes: envelopesAtuais,
        indice: indexar({ prestadores: todosPrestadores, rateios, encerramentos }),
        config,
        competencia,
        centros: centrosMapa,
        modo,
        arquivo: arquivo.name,
      });
      await gravarEnvelopes(competencia, payloads);

      passo = 'Registrar a importação';
      setProgresso('Registrando a importação…');
      const divergentes = payloads.filter((p) => p.conferencia === 'divergente').length;
      await registrarImportacao({
        tipo: 'folha',
        competencia,
        arquivo: arquivo.name,
        modo,
        linhas: leitura.linhas.length,
        localizados: conferencia.casados.length,
        novos: conferencia.novos.length,
        sem_correspondencia: conferencia.ignorados.length + conferencia.conflitos.length,
        bruto: leitura.bruto,
        descontos: leitura.descontos,
        liquido: leitura.liquido,
        resumo: {
          conflitos: conferencia.conflitos.map((c) => ({ linha: c.linha.linha, nome: c.linha.nome, motivo: c.conflito })),
          ignorados: conferencia.ignorados.map((c) => ({ linha: c.linha.linha, nome: c.linha.nome })),
          divergentes,
        },
      });
      await auditar('Input da planilha confirmado',
        `${arquivo.name} • ${MODOS[modo].rotulo} • ${payloads.length} envelope(s) • ${conferencia.novos.length} novo(s) • ${divergentes} com divergência`,
        { competencia });

      passo = 'Recarregar a tela';
      await recarregar();
      notificar(`Input confirmado: ${payloads.length} envelope(s) calculado(s)${divergentes ? `, ${divergentes} com divergência` : ''}.`,
        divergentes ? 'alerta' : 'sucesso');
      await onConcluido();
    } catch (e) {
      setErro(`Falhou na etapa "${passo}": ${e.message}. O que foi gravado antes dela permanece; rodar o input de novo é seguro.`);
      // Cadastros podem ter mudado antes da falha: a base precisa refletir isso.
      recarregar();
    } finally {
      setProgresso('');
    }
  }

  const executando = Boolean(progresso);
  const planilhaOutroMes = leitura?.competencia && leitura.competencia !== competencia;

  const rodape = (
    <>
      <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={executando || lendo}>Cancelar</button>
      {etapa > 1 && (
        <button type="button" className="btn btn-outline" onClick={() => { setEtapa(etapa - 1); setErro(''); }} disabled={executando}>
          <ArrowLeft size={16} /> Voltar
        </button>
      )}
      {etapa === 1 && (
        <button type="button" className="btn btn-primary" onClick={processar} disabled={!arquivo || lendo}>
          <FileSpreadsheet size={16} /> {lendo ? 'Lendo…' : 'Processar e conferir'}
        </button>
      )}
      {etapa === 2 && (
        <button type="button" className="btn btn-primary" onClick={() => setEtapa(3)}
          disabled={!conferencia.casados.length && !conferencia.novos.length}>
          Continuar <ArrowRight size={16} />
        </button>
      )}
      {etapa === 3 && (
        <button type="button" className="btn btn-primary" onClick={confirmar} disabled={executando}>
          <CheckCircle2 size={16} /> {executando ? 'Gravando…' : 'Confirmar input'}
        </button>
      )}
    </>
  );

  return (
    <Modal largura="lg" titulo="Input da planilha" subtitulo={`Competência ${competenciaRotulo(competencia)}`}
      onFechar={onFechar} bloqueado={executando || lendo} rodape={rodape}>
      <div className="pj-etapas">
        {['Selecionar arquivo', 'Conferência', 'Confirmar'].map((t, i) => (
          <span key={t} className={`pj-etapa ${etapa === i + 1 ? 'ativa' : ''}`}><b>{i + 1}</b>{t}</span>
        ))}
      </div>

      <div className="pj-folha-pilha">
        {etapa === 1 && (
          <>
            <div className="pj-folha-modos">
              {Object.entries(MODOS).map(([k, m]) => (
                <label key={k} className={`pj-folha-escolha-item ${modo === k ? 'ativo' : ''}`}>
                  <input type="radio" name="pj-modo" checked={modo === k} onChange={() => setModo(k)} />
                  <div><b>{m.rotulo}</b><div className="pj-sub">{m.texto}</div></div>
                </label>
              ))}
            </div>
            <label className="pj-arquivo">
              <Upload size={20} />
              <div className="pj-folha-arquivo-texto">
                <b>{arquivo ? arquivo.name : 'Selecione a planilha Líquido PJ NF (.xlsx)'}</b>
                <div className="pj-sub">{arquivo ? `${Math.round(arquivo.size / 1024)} KB · pronta para leitura` : 'Aba EMISSÃO NF, ou outra com Nome Completo e colunas de desconto'}</div>
              </div>
              <input type="file" accept=".xlsx" className="pj-folha-arquivo-input"
                onChange={(e) => { setArquivo(e.target.files?.[0] || null); setLeitura(null); setErro(''); }} />
            </label>
            {modo === 'descontos' && (
              <ol className="pj-folha-regras">
                <li>Localiza pelo CNPJ ou CPF do cadastro.</li>
                <li>Sem documento, pelo nome completo normalizado.</li>
                <li>O valor contratual vem do cadastro; bruto diferente vira divergência.</li>
                <li>Só os eventos de desconto são trocados.</li>
              </ol>
            )}
            <div>
              <div className="pj-secao-titulo">Últimos inputs</div>
              {historico === null && <span className="pj-sub">Carregando…</span>}
              {historico?.length === 0 && <span className="pj-sub">Nenhum input registrado ainda.</span>}
              {historico?.length > 0 && (
                <ul className="pj-folha-historico">
                  {historico.map((h) => (
                    <li key={h.id}>
                      <b>{competenciaRotulo(h.competencia)}</b> · {h.arquivo} · {MODOS[h.modo]?.rotulo || h.modo || '—'}
                      <span className="pj-sub"> · {dataHoraBr(h.importado_em)} · {h.localizados} localizados, {h.novos} novos</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {etapa === 2 && conferencia && (
          <>
            <div className="pj-pares">
              <div className="pj-par"><small>Arquivo</small><b>{arquivo?.name}</b></div>
              <div className="pj-par"><small>Aba</small><b>{leitura.aba}</b></div>
              <div className="pj-par"><small>Competência na planilha</small><b>{leitura.competencia ? competenciaRotulo(leitura.competencia) : 'não informada'}</b></div>
              <div className="pj-par"><small>Modo</small><b>{MODOS[modo].rotulo}</b></div>
            </div>
            {planilhaOutroMes && (
              <Aviso tipo="alerta">
                A planilha é de {competenciaRotulo(leitura.competencia)}, mas a competência em conferência é {competenciaRotulo(competencia)}. Confira antes de seguir.
              </Aviso>
            )}
            <div className="pj-kpis">
              <div className="pj-folha-mini"><small>Linhas lidas</small><b>{leitura.linhas.length}</b></div>
              <div className="pj-folha-mini"><small>Com descontos</small><b>{conferencia.comDescontos}</b></div>
              <div className="pj-folha-mini"><small>Com CPF/CNPJ</small><b>{conferencia.comDocumento}</b></div>
              <div className="pj-folha-mini"><small>Localizados</small><b>{conferencia.casados.length}</b></div>
              <div className="pj-folha-mini"><small>Bruto</small><b>{fmtBRL(leitura.bruto)}</b></div>
              <div className="pj-folha-mini"><small>Descontos</small><b>{fmtBRL(leitura.descontos)}</b></div>
              <div className="pj-folha-mini"><small>Líquido</small><b>{fmtBRL(leitura.liquido)}</b></div>
            </div>

            {conferencia.foraDoMes > 0 && <Aviso tipo="info">{conferencia.foraDoMes} localizado(s) ainda sem envelope no mês serão incluídos.</Aviso>}
            {conferencia.desligados > 0 && <Aviso tipo="alerta">{conferencia.desligados} localizado(s) estão desligados no cadastro e entrarão no mês.</Aviso>}
            {conferencia.totalDiferente.length > 0 && (
              <Aviso tipo="alerta">
                {conferencia.totalDiferente.length} linha(s) com TOTAL DESCONTOS diferente da soma das colunas. Viram divergência no envelope:{' '}
                {conferencia.totalDiferente.map((l) => `linha ${l.linha} (${l.nome}: ${fmtBRL(l.descontos_total)} x ${fmtBRL(l.soma_colunas)})`).join('; ')}.
              </Aviso>
            )}
            {conferencia.conflitos.length > 0 && (
              <Aviso tipo="erro">
                {conferencia.conflitos.length} linha(s) em conflito ficam de fora: {conferencia.conflitos.map((c) => `linha ${c.linha.linha} ${c.linha.nome} (${c.conflito})`).join('; ')}.
              </Aviso>
            )}
            {conferencia.novos.length > 0 && (
              <Aviso tipo="info">
                {conferencia.novos.length} linha(s) sem cadastro viram prestador novo: {conferencia.novos.map((c) => c.linha.nome).join(', ')}.
              </Aviso>
            )}
            {conferencia.ignorados.length > 0 && (
              <Aviso tipo="alerta">
                Cadastro automático desligado: {conferencia.ignorados.length} linha(s) sem cadastro serão ignoradas: {conferencia.ignorados.map((c) => c.linha.nome).join(', ')}.
              </Aviso>
            )}

            <TableScroll className="pj-folha-rolagem">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Linha</th><th>Nome na planilha</th><th>Cadastro</th><th>Critério</th>
                    <th className="pj-direita">Bruto</th><th className="pj-direita">Descontos</th><th className="pj-direita">Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {conferencia.casados.map((c) => (
                    <tr key={c.linha.linha}>
                      <td>{c.linha.linha}</td>
                      <td>{c.linha.nome}</td>
                      <td>{c.prestador.codigo} · {c.prestador.nome}</td>
                      <td><span className="badge aprovada">{c.criterio}</span></td>
                      <td className="pj-direita"><Moeda valor={c.linha.bruto} /></td>
                      <td className="pj-direita"><Moeda valor={c.linha.descontos_total} /></td>
                      <td className="pj-direita"><Moeda valor={c.linha.liquido} /></td>
                    </tr>
                  ))}
                  {conferencia.novos.map((c) => (
                    <tr key={c.linha.linha}>
                      <td>{c.linha.linha}</td>
                      <td>{c.linha.nome}</td>
                      <td className="pj-sub">cadastro novo</td>
                      <td><span className="badge pendente">Novo</span></td>
                      <td className="pj-direita"><Moeda valor={c.linha.bruto} /></td>
                      <td className="pj-direita"><Moeda valor={c.linha.descontos_total} /></td>
                      <td className="pj-direita"><Moeda valor={c.linha.liquido} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </>
        )}

        {etapa === 3 && conferencia && (
          <>
            <Aviso tipo="info">
              {modo === 'descontos'
                ? `Os ${conferencia.casados.length} envelope(s) localizados mantêm os proventos e recebem os descontos da planilha.`
                : `Os ${conferencia.casados.length} cadastro(s) localizados são atualizados com o que a planilha traz e os envelopes são recalculados com o bruto da planilha.`}
              {conferencia.novos.length ? ` ${conferencia.novos.length} prestador(es) novo(s) serão cadastrados e incluídos no mês.` : ''}
              {' '}Cada envelope é calculado e as divergências aparecem na conferência. Resoluções anteriores deixam de valer.
            </Aviso>
            <Aviso tipo="sucesso">Competências fechadas não são tocadas; o histórico mensal fica preservado.</Aviso>
            {executando && <div className="pj-carregando">{progresso}</div>}
          </>
        )}

        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Modal>
  );
}
