import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, Loader2, Pencil, Target, Trash2, Trophy } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  ELEGIBILIDADE_LABEL, STATUS_ALAVANCA, STATUS_ALAVANCA_LABEL,
  ehAdminProgramas, ehComercial,
} from '../../../../config/programas';
import { COR_BARRA } from '../../lib/paleta';
import { ConfirmarExclusao, DetalheIndicacao } from '../components/Detalhe';
import { listarIndicacoes, atualizarIndicacao, excluirIndicacao } from '../../lib/alavanca';
import { resumoAlavanca } from '../../lib/indicadores';

/**
 * Painel da Alavanca — "**Apenas para o time comercial" (planilha).
 *
 * Reúne o funil, o que ficou fora dele, a premiação, o mapa geral e o mapa de
 * vencedores. A tabela é só leitura: avaliar uma indicação (status, comentário
 * e valores) abre o diálogo em AvaliarIndicacao.jsx, que grava as três coisas
 * de uma vez e manda um e-mail só para quem indicou.
 *
 * Mesma gramática do Painel da Inovação: contagem em cards compactos, número
 * escrito sempre que houver cor, e as tabelas longas rolando por dentro. Os
 * dois painéis são lidos pela mesma gente na mesma semana — divergir no formato
 * obriga a reaprender a tela.
 */

