import { useEffect, useState } from 'react';
import {
  Timer, X, Loader2, ListChecks, CalendarClock, UserCheck,
} from 'lucide-react';
import { CLASSES_ADM, getClasse, getServico } from '../../../../config/administrativo';
import { listarConfigs } from '../../lib/chamados';
import { Abas } from './ui';
import { useFocoDialogo } from './useFocoDialogo';

// Só para o filtro da lista: "manutencao" acha "Manutenção".
const normalizar = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Abas, e não um texto corrido: a resposta para "quanto tempo demora o meu
// pedido?" ficava três telas abaixo, depois de todas as regras. Por isso a lista
// de prazos é a aba que abre.
const ABAS = [
  { valor: 'servicos', rotulo: 'Por serviço', Icon: ListChecks },
  { valor: 'regras', rotulo: 'Como conta', Icon: CalendarClock },
  { valor: 'aprovacao', rotulo: 'Quem aprova', Icon: UserCheck },
];

/**
 * Ajuda de PRAZOS e APROVAÇÃO — as duas perguntas que o solicitante faz sobre
 * o próprio pedido: "quem precisa liberar" e "quanto tempo demora".
 *
 * Separada do guia geral de propósito: o guia é um passo a passo de "o que dá
 * para fazer aqui", e isto é consulta — a pessoa abre para tirar uma dúvida
 * pontual e fechar. Empilhar como mais um passo do tour esconderia justamente
 * quem precisa da informação.
 *
 * Os prazos NÃO são escritos aqui: vêm da configuração de cada serviço. Texto
 * fixo viraria mentira no dia em que o Adm mudasse um prazo na tela de
 * configuração — e ninguém lembraria de vir corrigir este arquivo. Já as faixas
 * de alçada estão em texto porque são decisão de diretoria, não cadastro; se
 * mudarem, muda aqui e em config/alcadas.js.
 */
