import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, RefreshCw, Plus, Pencil, Trash2, FileCheck, Eye, Send,
  AlertTriangle, CheckCircle2, Clock, ExternalLink, Lock,
} from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import {
  Modal, Aviso, Abas, Badge, Moeda, Campo, Vazio, Carregando,
} from '../components/ui';
import { gravarEnvelopes, auditar, listarCalculos, nomesColaboradores } from '../../lib/dados';
import {
  calcularEnvelope, proporcionalidade, totaisEventos, ajustarPorResolucao, RESOLUCOES, TIPOS_DIVERGENCIA,
  EVENTO_BRUTO, EVENTO_OUTROS_DESCONTOS,
} from '../../lib/calculo';
import {
  competenciaRotulo, dataBr, dataHoraBr, fmtBRL, fmtNum, fmtPct, maiusculo, mascararCnpj, paraNumero, round2, somar,
} from '../../lib/formato';
import { eventosOrdenados } from './folhaUtil';
import TableScroll from '../../../../components/UI/TableScroll';

// Envelope de pagamento de um prestador na competência: eventos, rateio,
// conferência e log de cálculo. Todo cálculo passa por lib/calculo; a tela só
// monta o que vai para pj_gravar_envelopes.

const ABAS = ['eventos', 'rateio', 'conferencia', 'log'];

