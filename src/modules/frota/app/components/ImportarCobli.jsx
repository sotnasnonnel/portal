import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Upload } from 'lucide-react';
import { useFrota } from './FrotaContext';
import { Esqueleto, Pill } from './Pecas';
import { cobliParse, novoMensalDoCobli, planoCobli } from '../../lib/cobli';
import { enviarAnexo, inserirVarios, salvarRegistro } from '../../lib/frota';
import { extensaoDe, lerPlanilha } from '../../lib/planilhas';
import { compLabel, isNum, lastComp, todayISO } from '../../lib/regras';
import { fmtDate } from '../../lib/formato';
import './importarCobli.css';

// Importação do relatório "Distância percorrida" do Cobli (v3 do protótipo):
// o cartão fica na tela Quilometragem; o arquivo abre um modal de conferência e
// só grava no "Preencher". O km vai para frota_mensal.km_rodado_inf (km_fonte
// 'Cobli') e o arquivo original fica em frota_arquivos_mensais.

const EXT_COBLI = ['xlsx', 'xls', 'csv', 'ods', 'xlsm'];
const ERRO_LEITURA = 'Não foi possível ler a planilha. Confira se o arquivo abre no Excel e tente de novo.';
/** Atualizações em paralelo por vez: o suficiente para não esperar 60 idas e voltas em fila. */
const LOTE = 5;

const fmtKm = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const fmtKm0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const COMP_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "01/03 a 31/03/2026" */
const periodo = (ini, fim) => `${fmtDate(ini).slice(0, 5)} a ${fmtDate(fim)}`;
/** Data local de um timestamptz (o slice do ISO em UTC vira o dia seguinte à noite). */
const dataDe = (ts) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};

