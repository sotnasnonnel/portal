import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, AlertCircle, Info, ArrowRight, Plus, RotateCcw } from 'lucide-react';
import ListaAtrasados from '../components/ListaAtrasados';
import FiltroArea from '../components/FiltroArea';
import { CabecalhoPagina, Carregando, Vazio } from '../components/ui';
import { useAuth } from '../../../../contexts/AuthContext';
import { listarParaIndicadores } from '../../lib/chamados';
// Dependência de mão única, como no detalhe do chamado: o Atendimento lê da
// Mobilização, e a Mobilização não conhece o Atendimento.
import { listarProcessos } from '../../../mobilizacao/lib/mobilizacao';
import { tempoMedioDias } from '../../../mobilizacao/lib/tempoProcesso';
import { resumoIndicadores, filtrarPorArea } from '../../lib/indicadores';
import { STATUS_LABEL } from '../../lib/statusChamado';

const pct = (n) => (n === null ? '—' : `${n}%`);

// Abaixo disto a média é de um punhado de casos: a linha avisa em vez de deixar
// o número passar por tendência. Mesma régua da Satisfação.
const POUCOS_MEDIDOS = 3;

const peDoTempo = ({ total }) => {
  if (!total) return 'nenhum processo concluído ainda';
  return total === 1 ? 'tempo médio, em 1 processo concluído' : `tempo médio, em ${total} processos concluídos`;
};

/** Barras horizontais de uma série só, cada linha com o número ao lado. */
// Cancelado também encerra: sem ele, "2 atendidos e 1 reprovado" embaixo de um
// total 4 parecia conta errada.
const resumoEncerrados = ({ encerrados, atendidos, reprovados }) => {
  if (!encerrados) return 'nenhum ainda';
  if (atendidos === encerrados) return 'todos atendidos';
  return [
    [atendidos, 'atendido'], [reprovados, 'reprovado'], [encerrados - atendidos - reprovados, 'cancelado'],
  ].filter(([n]) => n > 0).map(([n, nome]) => `${n} ${nome}${n > 1 ? 's' : ''}`).join(' · ');
};

