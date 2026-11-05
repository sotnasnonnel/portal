import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox, Archive, AlertCircle, Star, Plus, CheckCircle2, MessageCircle,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { listarMeusChamados, buscarAvaliacaoPendente } from '../../lib/chamados';
import {
  Abas, CabecalhoPagina, Carregando, PrazoSla, StatusBadge, Vazio,
} from '../components/ui';

const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

const ABAS = [
  { valor: 'abertos', rotulo: 'Em andamento', Icon: Inbox },
  { valor: 'fechados', rotulo: 'Fechados', Icon: Archive },
];

// A bola está com quem pede: é o único caso em que a lista cobra algo de quem a
// lê, então não pode ficar perdido no meio das outras linhas.
const esperaVoce = (c) => c.status === 'aguardando_solicitante';
const precisaDeVoce = (c) => esperaVoce(c) || c.naoLidas > 0;

const textoNaoLidas = (n) => (n === 1 ? '1 mensagem nova' : `${n} mensagens novas`);

export default function MeusChamadosAdm() {
  const { user } = useAuth();
  const [aba, setAba] = useState('abertos');
  const [linhas, setLinhas] = useState([]);
  const [pendente, setPendente] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  // Um instante só para a lista inteira, renovado a cada carga: duas linhas com
  // o mesmo vencimento não podem dizer coisas diferentes.
  const [agora, setAgora] = useState(() => Date.now());
  // Trocar de aba rápido não pode deixar a resposta atrasada da aba anterior
  // por cima da atual.
  const pedidoAtual = useRef(0);

  const fechados = aba === 'fechados';
  const listaVazia = !fechados && !carregando && !erro && linhas.length === 0;

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    if (!user?.id) return;
    const pedido = pedidoAtual.current + 1;
    pedidoAtual.current = pedido;
    if (!silencioso) setCarregando(true);
    setErro('');
    try {
      const [lista, aval] = await Promise.all([
        listarMeusChamados(user.id, { fechados }),
        buscarAvaliacaoPendente(user.id),
      ]);
      if (pedido !== pedidoAtual.current) return;
      setLinhas(lista);
      setPendente(aval);
      setAgora(Date.now());
    } catch (e) {
      if (pedido === pedidoAtual.current) {
        setErro(e.message);
        // Na troca de aba, a lista na tela é da OUTRA aba: mantê-la mostraria
        // chamados em andamento sob o título "Fechados". Na recarga silenciosa
        // ela é a certa, só um pouco antiga, e continua valendo.
        if (!silencioso) setLinhas([]);
      }
    } finally {
      if (pedido === pedidoAtual.current) setCarregando(false);
    }
  }, [user?.id, fechados]);

  // Também ao voltar para a aba: a avaliação que destrava tudo é feita na tela
  // do chamado, e o aviso aqui ficaria pedindo algo que já foi feito. Silencioso:
  // cada troca de janela apagava a lista e piscava "Carregando…" no lugar dela.
  useEffect(() => {
    carregar();
    const aoFocar = () => carregar({ silencioso: true });
    window.addEventListener('focus', aoFocar);
    return () => window.removeEventListener('focus', aoFocar);
  }, [carregar]);

  // Sort é estável: dentro de cada grupo continua valendo a ordem do banco.
  const ordenadas = fechados
    ? linhas
    : [...linhas].sort((a, b) => Number(precisaDeVoce(b)) - Number(precisaDeVoce(a)));

  return (
    <div className="adm-page adm-page-wide adm-meus-pagina">
      <CabecalhoPagina
        titulo="Meus chamados"
        subtitulo="Acompanhe o andamento e o prazo das suas solicitações."
        // Com avaliação pendente, abrir está travado (POP 9.1): a ação da tela
        // passa a ser "Avaliar agora", e dois botões iguais competiriam por ela.
        // Na lista vazia o próprio estado vazio já oferece abrir um chamado.
        acao={!pendente && !listaVazia && (
          <Link className="adm-btn adm-btn-primary" to="/administrativo/novo">
            <Plus size={16} aria-hidden="true" /> Abrir chamado
          </Link>
        )}
      />

      {/* A avaliação pendente bloqueia a abertura de novos chamados (POP 9.1),
          então precisa aparecer antes da lista, não escondida no rodapé. */}
      {pendente && (
        <div className="adm-aviso tom-erro adm-aviso-acao">
          <Star size={16} aria-hidden="true" />
          <span className="adm-aviso-acao-txt">
            O chamado <strong>#{pendente.numero} — {pendente.assunto}</strong> foi fechado e ainda
            não foi avaliado. Enquanto a avaliação não for feita, você não consegue abrir novos chamados.
          </span>
          <Link className="adm-btn adm-btn-primary" to={`/administrativo/chamado/${pendente.id}`}>
            Avaliar agora
          </Link>
        </div>
      )}

      <Abas itens={ABAS} valor={aba} onChange={setAba} rotulo="Situação dos chamados" />

      {erro && (
        <div className="adm-aviso tom-erro adm-aviso-acao" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span className="adm-aviso-acao-txt">{erro}</span>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => carregar()}>
            Tentar de novo
          </button>
        </div>
      )}

      {carregando ? (
        <Carregando />
      ) : linhas.length === 0 ? (
        // Com erro a lista está vazia porque não veio, não porque não há nada:
        // dizer "nenhum chamado" aqui seria afirmar o que não se sabe.
        !erro && (fechados ? (
          <Vazio Icon={Archive} titulo="Nenhum chamado encerrado por aqui ainda">
            Os chamados fechados, reprovados e cancelados ficam guardados nesta aba.
          </Vazio>
        ) : (
          <Vazio
            Icon={CheckCircle2}
            tom="ok"
            titulo="Nenhum chamado em andamento"
            acao={<Link className="adm-btn adm-btn-primary" to="/administrativo/novo">Abrir um chamado</Link>}
          >
            Quando você abrir um pedido, é aqui que acompanha o andamento e o prazo.
          </Vazio>
        ))
      ) : (
        <div className="adm-tabela-scroll adm-meus">
          <table className="adm-tabela">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Assunto</th>
                <th>Status</th>
                <th>Responsável</th>
                <th>Abertura</th>
                {fechados ? <th>Encerramento</th> : <><th>Aprovação</th><th>Prazo</th></>}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((c) => (
                <tr key={c.id} className={!fechados && precisaDeVoce(c) ? 'is-sua-vez' : undefined}>
                  <td className="num adm-meus-num">#{c.numero}</td>
                  <td className="adm-meus-assunto">
                    {/* Um link só, esticado por cima da linha inteira (ver o
                        CSS): a linha toda é o alvo, no mouse e no dedo, e o
                        teclado não passa duas vezes pelo mesmo destino. */}
                    <Link className="adm-link adm-meus-link" to={`/administrativo/chamado/${c.id}`}>
                      {c.assunto}
                    </Link>
                    {c.naoLidas > 0 && (
                      <span className="adm-meus-novas">
                        <MessageCircle size={13} aria-hidden="true" /> {textoNaoLidas(c.naoLidas)}
                      </span>
                    )}
                  </td>
                  <td className="adm-meus-status">
                    {/* "Aguardando solicitante" é o nome na fila do Atendimento;
                        lido pelo próprio solicitante, não diz que é com ele. */}
                    {esperaVoce(c)
                      ? <span className="adm-badge tom-aguardando_solicitante">Aguardando você</span>
                      : <StatusBadge status={c.status} />}
                  </td>
                  <td data-rotulo="Responsável">{c.atendenteNome || '—'}</td>
                  <td className="num" data-rotulo="Abertura">{data(c.criado_em)}</td>
                  {fechados ? (
                    // Reprovado não tem `fechado_em`: a data que encerrou o
                    // chamado foi a da decisão do aprovador.
                    <td className="num" data-rotulo="Encerramento">{data(c.fechado_em || c.analise_em)}</td>
                  ) : (
                    <>
                      <td className="num adm-meus-aprov" data-rotulo="Aprovação">{data(c.analise_em)}</td>
                      {/* Sem aprovação decidida o relógio nem começou — mostrar
                          um vencimento aqui seria inventar prazo. */}
                      <td className="adm-meus-prazo" data-rotulo="Prazo">
                        {c.status === 'aguardando_aprovacao'
                          ? <span className="adm-prazo-txt tom-sem-prazo">Começa após a aprovação</span>
                          : <PrazoSla venceEm={c.sla_vence_em} agora={agora} />}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