export default function ImportarCobli({ comp, onComp }) {
  const {
    dados, recarregar, toast, podeEscrever, ausentes,
  } = useFrota();
  const semTabela = ausentes.includes('arquivos');
  // null = fechado. { nome, file, carregando } | { nome, erro } | { nome, file, parsed, comp, criar, zero }
  const [imp, setImp] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  // Leitura em andamento: fechar o modal antes de terminar descarta o resultado.
  const leitura = useRef(0);

  // ------------------------------------------------------------ cartão
  const comCobli = useMemo(
    () => dados.mensal.filter((m) => m.competencia === comp && m.km_fonte === 'Cobli').length,
    [dados.mensal, comp],
  );
  const ultima = useMemo(() => {
    const imps = dados.arquivos
      .filter((a) => a.area === 'quilometragem' && a.plataforma === 'Cobli' && a.importado_em)
      .sort((a, b) => String(b.importado_em).localeCompare(String(a.importado_em)));
    // A do mês da tela, se houver; senão a mais recente de todas.
    return imps.find((a) => a.competencia === comp) || imps[0] || null;
  }, [dados.arquivos, comp]);

  // ------------------------------------------------------------ arquivo
  const abrirArquivo = async (file) => {
    if (!file || !podeEscrever || semTabela) return;
    if (!EXT_COBLI.includes(extensaoDe(file.name))) {
      toast('Envie o Excel exportado do Cobli (.xlsx).', 'err');
      return;
    }
    const minha = ++leitura.current;
    setImp({ nome: file.name, carregando: true });
    let abas;
    try {
      ({ abas } = await lerPlanilha(file, file.name));
    } catch {
      if (minha === leitura.current) setImp({ nome: file.name, erro: ERRO_LEITURA });
      return;
    }
    if (minha !== leitura.current) return;
    // Primeira aba em que o cabeçalho aparece; sem nenhuma, o erro da primeira.
    let parsed = null;
    let erro = null;
    for (const aba of abas) {
      try {
        parsed = cobliParse(aba.linhas, file.name);
        break;
      } catch (e) {
        erro = erro || e;
      }
    }
    if (!parsed) {
      setImp({ nome: file.name, erro: erro?.message || ERRO_LEITURA });
      return;
    }
    setImp({
      nome: file.name,
      file,
      parsed,
      comp: parsed.comp || comp || lastComp(dados.mensal) || todayISO().slice(0, 7),
      criar: true,
      zero: false,
    });
  };

  const fechar = useCallback(() => {
    if (ocupado) return;
    leitura.current += 1;
    setImp(null);
  }, [ocupado]);

  // Na captura, como em Confirmar: Esc fecha só o modal, não o que está atrás.
  const aberto = imp != null;
  useEffect(() => {
    if (!aberto) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      fechar();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [aberto, fechar]);

  // ------------------------------------------------------------ plano
  const plano = useMemo(() => (
    imp?.parsed ? planoCobli(imp.parsed.linhas, imp.comp, { criar: imp.criar, zero: imp.zero }, dados) : []
  ), [imp, dados]);
  const aGravar = plano.filter((x) => x.grava);
  const compOk = COMP_RE.test(imp?.comp || '');
  const podeAplicar = podeEscrever && !semTabela && compOk && aGravar.length > 0 && !ocupado;

  const muda = (patch) => setImp((p) => ({ ...p, ...patch }));

  // ------------------------------------------------------------ aplicar
  const aplicar = async () => {
    if (!podeAplicar) return;
    const competencia = imp.comp;
    const { parsed, file } = imp;
    const itens = aGravar;
    const agora = new Date().toISOString();
    setOcupado(true);

    // 1) O arquivo original. Se não subir, a importação segue sem ele.
    let arquivo = null;
    try {
      arquivo = await enviarAnexo('arquivos', file, null, { planilhas: true });
    } catch {
      arquivo = null;
    }

    // 2) Lançamentos existentes: só o km; os que faltam nascem do veículo.
    const atualizar = itens.filter((x) => x.ms);
    const criar = itens.filter((x) => !x.ms);
    let atualizados = 0;
    let criados = 0;
    let registrado = false;
    try {
      for (let i = 0; i < atualizar.length; i += LOTE) {
        const lote = atualizar.slice(i, i + LOTE);
        // allSettled: a contagem do que já entrou fica certa mesmo se um do lote falhar.
        const res = await Promise.allSettled(lote.map((x) => (
          salvarRegistro('mensal', x.ms.id, { km_rodado_inf: x.km, km_fonte: 'Cobli', km_importado_em: agora })
        )));
        atualizados += res.filter((r) => r.status === 'fulfilled').length;
        const falha = res.find((r) => r.status === 'rejected');
        if (falha) throw falha.reason;
      }
      if (criar.length) {
        await inserirVarios('mensal', criar.map((x) => novoMensalDoCobli(x.v, competencia, x.km, agora)));
        criados = criar.length;
      }
      // 3) O registro da importação, que aparece em Relatórios das plataformas.
      await salvarRegistro('arquivos', null, {
        area: 'quilometragem',
        competencia,
        plataforma: 'Cobli',
        periodo_inicio: parsed.ini || null,
        periodo_fim: parsed.fim || null,
        km_total: parsed.soma,
        arquivo,
        importado_em: agora,
        importado_qtd: atualizados + criados,
        importado_campo: 'km_rodado_inf',
      });
      registrado = true;
    } catch (e) {
      const feitos = atualizados + criados;
      const jaGravado = feitos
        ? `Já gravado: km de ${feitos} veículo(s) em ${compLabel(competencia)}${registrado ? '' : ', sem o registro da importação'}.`
        : 'Nenhum veículo foi alterado.';
      toast(`Importação interrompida: ${e.message} ${jaGravado}`, 'err');
      // Recarrega para o modal mostrar o que já entrou ("Já preenchido").
      await recarregar(['mensal', 'arquivos']).catch(() => {});
      setOcupado(false);
      return;
    }

    try {
      await recarregar(['mensal', 'arquivos']);
    } catch (e) {
      toast(`Km gravado, mas a tela não atualizou: ${e.message}`, 'err');
    }
    setOcupado(false);
    setImp(null);
    onComp?.(competencia);
    toast(`Km do Cobli preenchido em ${atualizados + criados} veículo(s) de ${compLabel(competencia)}${arquivo ? '' : ' (arquivo não arquivado)'}`);
  };

  // ------------------------------------------------------------ cartão
  const zona = () => {
    if (semTabela) {
      return (
        <div className="frota-note warn">
          <span>A importação do Cobli ainda não está disponível: falta aplicar no banco a migração supabase_migration_frota_v3.sql.</span>
        </div>
      );
    }
    if (!podeEscrever) {
      return <div className="frota-note"><span>A importação fica disponível para quem tem acesso à gestão da frota.</span></div>;
    }
    return (
      <label
        className={`frota-upl frota-cobli-upl ${arrastando ? 'arrastando' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          abrirArquivo(e.dataTransfer.files?.[0]);
        }}
      >
        <Upload size={16} aria-hidden="true" />
        <span><b>Enviar relatório do Cobli</b> — arraste o arquivo aqui ou clique para escolher (.xlsx)</span>
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.ods"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            abrirArquivo(file);
          }}
        />
      </label>
    );
  };

  return (
    <section className="frota-card frota-cobli">
      <div className="frota-card-h">
        <h2>Importar distância percorrida — Cobli</h2>
        {comCobli
          ? <Pill tone="ok"><Check size={12} aria-hidden="true" /> {comCobli} veículo(s) com km do Cobli em {compLabel(comp)}</Pill>
          : <Pill>Sem importação em {compLabel(comp)}</Pill>}
      </div>
      <p className="frota-card-s">
        No Cobli, exporte o relatório <b>Distância percorrida</b> do mês em Excel e envie aqui. O sistema lê o período do
        relatório, encontra cada placa e preenche o km rodado do mês de referência — você confere antes de gravar.
      </p>
      {ultima && (
        <p className="frota-hint">
          Última importação: {dataDe(ultima.importado_em)}
          {ultima.atualizado_por_nome ? ` por ${ultima.atualizado_por_nome}` : ''}
          {' · '}{ultima.importado_qtd || 0} veículo(s)
          {isNum(ultima.km_total) ? ` · ${fmtKm0.format(ultima.km_total)} km` : ''}
          {ultima.periodo_inicio ? ` · período ${fmtDate(ultima.periodo_inicio)} a ${fmtDate(ultima.periodo_fim)}` : ''}
          {ultima.competencia !== comp ? ` · referente a ${compLabel(ultima.competencia)}` : ''}
        </p>
      )}
      {zona()}
      {imp && (
        <ModalCobli
          imp={imp}
          plano={plano}
          aGravar={aGravar}
          ocupado={ocupado}
          podeAplicar={podeAplicar}
          muda={muda}
          fechar={fechar}
          aplicar={aplicar}
        />
      )}
    </section>
  );
}

function ModalCobli({
  imp, plano, aGravar, ocupado, podeAplicar, muda, fechar, aplicar,
}) {
  const { parsed } = imp;
  return (
    <>
      <div className="frota-scrim alto" onClick={fechar} />
      <div className="frota-modal largo" role="dialog" aria-modal="true" aria-labelledby="frota-cobli-t">
        <div className="frota-modal-h">
          <h3 id="frota-cobli-t">Importar distância percorrida — Cobli</h3>
          <p>{imp.nome}</p>
        </div>
        <div className="frota-modal-b" aria-busy={imp.carregando ? 'true' : undefined}>
          {imp.carregando && <Esqueleto linhas={4} />}
          {imp.erro && <div className="frota-note warn" role="alert"><span>{imp.erro}</span></div>}
          {parsed && <Conferencia imp={imp} plano={plano} aGravar={aGravar} ocupado={ocupado} muda={muda} />}
        </div>
        <div className="frota-modal-a">
          <button type="button" className="frota-btn" onClick={fechar} disabled={ocupado}>{parsed ? 'Cancelar' : 'Fechar'}</button>
          {parsed && (
            <button type="button" className="frota-btn primary" onClick={aplicar} disabled={!podeAplicar}>
              {ocupado ? 'Importando…' : `Preencher ${aGravar.length} veículo(s) em ${compLabel(imp.comp)}`}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function Conferencia({
  imp, plano, aGravar, ocupado, muda,
}) {
  const { parsed } = imp;
  const nZero = plano.filter((x) => x.km === 0).length;
  const naoCadastradas = plano.filter((x) => x.acao === 'Placa não cadastrada' && x.km > 0);
  const semLancamento = plano.filter((x) => x.acao === 'Sem lançamento no mês');
  const totalConfere = parsed.total == null || Math.abs(parsed.total - parsed.soma) < 1;
  const atravessa = parsed.ini && parsed.fim && parsed.ini.slice(0, 7) !== parsed.fim.slice(0, 7);
  const visiveis = plano.filter((x) => imp.zero || x.km !== 0);

  let subTotal = 'soma das linhas';
  if (parsed.total != null) {
    subTotal = totalConfere
      ? `confere com o total do relatório (${fmtKm.format(parsed.total)} km)`
      : `atenção: relatório indica ${fmtKm.format(parsed.total)} km`;
  }

  return (
    <>
      <div className="frota-kpis">
        <div className="frota-kpi">
          <span className="frota-kpi-l">Período do relatório</span>
          <span className="frota-kpi-n">{parsed.ini ? <span className="frota-cobli-per">{periodo(parsed.ini, parsed.fim)}</span> : '—'}</span>
          <span className="frota-kpi-s">{parsed.ini ? 'lido do cabeçalho do Cobli' : 'informe o mês abaixo'}</span>
        </div>
        <div className="frota-kpi">
          <span className="frota-kpi-l">Distância total</span>
          <span className="frota-kpi-n">{fmtKm0.format(parsed.soma)} km</span>
          <span className={`frota-kpi-s ${totalConfere ? '' : 'warn'}`}>{subTotal}</span>
        </div>
        <div className="frota-kpi">
          <span className="frota-kpi-l">Veículos a preencher</span>
          <span className={`frota-kpi-n ${aGravar.length ? 'ok' : ''}`}>{aGravar.length}</span>
          <span className="frota-kpi-s">{plano.length} placas no relatório · {nZero} com 0 km</span>
        </div>
      </div>

      <div className="frota-cobli-opcoes">
        <div className="frota-fld">
          <label htmlFor="frota-cobli-comp">Mês de referência</label>
          <input
            id="frota-cobli-comp"
            className="frota-inp"
            type="month"
            value={imp.comp}
            disabled={ocupado}
            onChange={(e) => muda({ comp: e.target.value })}
          />
        </div>
        <label className="frota-cobli-chk">
          <input type="checkbox" checked={imp.criar} disabled={ocupado} onChange={(e) => muda({ criar: e.target.checked })} />
          Criar o lançamento do mês para veículos cadastrados que ainda não têm
        </label>
        <label className="frota-cobli-chk">
          <input type="checkbox" checked={imp.zero} disabled={ocupado} onChange={(e) => muda({ zero: e.target.checked })} />
          Incluir veículos com 0 km
        </label>
      </div>

      {!COMP_RE.test(imp.comp || '') && (
        <div className="frota-note warn"><span>Informe o mês de referência para importar.</span></div>
      )}
      {atravessa && (
        <div className="frota-note warn"><span>O período do relatório atravessa mais de um mês. Confira o mês de referência antes de importar.</span></div>
      )}

      <div className="frota-tbl frota-cobli-tbl">
        <table className="frota-t">
          <thead>
            <tr>
              <th>Placa</th><th>Grupo no Cobli</th><th>Veículo no sistema</th>
              <th className="n">Km no relatório</th><th className="n">Km hoje no mês</th><th>O que será feito</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length ? visiveis.map((x) => (
              <tr key={x.placa} className={x.grava ? '' : 'apagada'}>
                <td><b>{x.placa}</b></td>
                <td>{x.grupo || '—'}</td>
                <td>
                  {x.v ? (
                    <>
                      {[x.v.modelo, x.v.condutor].filter(Boolean).join(' · ') || '—'}
                      {x.v.status !== 'Ativo' && <span className="s"> · {x.v.status}</span>}
                    </>
                  ) : <span className="s">—</span>}
                </td>
                <td className="n">{fmtKm.format(x.km)}</td>
                <td className="n">{x.ms && isNum(x.ms.km_rodado_inf) ? fmtKm.format(x.ms.km_rodado_inf) : '—'}</td>
                <td><Pill tone={x.tom}>{x.acao}</Pill></td>
              </tr>
            )) : (
              <tr><td colSpan={6}><div className="frota-empty">Nenhuma placa com km no período.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {!imp.zero && nZero > 0 && (
        <div className="frota-hint">{nZero} placa(s) com 0 km no período não aparecem na lista (GPS sem movimento ou veículo já devolvido).</div>
      )}
      {naoCadastradas.length > 0 && (
        <div className="frota-note warn">
          <span>Placas com km no Cobli que não estão cadastradas na frota: {naoCadastradas.map((x) => x.placa).join(', ')}. Cadastre o veículo em Veículos e importe de novo.</span>
        </div>
      )}
      {semLancamento.length > 0 && (
        <div className="frota-note">
          <span>{semLancamento.length} veículo(s) sem lançamento em {compLabel(imp.comp)}. Marque “Criar o lançamento do mês” para incluí-los.</span>
        </div>
      )}
      <div className="frota-hint">
        O km do Cobli é gravado como “Km rodado no mês” e passa a valer sobre o cálculo pelo hodômetro. O arquivo original fica
        guardado em Relatórios das plataformas de {compLabel(imp.comp)}.
      </div>
    </>
  );
}
