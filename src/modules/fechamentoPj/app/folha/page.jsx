import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Users, Calculator, CheckCircle2, AlertTriangle, FileCheck, Wallet, MinusCircle, Banknote, Search, Upload, Send,
  UserPlus, Lock, Unlock, CalendarPlus, ChevronDown, FileText, Eye, CalendarDays, X,
} from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import {
  Cabecalho, SeletorCompetencia, StatCard, Badge, Moeda, Aviso, Carregando, Vazio,
} from '../components/ui';
import { listarEnvelopes, gravarEnvelopes, marcarTermo, auditar, nomesColaboradores } from '../../lib/dados';
import { indexar, loteCalculo } from '../../lib/lote';
import {
  competenciaRotulo, dataBr, dataHoraBr, fmtBRL, somar,
} from '../../lib/formato';
import { pessoaDoEnvelope, combinaBusca } from './folhaUtil';
import Envelope from './Envelope';
import InputFolha from './InputFolha';
import { ModalTermo, DialogoEnvio } from './Termo';
import {
  DialogoAbrirCompetencia, DialogoFecharCompetencia, DialogoReabrirCompetencia, DialogoCalendario, DialogoIncluirPrestador,
} from './DialogosCompetencia';
import './folha.css';

// Folha do mês: grade dos envelopes da competência em exibição, com cálculo,
// termos, input da planilha e o ciclo abrir/fechar/reabrir.
// Competência fechada abre só para consulta (termo e envio seguem liberados).

const ORIGENS_CALCULO = {
  selecionados: 'Cálculo dos prestadores selecionados',
  pendentes: 'Cálculo de envelopes pendentes',
  todos: 'Cálculo geral da folha',
};

const FILTROS = [
  ['todos', 'Todos'],
  ['divergencias', 'Divergências'],
  ['pendentes', 'Pendentes de cálculo'],
  ['nao_enviado', 'Termo não enviado'],
];

const VAZIO = new Set();