export default function Envelope({
  linhas, todas, envelopeId, abaInicial = 'eventos', onTrocar, onFechar, onGravado, onGerarTermo, onVerTermo, onRegistrarEnvio,
}) {
  const ctx = useFechamentoPj();
  const {
    config, rateios, encerramentos, centrosMapa, aberta, competencia, notificar, prestadores,
  } = ctx;
  const [aba, setAba] = useState(ABAS.includes(abaInicial) ? abaInicial : 'eventos');
  const [ocupado, setOcupado] = useState('');

  const linha = todas.find((l) => l.envelope.id === envelopeId) || null;
  const indice = linhas.findIndex((l) => l.envelope.id === envelopeId);
  const envelope = linha?.envelope;
  const pessoa = linha?.pessoa;
  const prestador = useMemo(() => prestadores.find((p) => p.id === envelope?.prestador_id) || null, [prestadores, envelope]);
  const rateiosPrestador = useMemo(() => rateios.filter((r) => r.prestador_id === envelope?.prestador_id), [rateios, envelope]);
  const encerramento = encerramentos.find((e) => e.prestador_id === envelope?.prestador_id) || null;
  const eventos = useMemo(() => eventosOrdenados(envelope), [envelope]);

  if (!linha) {
    return (
      <Modal titulo="Envelope de pagamento" onFechar={onFechar}>
        <Aviso tipo="alerta">Este envelope não está mais na competência em exibição.</Aviso>
      </Modal>
    );
  }

  const divergenciasAbertas = (envelope.divergencias || []).filter((d) => !d.resolvida);
  const bloqueadoEdicao = !aberta || Boolean(ocupado);

  /**
   * Monta o envelope de novo com os eventos informados e grava.
   * registrar=false: só atualiza eventos, totais e conferência (não vira
   * "calculado" nem gera log). registrar=true: cálculo completo com log.
   */
  async function gravar(eventosNovos, { registrar, origem, resolucoes, acao, detalhe, rotulo }) {
    if (!prestador) {
      notificar('O cadastro deste prestador não foi encontrado; não é possível recalcular.', 'erro');
      return false;
    }
    setOcupado(rotulo || 'Gravando…');
    try {
      const { payload } = calcularEnvelope({
        envelope: resolucoes ? { ...envelope, resolucoes } : envelope,
        eventos: eventosNovos,
        prestador,
        config,
        competencia,
        encerramento,
        rateios: rateiosPrestador,
        centros: centrosMapa,
        origem,
        registrar,
      });
      if (resolucoes) payload.resolucoes = resolucoes;
      await gravarEnvelopes(competencia, [payload]);
      await auditar(acao, detalhe, { competencia, prestadorId: envelope.prestador_id });
      await onGravado();
      return payload;
    } catch (e) {
      notificar(e.message, 'erro');
      return false;
    } finally {
      setOcupado('');
    }
  }

  async function recalcular() {
    const r = await gravar(eventos, {
      registrar: true, origem: 'Recálculo no Envelope de Pagamento', acao: 'Recálculo do envelope',
      detalhe: `${pessoa.codigo} - ${pessoa.nome}`, rotulo: 'Recalculando…',
    });
    if (r) notificar(r.conferencia === 'divergente' ? 'Envelope recalculado, com divergência.' : 'Envelope recalculado.', r.conferencia === 'divergente' ? 'alerta' : 'sucesso');
  }

  const ir = (i) => {
    const alvo = linhas[i];
    if (alvo) onTrocar(alvo.envelope.id);
  };

  const podeGerar = envelope.termo === 'disponivel' && envelope.conferencia === 'ok';
  const podeEnviar = envelope.termo === 'gerado' && envelope.envio !== 'enviado';

  return (
    <Modal
      largura="xl"
      titulo={`Envelope de pagamento: ${pessoa.codigo} - ${pessoa.nome}`}
      subtitulo={`Competência ${competenciaRotulo(envelope.competencia)}${aberta ? '' : ' · somente leitura'}`}
      onFechar={onFechar}
      bloqueado={Boolean(ocupado)}
      rodape={(
        <>
          <span className="pj-folha-rodape-status">
            {envelope.conferencia === 'divergente'
              ? <button type="button" className="pj-link" onClick={() => setAba('conferencia')}>Revisar divergência</button>
              : <Badge tipo="conferencia" valor={envelope.conferencia} />}
            {ocupado && <span className="pj-sub">{ocupado}</span>}
          </span>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={Boolean(ocupado)}>Fechar</button>
          {aberta && (
            <button type="button" className="btn btn-outline" onClick={recalcular} disabled={Boolean(ocupado)}>
              <RefreshCw size={16} /> Recalcular
            </button>
          )}
          {podeGerar && (
            <button type="button" className="btn btn-outline" onClick={() => onGerarTermo(linha)} disabled={Boolean(ocupado)}>
              <FileCheck size={16} /> Gerar termo
            </button>
          )}
          {envelope.termo === 'gerado' && (
            <button type="button" className="btn btn-outline" onClick={() => onVerTermo(linha)}>
              <Eye size={16} /> Ver termo
            </button>
          )}
          {podeEnviar && (
            <button type="button" className="btn btn-primary" onClick={() => onRegistrarEnvio([linha])}>
              <Send size={16} /> Enviar por e-mail
            </button>
          )}
        </>
      )}
    >
      <div className="pj-folha-pilha">
        <div className="pj-folha-nav">
          <div className="pj-folha-nav-botoes">
            <button type="button" className="btn-icon" title="Primeiro" onClick={() => ir(0)} disabled={indice <= 0 || Boolean(ocupado)}><ChevronsLeft size={16} /></button>
            <button type="button" className="btn-icon" title="Anterior" onClick={() => ir(indice - 1)} disabled={indice <= 0 || Boolean(ocupado)}><ChevronLeft size={16} /></button>
            <button type="button" className="btn-icon" title="Próximo" onClick={() => ir(indice + 1)} disabled={indice < 0 || indice >= linhas.length - 1 || Boolean(ocupado)}><ChevronRight size={16} /></button>
            <button type="button" className="btn-icon" title="Último" onClick={() => ir(linhas.length - 1)} disabled={indice < 0 || indice >= linhas.length - 1 || Boolean(ocupado)}><ChevronsRight size={16} /></button>
          </div>
          <span className="pj-sub">{indice >= 0 ? `Registro ${indice + 1} de ${linhas.length}` : 'Fora do filtro atual'}</span>
        </div>

        <div className="pj-pares pj-folha-pessoa">
          <div className="pj-par"><small>Código</small><b>{pessoa.codigo}</b></div>
          <div className="pj-par"><small>Prestador</small><b>{pessoa.nome}</b></div>
          <div className="pj-par"><small>Empresa</small><b>{pessoa.empresa || '—'}</b></div>
          <div className="pj-par"><small>Razão social</small><b>{pessoa.razaoSocial || '—'}</b></div>
          <div className="pj-par"><small>CNPJ</small><b>{pessoa.cnpj ? mascararCnpj(pessoa.cnpj) : '—'}</b></div>
          <div className="pj-par"><small>Bruto</small><b><Moeda valor={envelope.bruto} /></b></div>
          <div className="pj-par"><small>Descontos</small><b><Moeda valor={envelope.descontos} /></b></div>
          <div className="pj-par"><small>Líquido NF</small><b><Moeda valor={envelope.liquido} forte /></b></div>
          <div className="pj-par"><small>Termo · envio</small><b className="pj-folha-badges"><Badge tipo="termo" valor={envelope.termo} /><Badge tipo="envio" valor={envelope.envio} /></b></div>
          <div className="pj-par"><small>Último cálculo</small><b>{envelope.calculado_em ? dataHoraBr(envelope.calculado_em) : 'Pendente'}</b></div>
        </div>

        <FaixaProporcional envelope={envelope} prestador={prestador} competencia={competencia} config={config}
          eventos={eventos} encerramento={encerramento} />

        {envelope.conferencia === 'divergente' && aba !== 'conferencia' && (
          <Aviso tipo="erro" acao={<button type="button" className="btn btn-sm btn-outline" onClick={() => setAba('conferencia')}>Ver conferência</button>}>
            {divergenciasAbertas.length} divergência(s) em aberto neste envelope. O termo fica bloqueado até resolver.
          </Aviso>
        )}

        <Abas
          ativa={aba}
          onTrocar={setAba}
          abas={[
            { id: 'eventos', rotulo: 'Eventos' },
            { id: 'rateio', rotulo: 'Rateio' },
            { id: 'conferencia', rotulo: 'Conferência', contador: divergenciasAbertas.length },
            { id: 'log', rotulo: 'Log de cálculo' },
          ]}
        />

        {aba === 'eventos' && (
          <AbaEventos eventos={eventos} envelope={envelope} bloqueado={bloqueadoEdicao} aberta={aberta}
            onGravar={(novos, meta) => gravar(novos, { registrar: false, ...meta })} />
        )}
        {aba === 'rateio' && (
          <AbaRateio envelope={envelope} rateiosPrestador={rateiosPrestador} centrosMapa={centrosMapa} aberta={aberta} eventos={eventos} />
        )}
        {aba === 'conferencia' && (
          <AbaConferencia envelope={envelope} eventos={eventos} pessoa={pessoa} bloqueado={bloqueadoEdicao} aberta={aberta}
            onGravar={gravar} />
        )}
        {aba === 'log' && <AbaLog envelope={envelope} pessoa={pessoa} />}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Proporcionalidade
// ---------------------------------------------------------------------------

function FaixaProporcional({ envelope, prestador, competencia, config, eventos, encerramento }) {
  // Datas e prévia vêm da lib; valores gravados, do último cálculo.
  const prop = prestador ? proporcionalidade({ prestador, competencia, config, eventos, encerramento }) : null;
  const calculado = envelope.valor_base != null;
  const motivo = calculado ? envelope.proporcional_motivo : prop?.motivo;
  const aplica = motivo && motivo !== 'Competência integral';
  const base = calculado ? Number(envelope.valor_base) : prop?.valorBase;
  const dias = calculado ? envelope.dias_ativos : prop?.diasAtivos;
  const divisor = calculado ? envelope.divisor : prop?.divisor;
  const valor = aplica ? round2((Number(base) * Number(dias)) / Number(divisor || 1)) : base;

  if (!prop && !calculado) return null;
  return (
    <div className={`pj-folha-prop ${aplica ? 'aplica' : ''}`}>
      {aplica ? <Clock size={16} /> : <CheckCircle2 size={16} />}
      <b>{aplica ? `Proporcionalidade aplicada · ${motivo}` : 'Competência integral'}</b>
      <span>Início {dataBr(prop?.inicio)}</span>
      <span>Fim {prop?.fim ? dataBr(prop.fim) : '—'}</span>
      <span>Base <Moeda valor={base} /></span>
      <span>{dias}/{divisor} dias</span>
      {aplica && <span>{fmtBRL(base)} → <Moeda valor={valor} forte /></span>}
      {!calculado && <span className="pj-sub">prévia, ainda sem cálculo</span>}
      {encerramento && <Badge tipo="encerramento" valor={encerramento.status} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

function AbaEventos({ eventos, envelope, bloqueado, aberta, onGravar }) {
  const { codigos } = useFechamentoPj();
  const [editando, setEditando] = useState(null); // null | 'novo' | codigo
  const [excluindo, setExcluindo] = useState(null);
  const totais = totaisEventos(eventos);
  const historico = envelope.origem === 'historico' && !eventos.length;

  async function salvar(evento) {
    const novo = editando === 'novo';
    const lista = novo ? [...eventos, evento] : eventos.map((e) => (e.codigo === evento.codigo ? evento : e));
    const ok = await onGravar(lista, {
      acao: novo ? 'Evento incluído no envelope' : 'Evento alterado no envelope',
      detalhe: `${evento.codigo} - ${evento.descricao} • ${fmtBRL(evento.valor)}${evento.forcado ? ' • valor forçado' : ''}`,
      origem: 'Edição de evento',
      rotulo: 'Salvando evento…',
    });
    if (ok) setEditando(null);
  }

  async function excluir(codigo) {
    const ev = eventos.find((e) => e.codigo === codigo);
    const ok = await onGravar(eventos.filter((e) => e.codigo !== codigo), {
      acao: 'Evento excluído do envelope',
      detalhe: `${ev.codigo} - ${ev.descricao} • ${fmtBRL(ev.valor)}`,
      origem: 'Edição de evento',
      rotulo: 'Excluindo evento…',
    });
    if (ok) setExcluindo(null);
  }

  return (
    <div className="pj-folha-pilha">
      {!aberta && <Aviso tipo="info"><Lock size={14} /> Competência fechada: eventos somente para consulta.</Aviso>}
      {aberta && (
        <div className="pj-toolbar">
          <button type="button" className="btn btn-sm btn-outline" onClick={() => { setEditando('novo'); setExcluindo(null); }} disabled={bloqueado || Boolean(editando)}>
            <Plus size={14} /> Incluir evento
          </button>
          <span className="pj-sub">Editar não recalcula a proporcionalidade nem gera log: use Recalcular quando terminar.</span>
        </div>
      )}

      {editando && (
        <EditorEvento
          evento={editando === 'novo' ? null : eventos.find((e) => e.codigo === editando)}
          eventos={eventos}
          codigos={codigos}
          bloqueado={bloqueado}
          onCancelar={() => setEditando(null)}
          onSalvar={salvar}
        />
      )}

      {excluindo && (
        <Aviso
          tipo="alerta"
          acao={(
            <span className="pj-folha-acoes-aviso">
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setExcluindo(null)} disabled={bloqueado}>Cancelar</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => excluir(excluindo)} disabled={bloqueado}>Excluir</button>
            </span>
          )}
        >
          Excluir o evento {excluindo} deste envelope?
        </Aviso>
      )}

      {historico ? (
        <Vazio>Envelope da carga histórica: só há os totais do mês, sem eventos.</Vazio>
      ) : (
        <TableScroll>
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th className="pj-direita">Referência</th>
                <th className="pj-direita">Provento</th>
                <th className="pj-direita">Desconto</th>
                <th>Origem</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.codigo} className={editando === e.codigo ? 'pj-linha-selecionada' : ''}>
                  <td><b>{e.codigo}</b></td>
                  <td>
                    {e.descricao}
                    {e.forcado && <span className="badge pendente pj-folha-badge-inline">Forçado</span>}
                  </td>
                  <td className="pj-direita pj-num">{fmtNum(e.referencia)}</td>
                  <td className="pj-direita">{e.natureza === 'provento' ? <Moeda valor={e.valor} /> : ''}</td>
                  <td className="pj-direita">{e.natureza === 'desconto' ? <Moeda valor={e.valor} /> : ''}</td>
                  <td><span className="pj-sub">{e.origem}</span></td>
                  <td>
                    {aberta && (
                      <div className="pj-acoes-linha">
                        <button type="button" className="btn-icon" title="Editar evento" disabled={bloqueado || Boolean(editando)}
                          onClick={() => { setEditando(e.codigo); setExcluindo(null); }}><Pencil size={15} /></button>
                        <button type="button" className="btn-icon" title="Excluir evento" disabled={bloqueado || Boolean(editando)}
                          onClick={() => setExcluindo(e.codigo)}><Trash2 size={15} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!eventos.length && (
                <tr><td colSpan={7} className="table-empty">Nenhum evento no envelope.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Totais</td>
                <td className="pj-direita"><Moeda valor={totais.bruto} /></td>
                <td className="pj-direita"><Moeda valor={totais.descontos} /></td>
                <td colSpan={2}>Líquido <Moeda valor={totais.liquido} forte /></td>
              </tr>
            </tfoot>
          </table>
        </TableScroll>
      )}
    </div>
  );
}

const valorDigitado = (v) => String(v ?? '').replace('.', ',');

function EditorEvento({ evento, eventos, codigos, bloqueado, onCancelar, onSalvar }) {
  const novo = !evento;
  const disponiveis = codigos.filter((c) => c.ativo && !eventos.some((e) => e.codigo === c.codigo));
  const [codigo, setCodigo] = useState(evento?.codigo || disponiveis[0]?.codigo || '');
  const cadastro = codigos.find((c) => c.codigo === codigo);
  const [descricao, setDescricao] = useState(evento?.descricao || cadastro?.descricao || '');
  const [referencia, setReferencia] = useState(evento ? valorDigitado(evento.referencia) : '0');
  const [valor, setValor] = useState(evento ? valorDigitado(evento.valor) : '');
  const [forcado, setForcado] = useState(Boolean(evento?.forcado));
  const [erro, setErro] = useState('');
  const natureza = cadastro?.natureza || evento?.natureza;

  function trocarCodigo(c) {
    setCodigo(c);
    setDescricao(codigos.find((x) => x.codigo === c)?.descricao || '');
  }

  // paraNumero devolve 0 para texto inválido: confere o formato antes.
  const numeroValido = (s) => /^\s*(R\$)?\s*\d[\d.]*(,\d{1,2})?\s*$/.test(String(s)) || /^\s*\d+(\.\d{1,2})?\s*$/.test(String(s));

  function salvar(e) {
    e.preventDefault();
    if (!codigo || !cadastro && novo) { setErro('Escolha o código.'); return; }
    if (!descricao.trim()) { setErro('Informe a descrição.'); return; }
    if (!numeroValido(valor)) { setErro('Informe um valor maior ou igual a zero (ex.: 1.234,56).'); return; }
    if (String(referencia).trim() && !numeroValido(referencia)) { setErro('Referência inválida.'); return; }
    const v = round2(paraNumero(valor));
    const ordem = novo ? Math.max(-1, ...eventos.map((x) => Number(x.ordem) || 0)) + 1 : evento.ordem;
    setErro('');
    onSalvar({
      ...(evento || {}),
      codigo,
      descricao: maiusculo(descricao),
      natureza,
      referencia: round2(paraNumero(referencia)),
      valor: v,
      valor_original: novo ? v : (evento.valor_original ?? evento.valor),
      forcado,
      origem: novo ? 'Lançamento manual no envelope' : evento.origem,
      ordem,
    });
  }

  if (novo && !disponiveis.length) {
    return (
      <Aviso tipo="alerta" acao={<button type="button" className="btn btn-sm btn-ghost" onClick={onCancelar}>Fechar</button>}>
        Todos os códigos ativos já estão neste envelope. Cadastre um código novo em{' '}
        <Link to="/admin/fechamento-pj/configuracoes">Configurações</Link>.
      </Aviso>
    );
  }

  return (
    <form className="pj-cartao pj-folha-editor" onSubmit={salvar}>
      <div className="pj-secao-titulo">{novo ? 'Incluir evento' : `Editar evento ${evento.codigo}`}</div>
      <div className="pj-form-grid">
        <Campo rotulo="Código" obrigatorio>
          {novo ? (
            <select className="form-select" value={codigo} onChange={(e) => trocarCodigo(e.target.value)} disabled={bloqueado}>
              {disponiveis.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.descricao}</option>)}
            </select>
          ) : (
            <input className="form-input" value={codigo} readOnly />
          )}
        </Campo>
        <Campo rotulo="Descrição" obrigatorio largura="largo">
          <input className="form-input" value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={bloqueado} />
        </Campo>
        <Campo rotulo="Natureza">
          <input className="form-input" value={natureza === 'desconto' ? 'Desconto (reduz o líquido)' : 'Provento (soma ao bruto)'} readOnly />
        </Campo>
        <Campo rotulo="Referência">
          <input className="form-input" inputMode="decimal" value={referencia} onChange={(e) => setReferencia(e.target.value)} disabled={bloqueado} />
        </Campo>
        <Campo rotulo="Valor" obrigatorio dica="Usado no cálculo do envelope">
          <input className="form-input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} disabled={bloqueado} autoFocus />
        </Campo>
        {!novo && (
          <Campo rotulo="Valor original">
            <input className="form-input" value={fmtBRL(evento.valor_original ?? evento.valor)} readOnly />
          </Campo>
        )}
      </div>
      <label className="pj-check">
        <input type="checkbox" checked={forcado} onChange={(e) => setForcado(e.target.checked)} disabled={bloqueado} />
        Valor forçado (o cálculo não mexe neste valor)
      </label>
      {codigo === EVENTO_BRUTO && !forcado && (
        <p className="pj-sub">Com proporcionalidade, o 1000 volta a ser calculado a partir do valor contratual no próximo cálculo. Marque “valor forçado” para manter o valor digitado.</p>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="pj-folha-editor-botoes">
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancelar} disabled={bloqueado}>Cancelar</button>
        <button type="submit" className="btn btn-sm btn-primary" disabled={bloqueado}>Salvar evento</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Rateio
// ---------------------------------------------------------------------------

function AbaRateio({ envelope, rateiosPrestador, centrosMapa, aberta, eventos }) {
  // Mês fechado usa o rateio congelado no envelope; aberto, o do cadastro.
  const congelado = !aberta && Array.isArray(envelope.rateio);
  const itens = congelado
    ? envelope.rateio.map((r) => ({ codCt: r.codCt, codigoRm: r.codigoRm || null, percentual: Number(r.percentual) || 0 }))
    : rateiosPrestador.map((r) => ({ codCt: r.cod_ct, codigoRm: centrosMapa[r.cod_ct] || null, percentual: Number(r.percentual) || 0 }));
  const total = round2(somar(itens, 'percentual'));
  const fecha = Math.abs(total - 100) <= 0.01;
  const totais = eventos.length ? totaisEventos(eventos) : { bruto: Number(envelope.bruto), descontos: Number(envelope.descontos), liquido: Number(envelope.liquido) };
  const semRm = itens.filter((i) => !i.codigoRm).length;
  const parte = (v, pct) => round2((Number(v) * pct) / 100);

  return (
    <div className="pj-folha-pilha">
      <div className="pj-toolbar">
        <span>Rateio {congelado ? 'congelado no fechamento' : 'do cadastro do prestador'}</span>
        <span className={`badge ${itens.length && fecha ? 'aprovada' : 'reprovada'}`}>Total {fmtPct(total)}</span>
        {semRm > 0 && <span className="badge pendente">{semRm} sem código RM</span>}
        <Link className="btn btn-sm btn-ghost pj-toolbar-direita" to={`/admin/fechamento-pj/prestadores/${envelope.prestador_id}`}>
          <ExternalLink size={14} /> Ajustar no cadastro
        </Link>
      </div>
      {!itens.length ? (
        <Vazio>Prestador sem rateio cadastrado. Importe o organograma ou cadastre o rateio no prestador.</Vazio>
      ) : (
        <TableScroll>
          <table className="data-table">
            <thead>
              <tr>
                <th>COD CT</th>
                <th>Código RM</th>
                <th className="pj-direita">Percentual</th>
                <th className="pj-direita">Provento rateado</th>
                <th className="pj-direita">Desconto rateado</th>
                <th className="pj-direita">Líquido rateado</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.codCt}>
                  <td><b>{i.codCt}</b></td>
                  <td>{i.codigoRm || <span className="badge reprovada">Sem código RM</span>}</td>
                  <td className="pj-direita pj-num">{fmtPct(i.percentual)}</td>
                  <td className="pj-direita"><Moeda valor={parte(totais.bruto, i.percentual)} /></td>
                  <td className="pj-direita"><Moeda valor={parte(totais.descontos, i.percentual)} /></td>
                  <td className="pj-direita"><Moeda valor={parte(totais.liquido, i.percentual)} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className="pj-direita pj-num">{fmtPct(total)}</td>
                <td className="pj-direita"><Moeda valor={totais.bruto} /></td>
                <td className="pj-direita"><Moeda valor={totais.descontos} /></td>
                <td className="pj-direita"><Moeda valor={totais.liquido} forte /></td>
              </tr>
            </tfoot>
          </table>
        </TableScroll>
      )}
      {itens.length > 0 && !fecha && <Aviso tipo="alerta">O rateio não fecha 100%. Isso vira divergência no próximo cálculo.</Aviso>}
      {semRm > 0 && <Aviso tipo="alerta">Centro de custo sem código RM não entra no TXT do TOTVS. Cadastre o de-para em Configurações.</Aviso>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conferência
// ---------------------------------------------------------------------------

function AbaConferencia({ envelope, eventos, pessoa, bloqueado, aberta, onGravar }) {
  const { user, codigos, notificar } = useFechamentoPj();
  const [escolhas, setEscolhas] = useState({});
  const [observacoes, setObservacoes] = useState({});
  const divergencias = envelope.divergencias || [];
  const resolucoes = envelope.resolucoes || [];
  const planilha = envelope.planilha;

  async function resolver(div) {
    const opcoes = RESOLUCOES[div.tipo] || [];
    const opcao = opcoes.find((o) => o.acao === escolhas[div.chave]) || (opcoes.length === 1 ? opcoes[0] : null);
    if (!opcao) { notificar('Escolha como resolver a divergência.', 'alerta'); return; }
    const observacao = String(observacoes[div.chave] || '').trim();
    const descricao2100 = codigos.find((c) => c.codigo === EVENTO_OUTROS_DESCONTOS)?.descricao;
    const eventosAjustados = opcao.ajusta ? ajustarPorResolucao(eventos, div, opcao.acao, descricao2100) : eventos;
    const novas = [...resolucoes, {
      tipo: div.tipo, chave: div.chave, acao: opcao.acao, observacao: observacao || null,
      por: user?.id || null, porNome: user?.nome || null, em: new Date().toISOString(),
    }];
    const r = await onGravar(eventosAjustados, {
      registrar: true,
      origem: 'Recálculo após resolver divergência',
      resolucoes: novas,
      acao: 'Divergência resolvida',
      detalhe: `${pessoa.codigo} - ${pessoa.nome} • ${div.titulo} • ${opcao.rotulo}${observacao ? ` • ${observacao}` : ''}`,
      rotulo: 'Resolvendo divergência…',
    });
    if (r) {
      notificar(r.conferencia === 'ok' ? 'Divergência resolvida. Envelope liberado.' : 'Divergência resolvida; ainda há outra(s) em aberto.',
        r.conferencia === 'ok' ? 'sucesso' : 'alerta');
    }
  }

  return (
    <div className="pj-folha-pilha">
      {planilha && (
        <div className="pj-cartao">
          <div className="pj-secao-titulo">Informação recebida da planilha</div>
          <div className="pj-pares">
            <div className="pj-par"><small>Arquivo</small><b>{planilha.arquivo || '—'}{planilha.linha ? ` · linha ${planilha.linha}` : ''}</b></div>
            <div className="pj-par"><small>Bruto</small><b><Moeda valor={planilha.bruto} /></b></div>
            <div className="pj-par"><small>Total descontos</small><b><Moeda valor={planilha.descontos_total} /></b></div>
            <div className="pj-par"><small>Soma das colunas</small><b><Moeda valor={planilha.soma_colunas} /></b></div>
            <div className="pj-par"><small>Líquido</small><b><Moeda valor={planilha.liquido} /></b></div>
          </div>
        </div>
      )}

      {!envelope.calculado_em && !divergencias.length && (
        <Aviso tipo="info">Envelope ainda sem cálculo: a conferência roda no cálculo.</Aviso>
      )}
      {divergencias.length === 0 && envelope.calculado_em && (
        <Aviso tipo="sucesso">Conferência sem divergência.</Aviso>
      )}

      {divergencias.map((d) => {
        const resolucao = d.resolvida ? [...resolucoes].reverse().find((r) => r.chave === d.chave) : null;
        const opcoes = RESOLUCOES[d.tipo] || [];
        const rotuloAcao = opcoes.find((o) => o.acao === resolucao?.acao)?.rotulo || resolucao?.acao;
        return (
          <div key={d.chave} className={`pj-cartao pj-folha-div ${d.resolvida ? 'resolvida' : ''}`}>
            <div className="pj-folha-div-topo">
              {d.resolvida ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <div>
                <b>{d.titulo}</b>
                <div className="pj-sub">{TIPOS_DIVERGENCIA[d.tipo] || d.tipo}{d.codigo ? ` · evento ${d.codigo}` : ''}</div>
              </div>
              <span className={`badge ${d.resolvida ? 'aprovada' : 'reprovada'}`}>{d.resolvida ? 'Resolvida' : 'Em aberto'}</span>
            </div>
            <p className="pj-folha-div-texto">{d.detalhe}</p>
            <div className="pj-pares">
              <div className="pj-par"><small>Esperado</small><b>{d.esperado}</b></div>
              <div className="pj-par"><small>Encontrado</small><b>{d.encontrado}</b></div>
              {d.diferenca != null && <div className="pj-par"><small>Diferença</small><b>{fmtBRL(d.diferenca)}</b></div>}
            </div>
            {d.sugestao && <p className="pj-sub">Como corrigir: {d.sugestao}</p>}

            {d.resolvida && resolucao && (
              <Aviso tipo="sucesso">
                {rotuloAcao} · {resolucao.porNome || 'usuário'} em {dataHoraBr(resolucao.em)}
                {resolucao.observacao ? ` · “${resolucao.observacao}”` : ''}
              </Aviso>
            )}

            {!d.resolvida && aberta && (
              <div className="pj-folha-resolver">
                <div className="pj-folha-opcoes">
                  {opcoes.map((o) => (
                    <label key={o.acao} className="pj-check">
                      <input type="radio" name={`res-${d.chave}`} value={o.acao} disabled={bloqueado}
                        checked={escolhas[d.chave] === o.acao || (opcoes.length === 1 && !escolhas[d.chave])}
                        onChange={() => setEscolhas((s) => ({ ...s, [d.chave]: o.acao }))} />
                      {o.rotulo}
                    </label>
                  ))}
                </div>
                <Campo rotulo="Observação (opcional)">
                  <input className="form-input" value={observacoes[d.chave] || ''} disabled={bloqueado}
                    onChange={(e) => setObservacoes((s) => ({ ...s, [d.chave]: e.target.value }))} />
                </Campo>
                <div className="pj-folha-editor-botoes">
                  {d.tipo === 'rateio' && (
                    <Link className="btn btn-sm btn-ghost" to={`/admin/fechamento-pj/prestadores/${envelope.prestador_id}`}>
                      <ExternalLink size={14} /> Corrigir o rateio no cadastro
                    </Link>
                  )}
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => resolver(d)} disabled={bloqueado}>
                    <CheckCircle2 size={14} /> Aplicar e recalcular
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Log de cálculo
// ---------------------------------------------------------------------------

function AbaLog({ envelope, pessoa }) {
  const chave = `${envelope.id}|${envelope.calculado_em || ''}`;
  const [estado, setEstado] = useState({ chave: null, calculos: [], nomes: new Map(), erro: '' });
  const [selecionado, setSelecionado] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const calculos = await listarCalculos(envelope.id);
        const nomes = await nomesColaboradores(calculos.map((c) => c.calculado_por));
        if (vivo) setEstado({ chave, calculos, nomes, erro: '' });
      } catch (e) {
        if (vivo) setEstado({ chave, calculos: [], nomes: new Map(), erro: e.message });
      }
    })();
    return () => { vivo = false; };
  }, [chave, envelope.id]);

  if (estado.chave !== chave) return <Carregando texto="Carregando o log de cálculo…" />;
  if (estado.erro) return <Aviso tipo="erro">{estado.erro}</Aviso>;
  if (!estado.calculos.length) return <Vazio>Este envelope ainda não foi calculado nesta competência.</Vazio>;

  const atual = estado.calculos.find((c) => c.id === selecionado) || estado.calculos[0];

  return (
    <div className="pj-folha-log">
      <div className="pj-folha-log-lista">
        <div className="pj-secao-titulo">Execuções do envelope</div>
        {estado.calculos.map((c, i) => (
          <button key={c.id} type="button" className={`pj-folha-log-item ${c.id === atual.id ? 'ativo' : ''}`} onClick={() => setSelecionado(c.id)}>
            <b>{i === 0 ? 'Último cálculo' : `Cálculo anterior ${i}`}</b>
            <span>{dataHoraBr(c.calculado_em)}</span>
            <span className="pj-sub">{c.origem}</span>
            <Badge tipo="conferencia" valor={c.conferencia} />
          </button>
        ))}
      </div>
      <DocumentoMemoria calculo={atual} pessoa={pessoa} competencia={envelope.competencia}
        nomePor={estado.nomes.get(atual.calculado_por)} />
    </div>
  );
}

function DocumentoMemoria({ calculo, pessoa, competencia, nomePor }) {
  const memoria = calculo.memoria || {};
  const prop = memoria.proporcional;
  const eventos = memoria.eventos || [];
  const rateio = memoria.rateio || [];
  const bruto = Number(calculo.bruto) || 0;
  const descontos = Number(calculo.descontos) || 0;
  const liquido = Number(calculo.liquido) || round2(bruto - descontos);
  const anterior = calculo.bruto_anterior == null ? null : Number(calculo.bruto_anterior);
  const rateioTotal = calculo.rateio_total == null ? null : Number(calculo.rateio_total);

  let variacao = 'Primeiro cálculo do envelope nesta competência';
  if (anterior != null) {
    const dif = round2(bruto - anterior);
    const pct = anterior ? (dif / anterior) * 100 : 0;
    if (Math.abs(dif) <= 0.009) variacao = `Sem alteração no bruto (${fmtBRL(anterior)})`;
    else variacao = `${fmtBRL(anterior)} → ${fmtBRL(bruto)} · ${dif > 0 ? '↑ Aumento' : '↓ Redução'} de ${fmtBRL(Math.abs(dif))} (${fmtNum(Math.abs(pct))} %)`;
  }

  return (
    <div className="pj-folha-memoria">
      <div className="pj-folha-memoria-titulo">FOLHA DE PAGAMENTO PJ · LOG DO ENVELOPE</div>
      <div className="pj-pares">
        <div className="pj-par"><small>Prestador</small><b>{pessoa.codigo} - {pessoa.nome}</b></div>
        <div className="pj-par"><small>Empresa</small><b>{pessoa.empresa || '—'}</b></div>
        <div className="pj-par"><small>Competência</small><b>{competenciaRotulo(competencia)}</b></div>
        <div className="pj-par"><small>Data/hora</small><b>{dataHoraBr(calculo.calculado_em)}</b></div>
        <div className="pj-par"><small>Usuário</small><b>{nomePor || '—'}</b></div>
        <div className="pj-par"><small>Origem</small><b>{calculo.origem}</b></div>
      </div>
      <p className="pj-folha-memoria-variacao">{variacao}</p>

      <div className="pj-secao-titulo">1ª fase · cálculo dos eventos</div>
      {prop && (
        <p className="pj-sub">
          {prop.aplica
            ? `Proporcionalidade por ${String(prop.motivo).toLowerCase()}: ${fmtBRL(prop.valorBase)} ÷ ${prop.divisor} dias × ${prop.diasAtivos} dias = ${fmtBRL(prop.valorCalculado)}`
            : `Competência integral: base ${fmtBRL(prop.valorBase)} (${prop.diasAtivos}/${prop.divisor} dias)`}
        </p>
      )}
      <TableScroll>
        <table className="data-table pj-folha-memoria-tabela">
          <thead>
            <tr><th>Código</th><th>Descrição</th><th>Regra</th><th>Fórmula</th><th className="pj-direita">Valor</th></tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={`${e.codigo}-${e.prioridade}`}>
                <td><b>{e.codigo}</b><div className="pj-sub">prioridade {e.prioridade}</div></td>
                <td>{e.descricao}<div className="pj-sub">{e.natureza}{e.origem ? ` · ${e.origem}` : ''}</div></td>
                <td>{e.regra}</td>
                <td><code className="pj-folha-formula">{e.formula}</code></td>
                <td className="pj-direita"><Moeda valor={e.valor} /></td>
              </tr>
            ))}
            {!eventos.length && <tr><td colSpan={5} className="table-empty">Sem eventos na memória.</td></tr>}
          </tbody>
        </table>
      </TableScroll>

      <div className="pj-secao-titulo">2ª fase · rateio e conferência</div>
      <ul className="pj-folha-lista pj-folha-lista--ok">
        <li>Proventos: {fmtBRL(bruto)}</li>
        <li>Descontos: {fmtBRL(descontos)}</li>
        <li>Líquido: {fmtBRL(liquido)}</li>
        <li className={rateioTotal != null && Math.abs(rateioTotal - 100) > 0.01 ? 'falta' : ''}>
          Rateio: {rateioTotal == null ? 'sem rateio cadastrado' : fmtPct(rateioTotal)}
        </li>
      </ul>
      {rateio.length > 0 && (
        <TableScroll>
          <table className="data-table pj-folha-memoria-tabela">
            <thead><tr><th>COD CT</th><th>Código RM</th><th className="pj-direita">%</th><th className="pj-direita">Valor rateado</th></tr></thead>
            <tbody>
              {rateio.map((r) => (
                <tr key={r.codCt}>
                  <td>{r.codCt}</td>
                  <td>{r.codigoRm || <span className="badge reprovada">Sem código RM</span>}</td>
                  <td className="pj-direita pj-num">{fmtPct(r.percentual)}</td>
                  <td className="pj-direita"><Moeda valor={round2((liquido * Number(r.percentual)) / 100)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}

      <div className="pj-secao-titulo">Resultado final do envelope</div>
      <div className="pj-pares">
        <div className="pj-par"><small>Proventos</small><b><Moeda valor={bruto} /></b></div>
        <div className="pj-par"><small>Descontos</small><b><Moeda valor={descontos} /></b></div>
        <div className="pj-par"><small>Líquido NF</small><b><Moeda valor={liquido} forte /></b></div>
      </div>
      {calculo.conferencia === 'ok'
        ? <Aviso tipo="sucesso">Envelope sem divergência: liberado para o termo.</Aviso>
        : <Aviso tipo="erro">Envelope com divergência: termo bloqueado até resolver.</Aviso>}
    </div>
  );
}