function Barras({ itens, rotulo }) {
  const maior = Math.max(1, ...itens.map((i) => i.total));
  return (
    // Lista de verdade, lida pelo leitor de tela: antes o bloco era oculto
    // contando com a tabela do fim, mas ela agrupa por serviço e não repete
    // estes números. Só o desenho da barra fica oculto, por ser redundante.
    <ul className="adm-ind-barras">
      {itens.map((i) => {
        const nome = rotulo ? rotulo(i.nome) : i.nome;
        return (
          <li key={i.nome} className="adm-ind-linha" title={`${nome}: ${i.total}`}>
            <span className="adm-ind-nome">{nome}</span>
            <span className="adm-ind-trilho" aria-hidden="true">
              <span className="adm-ind-barra" style={{ width: `${(i.total / maior) * 100}%` }} />
            </span>
            <span className="adm-ind-valor">{i.total}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function DashboardAdm() {
  const { modules } = useAuth();
  const [chamados, setChamados] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [verAtrasados, setVerAtrasados] = useState(false);
  const [area, setArea] = useState('todos');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setChamados(await listarParaIndicadores());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  // Os processos de mobilização vêm à parte e em silêncio: são um cartão a mais
  // no painel, e uma falha ao lê-los não pode derrubar o resto dos indicadores.
  // Inclui os encerrados de propósito — a média só se calcula com o que acabou.
  useEffect(() => {
    let vivo = true;
    listarProcessos({ apenasAbertos: false })
      .then((lista) => { if (vivo) setProcessos(lista); })
      .catch(() => { if (vivo) setProcessos([]); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const agora = Date.now();
  // O filtro entra ANTES do resumo: assim todo número da tela — cartões, SLA,
  // atrasados e as duas tabelas — fala da mesma área, sem conta paralela.
  const r = resumoIndicadores(filtrarPorArea(chamados, area), agora);
  const tempoPessoas = tempoMedioDias(processos.filter((p) => p.fluxo === 'mobilizacao_pessoa'));
  const tempoEmpresas = tempoMedioDias(processos.filter((p) => p.fluxo === 'mobilizacao_empresa'));
  const souDoTime = modules?.administrativo === 'admin' || modules?.administrativo === 'atendente';
  // Mobilização é trabalho do time do Adm; no recorte de TI estes dois cartões
  // não têm o que dizer, e some em vez de mostrar "—". Para quem só abre chamado
  // eles somem quando vazios: "nenhum processo concluído" ao lado de um aviso de
  // "seus números" soaria como um dado da empresa, e é só a RLS recortando.
  const mostraMobilizacao = area !== 'ti'
    && (souDoTime || tempoPessoas.total > 0 || tempoEmpresas.total > 0);
  // A fila tem filtro de área próprio: com ADM ou TI marcado aqui, o link levaria
  // a uma lista maior do que o número clicado.
  const abertosLevaAFila = souDoTime && area === 'todos' && r.abertos > 0;
  const blocoEmAberto = (
    <>
      <span className="adm-ind-rot">Em aberto</span>
      <strong className="adm-ind-num">{r.abertos}</strong>
      <span className="adm-ind-pe">
        de {r.total} {r.total === 1 ? 'chamado' : 'chamados'} no total
        {abertosLevaAFila && <span className="adm-ind-ver"> · ver na fila <ArrowRight size={12} aria-hidden="true" /></span>}
      </span>
    </>
  );

  return (
    <div className="adm-page adm-page-wide">
      <CabecalhoPagina
        Icon={BarChart3}
        titulo="Indicadores"
        subtitulo="Como está a operação do Atendimento agora, com todo o histórico de chamados."
      />

      {erro && (
        <div className="adm-aviso tom-erro" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{erro}</span>
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm adm-aviso-acao" onClick={carregar}>
            <RotateCcw size={14} aria-hidden="true" /> Tentar de novo
          </button>
        </div>
      )}

      {/* O recorte é da RLS. Sem dizer isto, quem só abre chamado leria os
          próprios números como se fossem os da empresa. */}
      {!souDoTime && (
        <div className="adm-aviso tom-info">
          <Info size={16} aria-hidden="true" />
          <span>Estes números são só dos <strong>seus</strong> chamados. A visão da empresa
            inteira é do time do Atendimento.</span>
        </div>
      )}

      <FiltroArea valor={area} onChange={setArea} />

      {/* Com erro a lista está vazia por falha, não por falta de chamado: dizer
          "nada para medir" ali seria afirmar o que não se sabe. */}
      {carregando ? (
        <Carregando />
      ) : erro ? null : r.total === 0 ? (
        <Vazio
          Icon={BarChart3}
          titulo={area === 'todos' ? 'Nenhum chamado para medir ainda' : 'Nenhum chamado desta área para medir ainda'}
          acao={!souDoTime && area === 'todos' ? (
            <Link className="adm-btn adm-btn-primary adm-btn-sm" to="/administrativo/novo">
              <Plus size={15} aria-hidden="true" /> Abrir chamado
            </Link>
          ) : null}
        >
          Os números aparecem aqui conforme os chamados são abertos e fechados.
        </Vazio>
      ) : (
        <>
          {/* Números são números: um cartão lê melhor que um gráfico de uma barra.
              Vencidos vem primeiro e pede ação: é a única linha da tela que tem
              alguém esperando agora. Os outros descrevem; este manda agir. */}
          <div className="adm-ind-tiles">
            {/* Só vira botão quando há o que abrir: um cartão clicável que
                revela lista vazia é promessa quebrada. */}
            {r.atrasados > 0 ? (
              <button
                type="button"
                className="adm-card adm-ind-tile adm-ind-tile-btn is-alerta"
                onClick={() => setVerAtrasados(true)}
                aria-haspopup="dialog"
              >
                <span className="adm-ind-rot">Vencidos agora</span>
                <strong className="adm-ind-num tom-baixa">{r.atrasados}</strong>
                <span className="adm-ind-pe adm-ind-acao">
                  passaram do prazo · ver quais <ArrowRight size={12} aria-hidden="true" />
                </span>
              </button>
            ) : (
              <div className="adm-card adm-ind-tile">
                <span className="adm-ind-rot">Vencidos agora</span>
                <strong className="adm-ind-num">0</strong>
                <span className="adm-ind-pe">nenhum aberto passou do prazo</span>
              </div>
            )}
            {abertosLevaAFila ? (
              <Link className="adm-card adm-ind-tile adm-ind-tile-link" to="/administrativo/fila">
                {blocoEmAberto}
              </Link>
            ) : (
              <div className="adm-card adm-ind-tile">{blocoEmAberto}</div>
            )}
            <div className="adm-card adm-ind-tile">
              <span className="adm-ind-rot">Fechados no prazo</span>
              <strong className={`adm-ind-num tom-${r.sla.pct === null ? 'vazio' : r.sla.pct >= 90 ? 'alta' : r.sla.pct >= 70 ? 'media' : 'baixa'}`}>
                {pct(r.sla.pct)}
              </strong>
              <span className="adm-ind-pe">
                {r.sla.medidos ? `${r.sla.noPrazo} de ${r.sla.medidos} com prazo definido` : 'nada medido ainda'}
              </span>
            </div>
            <div className="adm-card adm-ind-tile">
              <span className="adm-ind-rot">Fechados</span>
              <strong className="adm-ind-num">{r.encerrados}</strong>
              <span className="adm-ind-pe">
                {resumoEncerrados(r)}
              </span>
            </div>
          </div>

          {/* Fila e prazo lado a lado: são as duas perguntas do dia, e empilhadas
              a segunda ficava abaixo da dobra. Em largura curta o grid empilha. */}
          <div className="adm-ind-duas">
            <div className="adm-card">
              <h2 className="adm-card-tit">Chamados em aberto por tipo</h2>
              <p className="adm-campo-dica">Do maior volume para o menor — é onde a fila está.</p>
              {r.abertosPorClasse.length === 0
                ? <p className="adm-campo-dica">Nada em aberto no momento.</p>
                : <Barras itens={r.abertosPorClasse} />}
            </div>

            <div>
              <div className="adm-card">
                <h2 className="adm-card-tit">Em aberto por situação</h2>
                <p className="adm-campo-dica">Em que etapa cada chamado está parado.</p>
                {r.abertosPorStatus.length === 0
                  ? <p className="adm-campo-dica">Nada em aberto no momento.</p>
                  : <Barras itens={r.abertosPorStatus} rotulo={(s) => STATUS_LABEL[s] || s} />}
              </div>

              <div className="adm-card">
                <h2 className="adm-card-tit">Cumprimento do prazo</h2>
                {r.sla.medidos === 0 ? (
                  <p className="adm-campo-dica">
                    Nenhum chamado fechado teve prazo definido ainda, então não há o que medir.
                  </p>
                ) : (
                  <>
                    {/* Uma barra só, partida: a pergunta aqui é proporção entre duas
                        partes de um mesmo todo, não comparação entre categorias. */}
                    <div className="adm-ind-proporcao" aria-hidden="true">
                      {r.sla.noPrazo > 0 && <span className="parte tom-alta" style={{ width: `${(r.sla.noPrazo / r.sla.medidos) * 100}%` }} />}
                      {r.sla.fora > 0 && <span className="parte tom-baixa" style={{ width: `${(r.sla.fora / r.sla.medidos) * 100}%` }} />}
                    </div>
                    <p className="adm-ind-legenda">
                      <span><i className="tom-alta" /> {r.sla.noPrazo} no prazo</span>
                      <span><i className="tom-baixa" /> {r.sla.fora} fora do prazo</span>
                    </p>
                  </>
                )}
                {/* Fechado sem prazo não entra na conta: contá-lo como cumprido
                    esconderia a lacuna de configuração dentro de um número bonito. */}
                {r.sla.semPrazo > 0 && (
                  <p className="adm-campo-dica adm-ind-nota">
                    {r.sla.semPrazo === 1
                      ? '1 chamado fechado ficou de fora da conta por não ter prazo definido no serviço.'
                      : `${r.sla.semPrazo} chamados fechados ficaram de fora da conta por não terem prazo definido no serviço.`}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Tempo médio de mobilização — pedido do André em 29/09/2026. Conta
              da abertura do processo até a última etapa feita, e só entra
              processo concluído: incluir os que ainda correm baixaria a média
              com quem começou ontem. */}
          {mostraMobilizacao && (
            <div className="adm-ind-tiles">
              <div className="adm-card adm-ind-tile">
                <span className="adm-ind-rot">Tempo de mobilização de pessoas</span>
                <strong className={`adm-ind-num${tempoPessoas.media === null ? ' tom-vazio' : ''}`}>
                  {tempoPessoas.media === null ? '—' : `${tempoPessoas.media} d`}
                </strong>
                <span className="adm-ind-pe">{peDoTempo(tempoPessoas)}</span>
              </div>
              <div className="adm-card adm-ind-tile">
                <span className="adm-ind-rot">Tempo de mobilização de empresa</span>
                <strong className={`adm-ind-num${tempoEmpresas.media === null ? ' tom-vazio' : ''}`}>
                  {tempoEmpresas.media === null ? '—' : `${tempoEmpresas.media} d`}
                </strong>
                <span className="adm-ind-pe">{peDoTempo(tempoEmpresas)}</span>
              </div>
            </div>
          )}

          <div className="adm-card">
            <h2 className="adm-card-tit">Detalhamento por serviço</h2>
            <div className="adm-tabela-scroll">
              <table className="adm-tabela adm-tabela-direita">
                <thead>
                  <tr>
                    <th>Serviço</th>
                    <th className="num">Em aberto</th>
                    <th className="num">Fechados</th>
                    <th className="num adm-ind-col-total">Total</th>
                    <th className="num">Tempo médio</th>
                  </tr>
                </thead>
                <tbody>
                  {r.porServico.map((s) => (
                    <tr key={s.nome}>
                      <td>{s.nome}</td>
                      {/* Zero em tom apagado: numa coluna de muitos zeros, o
                          olho precisa cair é nas linhas que têm chamado. */}
                      <td className={`num${s.abertos === 0 ? ' is-zero' : ''}`}>{s.abertos}</td>
                      <td className={`num${s.encerrados === 0 ? ' is-zero' : ''}`}>{s.encerrados}</td>
                      <td className="num adm-ind-col-total">{s.total}</td>
                      {/* Média só dos fechados; o title diz de quantos saiu,
                          para ninguém tomar a média de um caso por tendência. No
                          toque não existe title, então média de poucos casos diz
                          isso também no texto. */}
                      <td className={`num${s.tempoMedio === null ? ' is-zero' : ''}`} title={s.medidos ? (s.medidos === 1 ? '1 chamado fechado' : `${s.medidos} chamados fechados`) : ''}>
                        {s.tempoMedio === null ? '—' : `${s.tempoMedio} d`}
                        {s.medidos > 0 && s.medidos < POUCOS_MEDIDOS && (
                          <small className="adm-ind-poucos"> · só {s.medidos}</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {verAtrasados && (
        <ListaAtrasados
          chamados={r.listaAtrasados}
          agora={agora}
          souDoTime={souDoTime}
          onFechar={() => setVerAtrasados(false)}
        />
      )}
    </div>
  );
}