export default function Pagina() {
  const ctx = useFechamentoPj();
  const {
    carregando, erro: erroBase, user, config, competencias = [], competencia, competenciaAtual, aberta, setCompetencia,
    prestadores = [], rateios = [], encerramentos = [], centrosMapa, recarregar, notificar,
  } = ctx;

  const [estado, setEstado] = useState({ competencia: null, lista: [], erro: '' });
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [selecao, setSelecao] = useState({ competencia: null, ids: VAZIO });
  const [dialogo, setDialogo] = useState(null); // abrir | fechar | reabrir | calendario | incluir | input
  const [envelopeAberto, setEnvelopeAberto] = useState(null); // { id, aba }
  const [termoId, setTermoId] = useState(null);
  const [envioIds, setEnvioIds] = useState(null);
  const [ocupado, setOcupado] = useState('');
  const [menuCalculo, setMenuCalculo] = useState(false);
  const [nomes, setNomes] = useState(new Map());
  const pedido = useRef(0);
  const menuRef = useRef(null);

  // Só a resposta do último pedido vale (troca rápida de competência).
  const recarregarEnvelopes = useCallback(async () => {
    if (!competencia) return;
    const n = ++pedido.current;
    try {
      const lista = await listarEnvelopes(competencia);
      if (n === pedido.current) setEstado({ competencia, lista, erro: '' });
    } catch (e) {
      if (n === pedido.current) setEstado({ competencia, lista: [], erro: e.message });
    }
  }, [competencia]);

  useEffect(() => { recarregarEnvelopes(); }, [recarregarEnvelopes]);

  const idsAutores = `${competenciaAtual?.fechada_por || ''}|${competenciaAtual?.reaberta_por || ''}`;
  useEffect(() => {
    let vivo = true;
    const ids = idsAutores.split('|').filter(Boolean);
    if (ids.length) nomesColaboradores(ids).then((m) => { if (vivo) setNomes(m); }).catch(() => {});
    return () => { vivo = false; };
  }, [idsAutores]);

  useEffect(() => {
    if (!menuCalculo) return undefined;
    const fora = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuCalculo(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [menuCalculo]);

  const carregandoEnvelopes = Boolean(competencia) && estado.competencia !== competencia;
  const envelopes = useMemo(() => (estado.competencia === competencia ? estado.lista : []), [estado, competencia]);
  const ids = selecao.competencia === competencia ? selecao.ids : VAZIO;

  const indice = useMemo(() => indexar({ prestadores, rateios, encerramentos }), [prestadores, rateios, encerramentos]);

  const linhas = useMemo(() => envelopes.map((env) => {
    const prestador = indice.prestadorPorId.get(env.prestador_id) || null;
    return {
      envelope: env,
      prestador,
      pessoa: pessoaDoEnvelope(env, prestador),
      encerramento: indice.encerramentoPorPrestador.get(env.prestador_id) || null,
    };
  }).sort((a, b) => String(a.pessoa.codigo).localeCompare(String(b.pessoa.codigo))), [envelopes, indice]);

  const filtradas = useMemo(() => linhas.filter((l) => {
    const e = l.envelope;
    if (filtro === 'divergencias' && e.conferencia !== 'divergente') return false;
    if (filtro === 'pendentes' && e.calculado_em) return false;
    if (filtro === 'nao_enviado' && e.envio === 'enviado') return false;
    return combinaBusca(l, busca);
  }), [linhas, filtro, busca]);

  const kpis = useMemo(() => ({
    total: envelopes.length,
    calculados: envelopes.filter((e) => e.calculado_em).length,
    ok: envelopes.filter((e) => e.conferencia === 'ok').length,
    divergentes: envelopes.filter((e) => e.conferencia === 'divergente').length,
    gerados: envelopes.filter((e) => e.termo === 'gerado').length,
    bruto: somar(envelopes, 'bruto'),
    descontos: somar(envelopes, 'descontos'),
    liquido: somar(envelopes, 'liquido'),
  }), [envelopes]);

  const totaisFiltro = {
    bruto: somar(filtradas.map((l) => l.envelope), 'bruto'),
    descontos: somar(filtradas.map((l) => l.envelope), 'descontos'),
    liquido: somar(filtradas.map((l) => l.envelope), 'liquido'),
  };

  const selecionadas = linhas.filter((l) => ids.has(l.envelope.id));
  const outraAberta = competencias.find((c) => c.status === 'aberta' && c.competencia !== competencia) || null;
  const existeAberta = competencias.some((c) => c.status === 'aberta');
  const termosParaGerar = linhas.filter((l) => l.envelope.termo === 'disponivel' && l.envelope.conferencia === 'ok');
  const termosParaEnviar = linhas.filter((l) => l.envelope.termo === 'gerado' && l.envelope.envio !== 'enviado');

  const setIds = (novo) => setSelecao({ competencia, ids: novo });
  const alternar = (id) => {
    const novo = new Set(ids);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setIds(novo);
  };
  const todasMarcadas = filtradas.length > 0 && filtradas.every((l) => ids.has(l.envelope.id));
  const alternarTodas = () => {
    const novo = new Set(ids);
    filtradas.forEach((l) => (todasMarcadas ? novo.delete(l.envelope.id) : novo.add(l.envelope.id)));
    setIds(novo);
  };

  async function executar(rotulo, fn) {
    setOcupado(rotulo);
    try {
      await fn();
    } catch (e) {
      notificar(e.message, 'erro');
    } finally {
      setOcupado('');
    }
  }

  // Lança erro para quem chamou (o diálogo de fechamento mostra inline).
  async function calcular(escopo, origem = ORIGENS_CALCULO[escopo]) {
    const payloads = loteCalculo({
      envelopes, indice, config, competencia, centros: centrosMapa, origem,
      ids: escopo === 'selecionados' ? [...ids] : null,
      pendentes: escopo === 'pendentes',
    });
    if (!payloads.length) {
      notificar(escopo === 'pendentes' ? 'Nenhum envelope pendente de cálculo.' : 'Nenhum envelope para calcular.', 'alerta');
      return;
    }
    const n = await gravarEnvelopes(competencia, payloads);
    const div = payloads.filter((p) => p.conferencia === 'divergente').length;
    await auditar('Cálculo da folha executado', `${n} envelope(s) • ${origem}${div ? ` • ${div} com divergência` : ''}`, { competencia });
    await Promise.all([recarregarEnvelopes(), recarregar()]);
    notificar(`${n} envelope(s) calculado(s)${div ? `, ${div} com divergência` : ''}.`, div ? 'alerta' : 'sucesso');
  }

  async function gerarTermos(alvo, { abrir = false } = {}) {
    const aptos = alvo.filter((l) => l.envelope.termo === 'disponivel' && l.envelope.conferencia === 'ok');
    const bloqueados = alvo.filter((l) => l.envelope.termo === 'bloqueado' || l.envelope.conferencia === 'divergente').length;
    const jaGerados = alvo.filter((l) => l.envelope.termo === 'gerado').length;
    const pulados = [bloqueados && `${bloqueados} com divergência/bloqueado(s)`, jaGerados && `${jaGerados} já gerado(s)`].filter(Boolean).join(', ');
    if (!aptos.length) {
      notificar(`Nenhum termo para gerar${pulados ? ` (${pulados})` : ''}.`, 'alerta');
      return;
    }
    const n = await marcarTermo(aptos.map((l) => l.envelope.id), 'gerar', user?.id);
    if (aptos.length === 1) {
      await auditar('Termo gerado', `${aptos[0].pessoa.codigo} - ${aptos[0].pessoa.nome}`, { competencia, prestadorId: aptos[0].envelope.prestador_id });
    } else {
      await auditar('Termos gerados', `${n} termo(s)${pulados ? ` • ignorados: ${pulados}` : ''}`, { competencia });
    }
    await recarregarEnvelopes();
    notificar(`${n} termo(s) gerado(s)${pulados ? `; ignorados: ${pulados}` : ''}.`, pulados || n < aptos.length ? 'alerta' : 'sucesso');
    if (abrir && n === 1) setTermoId(aptos[0].envelope.id);
  }

  const abrirEnvelope = (l, aba) => setEnvelopeAberto({ id: l.envelope.id, aba: aba || (l.envelope.conferencia === 'divergente' ? 'conferencia' : 'eventos') });

  async function aposCompetencia(msg) {
    setDialogo(null);
    await Promise.all([recarregar(), recarregarEnvelopes()]);
    if (msg) notificar(msg);
  }

  const dialogos = (
    <>
      {dialogo === 'abrir' && (
        <DialogoAbrirCompetencia
          onFechar={() => setDialogo(null)}
          onConcluido={async (iso, n) => {
            setDialogo(null);
            setCompetencia(iso);
            await recarregar();
            notificar(`Competência ${competenciaRotulo(iso)} aberta com ${n ?? 0} envelope(s).`);
          }}
        />
      )}
      {dialogo === 'fechar' && (
        <DialogoFecharCompetencia
          envelopes={envelopes}
          onFechar={() => setDialogo(null)}
          onCalcularPendentes={() => calcular('pendentes', 'Cálculo automático antes do fechamento da competência')}
          onConcluido={() => aposCompetencia(`Competência ${competenciaRotulo(competencia)} fechada.`)}
        />
      )}
      {dialogo === 'reabrir' && (
        <DialogoReabrirCompetencia
          onFechar={() => setDialogo(null)}
          onConcluido={() => aposCompetencia(`Competência ${competenciaRotulo(competencia)} reaberta.`)}
        />
      )}
      {dialogo === 'calendario' && (
        <DialogoCalendario onFechar={() => setDialogo(null)} onConcluido={() => aposCompetencia('Calendário salvo.')} />
      )}
      {dialogo === 'incluir' && (
        <DialogoIncluirPrestador
          envelopes={envelopes}
          onFechar={() => setDialogo(null)}
          onConcluido={(p) => aposCompetencia(`${p.nome} incluído em ${competenciaRotulo(competencia)}.`)}
        />
      )}
      {dialogo === 'input' && (
        <InputFolha
          envelopes={envelopes}
          onFechar={() => setDialogo(null)}
          onConcluido={async () => { setDialogo(null); await recarregarEnvelopes(); }}
        />
      )}
    </>
  );

  if (carregando) return <Carregando texto="Carregando o Fechamento PJ…" />;
  if (erroBase) return <Aviso tipo="erro">{erroBase}</Aviso>;

  if (!competencias.length) {
    return (
      <div className="pj-folha">
        <Cabecalho titulo="Folha do mês" subtitulo="Fechamento mensal dos prestadores PJ" />
        <Vazio>
          <p>Nenhuma competência aberta ainda.</p>
          <button type="button" className="btn btn-primary" onClick={() => setDialogo('abrir')}>
            <CalendarPlus size={16} /> Abrir competência
          </button>
        </Vazio>
        {dialogos}
      </div>
    );
  }

  const termoLinha = termoId ? linhas.find((l) => l.envelope.id === termoId) : null;
  const envioLinhas = envioIds ? linhas.filter((l) => envioIds.includes(l.envelope.id)) : null;
  const fechadaPor = nomes.get(competenciaAtual?.fechada_por);
  const reabertaPor = nomes.get(competenciaAtual?.reaberta_por);
  const semAcao = Boolean(ocupado) || carregandoEnvelopes;

  return (
    <div className="pj-folha">
      <Cabecalho titulo="Folha do mês" subtitulo="Fechamento mensal dos prestadores PJ">
        <SeletorCompetencia competencias={competencias} valor={competencia} onTrocar={setCompetencia} />
      </Cabecalho>

      {competenciaAtual && (
        <div className={`pj-faixa ${aberta ? '' : 'pj-faixa--fechada'}`}>
          <Badge tipo="competencia" valor={competenciaAtual.status} />
          <b>Competência {competenciaRotulo(competencia)}</b>
          {!aberta && (
            <span className="pj-faixa-meta">
              <Lock size={13} /> Fechada em {dataHoraBr(competenciaAtual.fechada_em)}{fechadaPor ? ` por ${fechadaPor}` : ''}
              {competenciaAtual.origem === 'historico' ? ' · carga histórica' : ''}
            </span>
          )}
          {aberta && competenciaAtual.reaberta_em && (
            <span className="pj-faixa-meta">
              Reaberta em {dataHoraBr(competenciaAtual.reaberta_em)}{reabertaPor ? ` por ${reabertaPor}` : ''}
              {competenciaAtual.motivo_reabertura ? `: “${competenciaAtual.motivo_reabertura}”` : ''}
            </span>
          )}
          <span className="pj-faixa-meta">
            <CalendarDays size={13} /> Termos {dataBr(competenciaAtual.data_envio_termos)} · NF até {dataHoraBr(competenciaAtual.prazo_nf)} · pagamento {dataBr(competenciaAtual.data_pagamento)}
          </span>
          <div className="pj-faixa-acoes">
            {aberta && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDialogo('calendario')}>Editar calendário</button>
            )}
            {outraAberta && (
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setCompetencia(outraAberta.competencia)}>
                Ir para {competenciaRotulo(outraAberta.competencia)} (em conferência)
              </button>
            )}
          </div>
        </div>
      )}

      {!existeAberta && (
        <Aviso tipo="info" acao={(
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setDialogo('abrir')}>
            <CalendarPlus size={14} /> Abrir competência
          </button>
        )}>
          Nenhuma competência em conferência. As fechadas ficam só para consulta.
        </Aviso>
      )}

      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      <div className="pj-kpis">
        <StatCard tom="secondary" icone={<Users size={20} />} valor={kpis.total} rotulo="Prestadores"
          ativo={filtro === 'todos'} onClick={() => setFiltro('todos')} />
        <StatCard tom="accent" icone={<Calculator size={20} />} valor={`${kpis.calculados}/${kpis.total}`} rotulo="Envelopes calculados"
          ativo={filtro === 'pendentes'} onClick={() => setFiltro('pendentes')} />
        <StatCard tom="success" icone={<CheckCircle2 size={20} />} valor={kpis.ok} rotulo="Sem divergência" />
        <StatCard tom="danger" icone={<AlertTriangle size={20} />} valor={kpis.divergentes} rotulo="Com divergência"
          ativo={filtro === 'divergencias'} onClick={() => setFiltro('divergencias')} />
        <StatCard tom="primary" icone={<FileCheck size={20} />} valor={kpis.gerados} rotulo="Termos gerados" />
      </div>
      <div className="pj-kpis pj-kpis--valores">
        <StatCard tom="secondary" icone={<Wallet size={20} />} valor={fmtBRL(kpis.bruto)} rotulo="Bruto" />
        <StatCard tom="warning" icone={<MinusCircle size={20} />} valor={fmtBRL(kpis.descontos)} rotulo="Descontos" />
        <StatCard tom="success" icone={<Banknote size={20} />} valor={fmtBRL(kpis.liquido)} rotulo="Líquido NF" />
      </div>

      <div className="pj-toolbar">
        <button type="button" className="btn btn-outline" onClick={() => setDialogo('input')} disabled={!aberta || semAcao}>
          <Upload size={16} /> Input da planilha
        </button>
        <div className="pj-folha-menu" ref={menuRef}>
          <button type="button" className="btn btn-outline" onClick={() => setMenuCalculo((v) => !v)} disabled={!aberta || semAcao}
            aria-expanded={menuCalculo}>
            <Calculator size={16} /> {ocupado === 'calcular' ? 'Calculando…' : 'Calcular'} <ChevronDown size={14} />
          </button>
          {menuCalculo && (
            <div className="pj-folha-menu-lista" role="menu">
              {[
                ['selecionados', `Selecionados (${ids.size})`, !ids.size],
                ['pendentes', `Pendentes (${kpis.total - kpis.calculados})`, kpis.total === kpis.calculados],
                ['todos', `Folha completa (${kpis.total})`, !kpis.total],
              ].map(([escopo, rotulo, desabilitado]) => (
                <button key={escopo} type="button" role="menuitem" disabled={desabilitado}
                  onClick={() => { setMenuCalculo(false); executar('calcular', () => calcular(escopo)); }}>
                  {rotulo}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="btn btn-outline" disabled={semAcao}
          onClick={() => executar('termos', () => gerarTermos(ids.size ? selecionadas : termosParaGerar))}>
          <FileCheck size={16} /> {ocupado === 'termos' ? 'Gerando…' : `Gerar termos (${ids.size ? selecionadas.length : termosParaGerar.length})`}
        </button>
        <button type="button" className="btn btn-outline" disabled={semAcao || !(ids.size ? selecionadas.length : termosParaEnviar.length)}
          onClick={() => setEnvioIds((ids.size ? selecionadas : termosParaEnviar).map((l) => l.envelope.id))}>
          <Send size={16} /> Enviar por e-mail
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setDialogo('incluir')} disabled={!aberta || semAcao}>
          <UserPlus size={16} /> Incluir prestador
        </button>
        <div className="pj-toolbar-direita">
          {aberta && (
            <button type="button" className="btn btn-primary" onClick={() => setDialogo('fechar')} disabled={semAcao}>
              <Lock size={16} /> Fechar competência
            </button>
          )}
          {!aberta && competenciaAtual?.origem === 'app' && (
            <button type="button" className="btn btn-outline" onClick={() => setDialogo('reabrir')} disabled={semAcao || existeAberta}
              title={existeAberta ? 'Feche a competência em conferência antes de reabrir esta.' : undefined}>
              <Unlock size={16} /> Reabrir
            </button>
          )}
          {!aberta && !existeAberta && (
            <button type="button" className="btn btn-primary" onClick={() => setDialogo('abrir')} disabled={semAcao}>
              <CalendarPlus size={16} /> Abrir próxima
            </button>
          )}
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Envelopes <span className="pj-sub">{filtradas.length}/{linhas.length}</span></div>
          <div className="table-search pj-folha-busca">
            <Search size={16} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Código, nome, e-mail, razão social, CNPJ, CPF ou função" />
            {busca && <button type="button" className="btn-icon" onClick={() => setBusca('')} title="Limpar busca"><X size={14} /></button>}
          </div>
        </div>
        <div className="filter-chips pj-folha-chips">
          {FILTROS.map(([v, l]) => (
            <button key={v} type="button" className={`filter-chip ${filtro === v ? 'active' : ''}`} onClick={() => setFiltro(v)}>{l}</button>
          ))}
        </div>

        {ids.size > 0 && (
          <div className="pj-selecao">
            <span>{ids.size} registro(s) selecionado(s)</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setIds(new Set())}>Limpar seleção</button>
          </div>
        )}

        {carregandoEnvelopes ? <Carregando texto="Carregando envelopes…" /> : (
          <div className="table-scroll">
            <table className="data-table pj-folha-grade">
              <thead>
                <tr>
                  <th className="pj-centro">
                    <input type="checkbox" aria-label="Selecionar todos" checked={todasMarcadas} onChange={alternarTodas} disabled={!filtradas.length} />
                  </th>
                  <th>Código</th>
                  <th>Prestador</th>
                  <th>Empresa</th>
                  <th>Início</th>
                  <th className="pj-direita">Bruto</th>
                  <th className="pj-direita">Descontos</th>
                  <th className="pj-direita">Líquido</th>
                  <th>Conferência</th>
                  <th>Termo</th>
                  <th>Envio</th>
                  <th className="pj-direita">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l) => {
                  const e = l.envelope;
                  return (
                    <tr key={e.id} className={`${e.conferencia === 'divergente' ? 'pj-linha-divergente' : ''} ${ids.has(e.id) ? 'pj-linha-selecionada' : ''}`}
                      onDoubleClick={() => abrirEnvelope(l)}>
                      <td className="pj-centro">
                        <input type="checkbox" aria-label={`Selecionar ${l.pessoa.nome}`} checked={ids.has(e.id)} onChange={() => alternar(e.id)} />
                      </td>
                      <td className="pj-num">{l.pessoa.codigo}</td>
                      <td>
                        <button type="button" className="pj-link" onClick={() => abrirEnvelope(l)}>{l.pessoa.nome}</button>
                        <div className="pj-sub">{l.pessoa.email || 'sem e-mail'}</div>
                        {l.encerramento && (
                          <div className="pj-sub pj-folha-encerramento">
                            Encerramento {l.encerramento.status === 'programado' ? 'programado' : 'registrado'} · {dataBr(l.encerramento.data_encerramento)}
                          </div>
                        )}
                      </td>
                      <td>{l.pessoa.empresa || '—'}</td>
                      <td>{dataBr(l.pessoa.dataInicio)}</td>
                      <td className="pj-direita"><Moeda valor={e.bruto} /></td>
                      <td className="pj-direita"><Moeda valor={e.descontos} /></td>
                      <td className="pj-direita"><Moeda valor={e.liquido} forte /></td>
                      <td>
                        <Badge tipo="conferencia" valor={e.conferencia} />
                        {e.conferencia === 'divergente' && (
                          <div><button type="button" className="pj-link pj-sub" onClick={() => abrirEnvelope(l, 'conferencia')}>ver o que corrigir</button></div>
                        )}
                        {!e.calculado_em && <div className="pj-sub">sem cálculo</div>}
                      </td>
                      <td><Badge tipo="termo" valor={e.termo} /></td>
                      <td>
                        <Badge tipo="envio" valor={e.envio} />
                        {e.enviado_em && <div className="pj-sub">{dataBr(String(e.enviado_em).slice(0, 10))}</div>}
                      </td>
                      <td>
                        <div className="pj-acoes-linha">
                          <button type="button" className="btn-icon" title="Abrir envelope" onClick={() => abrirEnvelope(l)}><FileText size={16} /></button>
                          {e.termo === 'disponivel' && e.conferencia === 'ok' && (
                            <button type="button" className="btn-icon" title="Gerar termo" disabled={semAcao}
                              onClick={() => executar('termos', () => gerarTermos([l], { abrir: true }))}><FileCheck size={16} /></button>
                          )}
                          {e.termo === 'gerado' && (
                            <button type="button" className="btn-icon" title="Ver termo" onClick={() => setTermoId(e.id)}><Eye size={16} /></button>
                          )}
                          {e.termo === 'gerado' && e.envio !== 'enviado' && (
                            <button type="button" className="btn-icon" title="Enviar por e-mail" onClick={() => setEnvioIds([e.id])}><Send size={16} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filtradas.length && (
                  <tr>
                    <td colSpan={12} className="table-empty">
                      {linhas.length ? 'Nenhum envelope com este filtro.' : 'Nenhum envelope nesta competência.'}
                    </td>
                  </tr>
                )}
              </tbody>
              {filtradas.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={5}>Duplo clique no prestador abre o envelope · {filtradas.length} envelope(s)</td>
                    <td className="pj-direita"><Moeda valor={totaisFiltro.bruto} /></td>
                    <td className="pj-direita"><Moeda valor={totaisFiltro.descontos} /></td>
                    <td className="pj-direita"><Moeda valor={totaisFiltro.liquido} forte /></td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {envelopeAberto && (
        <Envelope
          key={`env-${competencia}`}
          linhas={filtradas}
          todas={linhas}
          envelopeId={envelopeAberto.id}
          abaInicial={envelopeAberto.aba}
          onTrocar={(id) => setEnvelopeAberto((a) => ({ ...a, id }))}
          onFechar={() => setEnvelopeAberto(null)}
          onGravado={recarregarEnvelopes}
          onGerarTermo={(l) => executar('termos', () => gerarTermos([l], { abrir: true }))}
          onVerTermo={(l) => setTermoId(l.envelope.id)}
          onRegistrarEnvio={(ls) => setEnvioIds(ls.map((l) => l.envelope.id))}
        />
      )}
      {termoLinha && (
        <ModalTermo linha={termoLinha} onFechar={() => setTermoId(null)} onRegistrarEnvio={(ls) => setEnvioIds(ls.map((l) => l.envelope.id))} />
      )}
      {envioLinhas && (
        <DialogoEnvio
          linhas={envioLinhas}
          onFechar={() => setEnvioIds(null)}
          onConcluido={async ({ manterAberto = false } = {}) => { if (!manterAberto) setEnvioIds(null); await recarregarEnvelopes(); }}
        />
      )}
      {dialogos}
    </div>
  );
}