export default function AjudaPrazos() {
  const [aberto, setAberto] = useState(false);
  const [configs, setConfigs] = useState(null);   // null = ainda carregando
  const [aba, setAba] = useState('servicos');
  const [filtro, setFiltro] = useState('');

  const fechar = () => setAberto(false);
  const refModal = useFocoDialogo(aberto, fechar, '.adm-tab.is-active');

  // Só busca quando abre: quem nunca clica não paga a consulta.
  useEffect(() => {
    if (!aberto || configs) return;
    listarConfigs()
      .then(setConfigs)
      .catch(() => setConfigs([]));
  }, [aberto, configs]);

  const comPrazo = (configs || [])
    .filter((c) => c.sla_dias_uteis > 0)
    .map((c) => ({
      ...c,
      classeLabel: getClasse(c.classe)?.label || c.classe,
      servicoLabel: getServico(c.classe, c.servico)?.label || c.servico,
    }))
    .sort((a, b) => a.sla_dias_uteis - b.sla_dias_uteis
      || a.classeLabel.localeCompare(b.classeLabel, 'pt-BR'));

  const termo = normalizar(filtro);
  const visiveis = termo
    ? comPrazo.filter((c) => normalizar(`${c.servicoLabel} ${c.classeLabel}`).includes(termo))
    : comPrazo;

  const totalServicos = CLASSES_ADM.reduce((n, c) => n + c.servicos.length, 0);

  return (
    <>
      <button
        type="button"
        className="portal-header-help"
        onClick={() => setAberto(true)}
        aria-label="Entender os prazos e as regras de aprovação"
        title="Prazos e aprovações"
      >
        <Timer size={20} aria-hidden="true" />
      </button>

      {aberto && (
        <div className="guia-overlay" onClick={fechar}>
          <div
            ref={refModal}
            className="guia-modal adm-prazos-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="adm-prazos-tit"
          >
            <div className="guia-head">
              <span className="guia-eyebrow" id="adm-prazos-tit">Prazos e aprovações</span>
              <button type="button" className="guia-close" onClick={fechar} aria-label="Fechar">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="adm-prazos-abas">
              <Abas itens={ABAS} valor={aba} onChange={setAba} rotulo="Assunto da ajuda" />
            </div>

            <div className="adm-prazos-corpo" role="tabpanel" aria-label={ABAS.find((a) => a.valor === aba).rotulo}>
              {aba === 'servicos' && (
                <>
                  <p className="adm-prazos-resumo">
                    Os prazos contam em dias úteis e só começam depois que a aprovação sai.
                  </p>
                  {configs === null ? (
                    <p className="adm-prazos-vazio" role="status"><Loader2 size={15} className="adm-spin" aria-hidden="true" /> Carregando…</p>
                  ) : comPrazo.length === 0 ? (
                    <p className="adm-prazos-vazio">
                      Nenhum serviço tem prazo definido ainda. Enquanto isso, os chamados são
                      atendidos sem data de vencimento — acompanhe por “Meus chamados”.
                    </p>
                  ) : (
                    <>
                      <input
                        type="search"
                        className="adm-input adm-prazos-filtro"
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                        placeholder="Filtrar serviço"
                        aria-label="Filtrar serviço"
                      />
                      {visiveis.length === 0 ? (
                        <p className="adm-prazos-vazio" role="status">Nenhum serviço com prazo para “{filtro.trim()}”.</p>
                      ) : (
                        <div className="adm-tabela-scroll">
                          <table className="adm-tabela adm-prazos-lista">
                            <thead>
                              <tr><th>Serviço</th><th>Prazo</th></tr>
                            </thead>
                            <tbody>
                              {visiveis.map((c) => (
                                <tr key={`${c.classe}/${c.servico}`}>
                                  {/* A classe embaixo do nome, e não em coluna: em
                                      três colunas o celular espremia as duas. */}
                                  <td>
                                    <span className="adm-prazos-servico">{c.servicoLabel}</span>
                                    <small>{c.classeLabel}</small>
                                  </td>
                                  <td className="num">
                                    {c.sla_dias_uteis} {c.sla_dias_uteis === 1 ? 'dia útil' : 'dias úteis'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {/* Dizer quantos faltam evita a leitura de que a lista é o catálogo
                          inteiro e que os ausentes têm prazo zero. */}
                      {!termo && comPrazo.length < totalServicos && (
                        <p className="adm-prazos-vazio">
                          Os outros {totalServicos - comPrazo.length} serviços ainda não têm prazo
                          definido e são atendidos sem data de vencimento.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}

              {aba === 'regras' && (
                <>
                  <dl className="adm-prazos-regras">
                    <div>
                      <dt>Conta em dias úteis</dt>
                      <dd>
                        Sábado e domingo não contam. Um chamado de 2 dias aberto na sexta
                        vence na terça, não no domingo.
                      </dd>
                    </div>
                    <div>
                      <dt>Quando o relógio começa</dt>
                      <dd>
                        Só depois que a aprovação sai. O tempo que o pedido passa esperando
                        decisão não conta contra o time do Atendimento — por isso o chamado
                        fica sem data de vencimento enquanto está em aprovação.
                      </dd>
                    </div>
                    <div>
                      <dt>O prazo não pausa</dt>
                      <dd>
                        Depois de iniciado, ele corre até o fechamento. Responder uma dúvida
                        ou aguardar informação sua não congela o relógio.
                      </dd>
                    </div>
                    <div>
                      <dt>Cada serviço tem o seu</dt>
                      <dd>
                        O prazo é definido por serviço pelo time do Atendimento, não é
                        igual para todos. A aba “Por serviço” mostra os que já estão definidos.
                      </dd>
                    </div>
                    <div>
                      <dt>Feriados não são considerados</dt>
                      <dd>
                        O portal ainda não tem calendário de feriados, então um prazo que
                        atravesse um feriado fica mais curto do que deveria. É uma limitação
                        conhecida — se te afetar, avise no chamado.
                      </dd>
                    </div>
                  </dl>

                  <h4>As cores do prazo</h4>
                  <ul className="adm-prazos-cores">
                    <li><i className="tom-ok" /> No prazo — falta mais de um dia</li>
                    <li><i className="tom-perto" /> Vence em menos de 24 horas</li>
                    <li><i className="tom-vencido" /> Prazo estourado</li>
                    <li><i className="tom-sem" /> Sem prazo — aguardando aprovação ou serviço sem prazo definido</li>
                  </ul>
                </>
              )}

              {aba === 'aprovacao' && (
                <dl className="adm-prazos-regras">
                  <div>
                    <dt>Todo pedido passa por aprovação</dt>
                    <dd>
                      Nenhum serviço do catálogo vai direto para a fila. O pedido segue primeiro
                      para o seu líder imediato, lido do organograma, e depois pela cadeia
                      cadastrada no Gestão de Pessoas, quando você tiver uma. Ninguém aprova o
                      mesmo chamado duas vezes: quem aparece nos dois lugares entra uma vez só.
                    </dd>
                  </div>
                  <div>
                    <dt>Pedido com valor sobe mais</dt>
                    <dd>
                      Solicitação de compra, recarga Ticket Log e locação de imóvel são
                      enquadrados pelo valor informado:
                    </dd>
                    <dd>
                      <table className="adm-tabela adm-prazos-faixas">
                        <tbody>
                          <tr><td>até R$ 5.000</td><td>líder imediato</td></tr>
                          <tr><td>R$ 5.000 a R$ 20.000</td><td>Diretoria + Financeiro (aprovação dupla)</td></tr>
                          <tr><td>acima de R$ 20.000</td><td>Diretoria + Financeiro + CEO</td></tr>
                        </tbody>
                      </table>
                    </dd>
                    <dd>
                      Os limites são inclusivos: R$ 5.000 e R$ 20.000 exatos ficam sempre na
                      faixa de baixo.
                    </dd>
                  </div>
                  <div>
                    <dt>Sem o valor, o pedido não abre</dt>
                    <dd>
                      Nesses três serviços o campo de valor é obrigatório. Deixá-lo em branco
                      faria o pedido cair na faixa mais branda por omissão, que é justamente o
                      que a regra existe para evitar.
                    </dd>
                  </div>
                  <div>
                    <dt>Um de cada vez</dt>
                    <dd>
                      O aviso por e-mail vai só para quem tem a vez. O próximo da cadeia só é
                      acionado depois que o anterior decide. Reprovar exige escrever o motivo,
                      e o pedido volta para você.
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            <div className="guia-footer">
              <button type="button" className="guia-skip" onClick={fechar}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