const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const dinheiro = (n) => (n == null
  ? '—'
  : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

/**
 * Valor abreviado para os três números do card de premiação: "R$ 1,2M" no lugar
 * de "R$ 1.200.000,00".
 *
 * Eles ficam lado a lado em fonte grande, e por extenso um contrato de sete
 * dígitos ou quebrava a linha ou espremia as três colunas da grade. O valor
 * exato não se perde: fica no `title` de cada um, e o mapa de vencedores — que
 * é onde alguém confere pagamento — continua mostrando tudo, centavo a centavo.
 *
 * Só para totais. Na coluna da tabela o prêmio sai inteiro: lá o número é de
 * UMA indicação, e "R$ 4,9K" no lugar de "R$ 4.850,00" seria esconder o que a
 * pessoa vai receber.
 */
const dinheiroCurto = (n) => {
  const v = Number(n || 0);
  // Abaixo de mil não há o que encurtar, e "R$ 0,9K" esconderia os centavos de
  // um valor que cabia inteiro.
  if (Math.abs(v) < 1_000) return dinheiro(v);

  // A unidade sai do valor JÁ ARREDONDADO, e não do cru: 999.999 arredonda para
  // 1.000 mil, que impresso vira "R$ 1.000K" — um milhão escrito da forma mais
  // confusa possível.
  const emMil = v / 1_000;
  const [valor, sufixo] = Math.abs(Math.round(emMil * 10) / 10) >= 1_000
    ? [v / 1_000_000, 'M']
    : [emMil, 'K'];
  return `R$ ${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${sufixo}`;
};

export default function PainelAlavanca() {
  const { user, modules } = useAuth();
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  // "Salvando" é do popup, que tem o botão: o spinner precisa ficar no lugar em
  // que o clique aconteceu, e não numa linha da tabela atrás dele.
  // Uma indicação aberta e a aba em que ela abriu: o popup é o mesmo para ler e
  // para avaliar, e o lápis da linha só escolhe por onde entrar.
  const [detalhe, setDetalhe] = useState(null);
  const [abaDetalhe, setAbaDetalhe] = useState('detalhes');
  const [excluindo, setExcluindo] = useState('');
  const [confirmando, setConfirmando] = useState(null);   // indicação na fila de exclusão
  const [fStatus, setFStatus] = useState('');
  const [fElegib, setFElegib] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setLinhas(await listarIndicacoes());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Os filtros valem para os cards, os gráficos e as duas tabelas ao mesmo
  // tempo: filtro que muda a tabela mas não o card faz os dois se contradizerem.
  const filtradas = useMemo(() => linhas.filter(
    (i) => (!fStatus || i.status === fStatus) && (!fElegib || i.elegibilidade === fElegib)
  ), [linhas, fStatus, fElegib]);

  const r = useMemo(() => resumoAlavanca(filtradas), [filtradas]);
  const filtrando = Boolean(fStatus || fElegib);
  const souAdmin = ehAdminProgramas(modules);
  // Só apresentação: o pé de cada etapa do funil. São as mesmas frases que os
  // quatro tiles carregavam antes de serem absorvidos pelo funil.
  const recebidas = r.funil[0].total;
  const notaEtapa = [
    null,
    // Atenção só aqui: é a única nota que cobra uma decisão de quem está lendo.
    r.emAnalise > 0 ? { texto: `+ ${r.emAnalise} dependendo da sua confirmação`, alerta: true } : null,
    null,
    // Também abreviado: é um total, e o pé da etapa é uma linha estreita.
    r.premioTotal > 0 ? { texto: `${dinheiroCurto(r.premioTotal)} em premiação` } : null,
  ];

  // Gate de UI. Quem não é do comercial não perde nada: a RLS já esconderia as
  // indicações alheias, e a tela sem dados seria mais confusa que a Alavanca.
  if (!ehComercial(modules)) return <Navigate to="/programas/alavanca" replace />;

  // Deixa a exceção SUBIR: quem chama é o popup, e é lá que o erro precisa
  // aparecer — junto do formulário que o causou e com o popup ainda aberto.
  // Engolir aqui e devolver `false` mandava a mensagem para o topo do painel,
  // atrás do popup, onde ninguém a via.
  const aplicar = async (indicacao, mudancas) => {
    const nova = await atualizarIndicacao(indicacao, mudancas, user.id);
    setLinhas((atual) => atual.map((l) => (l.id === indicacao.id ? nova : l)));
  };

  const abrir = (indicacao, aba = 'detalhes') => {
    setAbaDetalhe(aba);
    setDetalhe(indicacao);
  };

  // Excluir sai na própria linha, e só para o admin do módulo — é a regra da
  // RLS (programas_alavanca_delete): o comercial trabalha a indicação, mas
  // apagar uma indicação de terceiro, inclusive concluída, é do admin.
  const apagar = async (indicacao) => {
    setExcluindo(indicacao.id);
    setErro('');
    try {
      await excluirIndicacao(indicacao.id);
      setLinhas((atual) => atual.filter((l) => l.id !== indicacao.id));
      setConfirmando(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setExcluindo('');
    }
  };

  return (
    <div className="pg-page pg-page-full">
      <h1 className="pg-title"><Target size={24} /> Painel da Alavanca</h1>
      <p className="pg-sub">Indicações recebidas de toda a empresa, elegibilidade e premiação.</p>

      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div>
      ) : (
        <>
          <div className="pg-filtros">
            <div className="pg-filtro">
              <label htmlFor="f-status">Status</label>
              <select id="f-status" className="pg-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="">Todos</option>
                {STATUS_ALAVANCA.map((x) => <option key={x.valor} value={x.valor}>{x.label}</option>)}
              </select>
            </div>
            <div className="pg-filtro">
              <label htmlFor="f-elegib">Elegibilidade</label>
              <select id="f-elegib" className="pg-select" value={fElegib} onChange={(e) => setFElegib(e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(ELEGIBILIDADE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            {filtrando && (
              <button
                type="button" className="pg-btn pg-btn-ghost pg-filtro-limpa"
                onClick={() => { setFStatus(''); setFElegib(''); }}
              >
                Limpar filtros
              </button>
            )}

            {/* De quanto saiu o recorte, no canto — mesma linha discreta do
                Painel da Inovação. Antes isso morava no pé de um tile gigante. */}
            <p className="pg-resumo">
              <strong>{r.total}</strong> indicação(ões)
              {filtrando && <span> · de {linhas.length} recebidas no total</span>}
            </p>
          </div>

          {/* A fila de trabalho vem antes de tudo: "depende do comercial" é a
              única situação que não anda sozinha. */}
          {r.emAnalise > 0 && (
            <div className="pg-aviso tom-atencao">
              <AlertCircle size={16} />
              <span>
                <strong>{r.emAnalise}</strong> indicação(ões) caíram em empresa já cadastrada com
                contato novo. Pelas regras, valem se a oportunidade ainda não tiver sido mapeada —
                abra cada uma e decida a elegibilidade na aba <strong>Avaliação</strong>.
              </span>
            </div>
          )}

          {/* ---- funil ----
              Os quatro tiles do topo diziam recebidas / elegíveis / evoluíram /
              concluídas, e o gráfico logo abaixo repetia os mesmos quatro
              números em barras. Viraram um bloco só: a etapa carrega o número,
              a retenção e o pé que era do tile. */}
          <div className="pg-card">
            <h2 className="pg-card-tit">Funil das indicações</h2>
            <p className="pg-campo-dica">
              Cada etapa é um subconjunto da anterior — a porcentagem é sobre as recebidas.
            </p>
            <ol className="pg-funil" aria-label="Funil das indicações">
              {r.funil.map((e, i) => {
                const pct = recebidas ? Math.round((e.total / recebidas) * 100) : 0;
                return (
                  <li className="pg-funil-etapa" key={e.nome}>
                    <span className="pg-funil-rot">{e.nome}</span>
                    <strong className="pg-funil-num">{e.total}</strong>
                    <span className="pg-funil-medida" aria-hidden="true">
                      <i style={{ width: `${pct}%`, background: COR_BARRA }} />
                    </span>
                    <span className="pg-funil-pe">
                      {i === 0 ? 'recebidas no recorte atual' : `${pct}% das recebidas`}
                    </span>
                    {notaEtapa[i] && (
                      <span className={`pg-funil-nota ${notaEtapa[i].alerta ? 'tom-atencao' : ''}`}>
                        {notaEtapa[i].texto}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="pg-graficos">
            {/* Fora do funil, em card e não mais numa linha de rodapé do funil.
                As encerradas viraram a maior fatia da base (a maioria das
                indicações não vira contrato — é o normal do programa), e uma
                frase em cinza embaixo do gráfico escondia isso. Card também
                separa as três saídas, que têm donos diferentes: encerrada é
                decisão do comercial, não elegível é a checagem contra a base,
                pendente é trabalho que ninguém fez ainda. */}
            <div className="pg-card">
              <h2 className="pg-card-tit">Fora do funil</h2>
              <p className="pg-campo-dica">
                Indicações que não seguem para contrato — por isso não aparecem nas etapas acima.
                Cada uma conta num motivo só.
              </p>
              <dl className="pg-valores">
                <div>
                  <dt>Encerradas pelo comercial</dt>
                  <dd>{r.encerradas}</dd>
                </div>
                <div>
                  <dt>Barradas por não elegibilidade</dt>
                  <dd>{r.naoElegiveis}</dd>
                </div>
                <div>
                  <dt>Sem verificação automática</dt>
                  <dd className={r.pendentes > 0 ? 'tom-atencao' : ''}>{r.pendentes}</dd>
                </div>
              </dl>
            </div>

            <div className="pg-card">
              <h2 className="pg-card-tit">Premiação</h2>
              <p className="pg-campo-dica">0,5% do contrato, teto de R$ 10.000 por indicação.</p>
              {/* `title` com o valor cheio em cada um: o número curto é para
                  ler de longe, o exato para quem precisa conferir. */}
              <dl className="pg-valores">
                <div>
                  <dt>Contratos fechados pelo programa</dt>
                  <dd title={dinheiro(r.contratoTotal)}>{dinheiroCurto(r.contratoTotal)}</dd>
                </div>
                <div>
                  <dt>Premiação já paga</dt>
                  <dd className="tom-alta" title={dinheiro(r.premioPago)}>
                    {dinheiroCurto(r.premioPago)}
                  </dd>
                </div>
                <div>
                  <dt>A pagar</dt>
                  <dd
                    className={r.premioAPagar > 0 ? 'tom-atencao' : ''}
                    title={dinheiro(r.premioAPagar)}
                  >
                    {dinheiroCurto(r.premioAPagar)}
                  </dd>
                </div>
              </dl>
            </div>

          </div>

          <div className="pg-card">
            <h2 className="pg-card-tit">Mapa de indicações</h2>
            <p className="pg-campo-dica">
              Status, comentário e premiação se editam juntos no lápis de cada linha. Ao salvar,
              quem indicou recebe um e-mail com o status e o comentário.
            </p>

            {filtradas.length === 0 ? (
              <p className="pg-campo-dica">Nenhuma indicação recebida ainda.</p>
            ) : (
              /* O mapa cresce com o programa: rola por dentro e prende o
                 cabeçalho, como o mapa do Painel da Inovação. */
              <div className="pg-tabela-scroll is-alta">
                <table className="pg-tabela">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Oportunidade</th>
                      <th>Empresa / contato</th>
                      <th>Indicado por</th>
                      <th>Elegibilidade</th>
                      <th>Status</th>
                      <th>Comentário</th>
                      <th>Premiação</th>
                      <th className="col-acoes">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((i) => (
                      /* A linha inteira abre a indicação: o alvo de clique era
                         só o nome, e errar por uma célula não fazia nada. O
                         botão do nome CONTINUA existindo — é por ele que se
                         chega aqui pelo teclado, coisa que <tr onClick> não
                         resolve. */
                      <tr key={i.id} className="is-clicavel" onClick={() => abrir(i)}>
                        <td className="num">#{i.numero}</td>
                        <td>
                          <button type="button" className="pg-link" onClick={() => abrir(i)}>
                            {i.oportunidade}
                          </button>
                          <span className="pg-motivo">{i.descricao}</span>
                        </td>
                        <td>
                          {i.empresa}
                          <span className="pg-motivo">
                            {i.contato_nome} — {i.contato_cargo}<br />
                            {i.contato_telefone} · {i.contato_email}
                          </span>
                        </td>
                        <td>
                          {i.indicadorNome || '—'}
                          <span className="pg-motivo">{data(i.criado_em)}</span>
                        </td>
                        <td>
                          <span className={`pg-badge tom-${i.elegibilidade}`}>
                            {ELEGIBILIDADE_LABEL[i.elegibilidade] || i.elegibilidade}
                          </span>
                          {i.elegibilidade_motivo && <span className="pg-motivo">{i.elegibilidade_motivo}</span>}
                        </td>
                        {/* Status, comentário e premiação são LEITURA na tabela:
                            os três se editam juntos no diálogo, que é o que
                            dispara um e-mail só para quem indicou. */}
                        <td>
                          <span className={`pg-badge tom-${i.status}`}>
                            {STATUS_ALAVANCA_LABEL[i.status] || i.status}
                          </span>
                        </td>
                        <td className="col-coment">
                          <span className={`pg-cel-texto ${i.comentario ? '' : 'is-vazio'}`}>
                            {i.comentario || '—'}
                          </span>
                        </td>
                        <td className="num">
                          {dinheiro(i.valor_premio)}
                          {i.valor_contrato != null && (
                            <span className="pg-motivo">Contrato: {dinheiro(i.valor_contrato)}</span>
                          )}
                        </td>
                        {/* stopPropagation em cada ação: sem isso o clique
                            subiria para a linha e o popup abriria por baixo da
                            confirmação de exclusão. */}
                        <td className="col-acoes">
                          {/* Avaliar é a ação da linha, e vale para todo o
                              comercial. Excluir continua só do admin — é a regra
                              da RLS, não uma escolha da tela. */}
                          <button
                            type="button"
                            className="pg-icone-acao"
                            onClick={(e) => { e.stopPropagation(); abrir(i, 'avaliacao'); }}
                            title="Avaliar indicação"
                            aria-label={`Avaliar ${i.oportunidade}`}
                          >
                            <Pencil size={16} />
                          </button>
                          {souAdmin && (
                            <button
                              type="button"
                              className="pg-icone-acao is-perigo"
                              onClick={(e) => { e.stopPropagation(); setConfirmando(i); }}
                              title="Excluir indicação"
                              aria-label={`Excluir ${i.oportunidade}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pg-card">
            <h2 className="pg-card-tit"><Trophy size={13} style={{ verticalAlign: -2 }} /> Mapa de vencedores</h2>
            {r.vencedores.length === 0 ? (
              <p className="pg-campo-dica">
                Nenhuma indicação concluída ainda. Ao concluir uma, quem indicou entra aqui com o
                valor e a data de pagamento.
              </p>
            ) : (
              <div className="pg-tabela-scroll">
                <table className="pg-tabela">
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Empresa</th>
                      <th>Oportunidade</th>
                      <th>Valor do contrato</th>
                      <th>Premiação</th>
                      <th>Data de pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.vencedores.map((i) => (
                      <tr key={i.id}>
                        <td>{i.indicadorNome || '—'}</td>
                        <td>{i.empresa}</td>
                        <td>{i.oportunidade}</td>
                        <td className="num">{dinheiro(i.valor_contrato)}</td>
                        <td className="num"><strong>{dinheiro(i.valor_premio)}</strong></td>
                        {/* Sem data de pagamento é pendência, não "—": a regra
                            manda pagar após o faturamento da 1ª medição. */}
                        <td className="num">{i.pago_em ? data(i.pago_em) : 'A pagar'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {confirmando && (
        <ConfirmarExclusao
          alvo={`#${confirmando.numero} — ${confirmando.oportunidade}`}
          excluindo={excluindo === confirmando.id}
          onCancelar={() => setConfirmando(null)}
          onConfirmar={() => apagar(confirmando)}
        />
      )}

      {/* `key` por indicação E por aba de entrada: o popup guarda a aba num
          estado seu, e sem remontar a segunda indicação abriria na aba em que a
          primeira foi deixada — clicar no nome cairia direto no formulário. */}
      {detalhe && (
        <DetalheIndicacao
          key={`${detalhe.id}-${abaDetalhe}`}
          indicacao={detalhe}
          abaInicial={abaDetalhe}
          onFechar={() => setDetalhe(null)}
          onAvaliar={(indicacao, valores) => aplicar(indicacao, {
            status: valores.status,
            elegibilidade: valores.elegibilidade,
            elegibilidade_motivo: valores.motivo,
            comentario: valores.comentario,
            valor_contrato: valores.valorContrato,
            // Sem recalcular por cima: o formulário já aplicou a regra dos 0,5%
            // e o que chega aqui é a decisão do comercial. Recalcular fazia um
            // prêmio apagado de propósito voltar sozinho no salvamento.
            valor_premio: valores.valorPremio,
            pago_em: valores.pagoEm,
          })}
        />
      )}
    </div>
  );
}
