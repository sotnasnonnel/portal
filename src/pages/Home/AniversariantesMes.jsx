import { useEffect, useState } from 'react';
import { Cake, Award, PartyPopper, MessageCircleHeart } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePontos } from '../../contexts/PontosContext';
import { aniversariantesDoMes, fotosAniversariantes } from '../../services/humor';
import { visuais as visuaisPontos } from '../../services/pontos';
import { classeMoldura, NOME_TITULO } from '../../config/pontos';
import Insignia from '../../components/Pontos/Insignia';
import MuralParabensModal from './MuralParabensModal';
import { cargo, iniciais, nomeProprio } from '../../utils/pessoas';
import SeloMoldura from '../../components/Pontos/SeloMoldura';
import { rotuloCartaz, SEMANA } from './comemoracao';
import { prefetchFotosMural } from './fotosMural';
import { deIso } from '../../utils/diasUteis';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
// Lista longa empurra a coluna; o resto abre no clique.
const VISIVEIS = 5;

const dd = (n) => String(n).padStart(2, '0');
const anos = (n) => `${n} ${n === 1 ? 'ano' : 'anos'}`;

// Cor do avatar presa à pessoa, e não à posição na lista: a mesma pessoa tem a
// mesma cor em qualquer lugar.
const TONS = ['t1', 't2', 't3', 't4'];
const tom = (id) => TONS[[...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) % TONS.length];

// "Mandar também no Teams" abre a conversa do Teams com a pessoa e a mensagem
// já escrita — quem envia ainda pode editar antes de mandar. O link funciona
// no app e no navegador. Só existe para quem está em cartaz (o banco só
// devolve o e-mail dessas linhas).
function linkParabens(p) {
  if (!p.email) return null;
  const primeiro = nomeProprio(p.nome).split(' ')[0];
  const msg = `Feliz aniversário, ${primeiro}! 🎉 Desejo muita saúde, felicidade e sucesso. Um grande abraço!`;
  return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(p.email)}&message=${encodeURIComponent(msg)}`;
}

// Quem ainda está "em cartaz": a RPC manda o dia da comemoração em celebra_em
// (null = fora da janela do fim de semana — ver comemoracao.js). Com o banco
// antigo, que não tem a coluna, vale a regra velha de só o próprio dia.
const emCartaz = (p, hoje) => (p.celebra_em === undefined ? p.dia === hoje : Boolean(p.celebra_em));
// A janela cruza o mês (sábado 31/10 visto na segunda 02/11), então a lista
// pode trazer linha de outro mês: ela entra no cartão de parabéns, nunca na
// lista "Aniversários de <mês>".
const doMes = (p, mes) => p.mes === undefined || p.mes === mes;

// Foto do hub quando há; iniciais quando não há ou o link falha. A moldura é a
// que a pessoa usa na lojinha de pontos.
function Avatar({ p, foto, visual, t = tom(p.colaborador_id) }) {
  const [falhou, setFalhou] = useState(false);
  const moldura = visual?.moldura;
  return (
    <span className={`home-pav ${t} ${classeMoldura(moldura)}`}>
      {foto && !falhou
        ? <img src={foto} alt="" onError={() => setFalhou(true)} />
        : iniciais(p.nome)}
      <SeloMoldura moldura={moldura} />
    </span>
  );
}

function Pessoa({ p, foto, visual, sub, extra, passou }) {
  return (
    <li className={passou ? 'is-passou' : ''}>
      <Avatar p={p} foto={foto} visual={visual} />
      <span className="home-rail-nome">
        {nomeProprio(p.nome)}
        {sub && <small>{sub}</small>}
      </span>
      {extra}
    </li>
  );
}

// A lista só muda de um dia para o outro: fica em memória pelo dia, e voltar
// para a Home a mostra na hora em vez de reler o banco.
let cache = { dia: '', lista: null, fotos: {} };
const diaDeHoje = () => new Date().toDateString();

// Coluna de pessoas da Home: quem está em cartaz para receber parabéns em
// destaque, depois o mês. O banco devolve só o DIA do aniversário: nem ano, nem
// idade. "Em cartaz" é quem faz hoje e, na segunda, quem fez no fim de semana —
// a janela está em comemoracao.js e no espelho SQL da RPC.
export default function AniversariantesMes() {
  const { user } = useAuth();
  const { perfil } = usePontos();
  const [lista, setLista] = useState(() => (cache.dia === diaDeHoje() ? cache.lista : null));
  const [fotos, setFotos] = useState(() => (cache.dia === diaDeHoje() ? cache.fotos : {}));
  // O visual muda quando alguém compra algo: relido a cada visita à Home.
  const [visuais, setVisuais] = useState(() => new Map());
  const [mural, setMural] = useState(null);
  const [todos, setTodos] = useState(false);
  const agora = new Date();
  const hoje = agora.getDate();

  useEffect(() => {
    if (cache.dia === diaDeHoje()) return undefined;
    let vivo = true;
    cache = { dia: '', lista: null, fotos: {} };
    aniversariantesDoMes()
      .then((l) => {
        cache = { ...cache, dia: diaDeHoje(), lista: l };
        if (vivo) setLista(l);
      })
      .catch(() => { if (vivo) setLista([]); });
    // As fotos chegam depois, sem segurar a lista: até lá ficam as iniciais.
    fotosAniversariantes().then((f) => {
      cache.fotos = f;
      if (vivo) setFotos(f);
    });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (!lista?.length) return undefined;
    let vivo = true;
    visuaisPontos(lista.map((p) => p.colaborador_id)).then((v) => { if (vivo) setVisuais(v); });
    return () => { vivo = false; };
  }, [lista]);

  // As fotos de quem escreveu no mural são pedidas já aqui, antes do clique no
  // botão: o modal abre com elas prontas em vez de preencher os rostos depois
  // (ver fotosMural.js). Só de quem está em cartaz — é o único mural que abre.
  useEffect(() => {
    if (!lista?.length) return;
    const diaAtual = new Date().getDate();
    lista
      .filter((p) => p.tipo === 'aniversario' && emCartaz(p, diaAtual))
      .forEach((p) => { prefetchFotosMural(p.colaborador_id); });
  }, [lista]);

  if (!lista || lista.length === 0) return null;
  // O meu visual vem do contexto: muda na hora em que compro algo.
  const visualDe = (p) => (p.colaborador_id === user?.id ? perfil : visuais.get(p.colaborador_id));
  const mes = MESES[agora.getMonth()];
  const mesAtual = agora.getMonth() + 1;
  const cartaz = (p) => emCartaz(p, hoje);
  // Como falar do dia da pessoa: 'hoje', 'no sábado' ou 'no domingo'.
  const quandoDe = (p) => (p.celebra_em ? rotuloCartaz(deIso(p.celebra_em), agora) : 'hoje');

  const aniv = lista.filter((p) => p.tipo === 'aniversario');
  // Quem recebe parabéns agora: quem faz hoje e, na segunda, quem comemorou no
  // fim de semana sem ninguém no portal.
  const celebrando = aniv.filter(cartaz);
  const doMesAniv = aniv.filter((p) => !cartaz(p) && doMes(p, mesAtual));
  // Os que ainda vêm primeiro; os que já passaram ficam no fim, esmaecidos.
  const proximos = doMesAniv.filter((p) => p.dia > hoje).sort((a, b) => a.dia - b.dia);
  const passados = doMesAniv.filter((p) => p.dia < hoje).sort((a, b) => a.dia - b.dia);
  // Sem ninguém em cartaz, o próximo ganha o cartão — e sai da lista para não
  // aparecer duas vezes.
  const proximo = celebrando.length === 0 ? proximos[0] : null;
  const resto = [...(proximo ? proximos.slice(1) : proximos), ...passados];
  const mostrados = todos ? resto : resto.slice(0, VISIVEIS);
  const casa = lista
    .filter((p) => p.tipo === 'tempo_casa' && (cartaz(p) || doMes(p, mesAtual)))
    .sort((a, b) => a.dia - b.dia);
  const diaDaSemana = (dia) => SEMANA[new Date(agora.getFullYear(), agora.getMonth(), dia).getDay()];

  const unico = celebrando.length === 1 ? celebrando[0] : null;
  const vUnico = unico ? visualDe(unico) : null;
  const ehEu = (p) => p.colaborador_id === user?.id;
  const todosHoje = celebrando.every((p) => quandoDe(p) === 'hoje');

  return (
    <>
      {/* Uma pessoa: cartão de destaque, com a moldura e a insígnia que ela
          usa. Duas ou mais: o mesmo cartão vira lista, uma linha por pessoa
          com o próprio botão. */}
      {unico && (
        <section className="home-festa" aria-label={todosHoje ? 'Aniversário hoje' : 'Aniversário para dar parabéns'}>
          <div className="home-festa-avs">
            <Avatar p={unico} foto={fotos[unico.colaborador_id]} visual={vUnico} t="t1" />
          </div>
          <b>{nomeProprio(unico.nome)}</b>
          {vUnico?.titulo && (
            <div className="home-festa-ins">
              <Insignia id={vUnico.titulo} nome={NOME_TITULO[vUnico.titulo]} texto={vUnico.titulo_texto} mini />
            </div>
          )}
          <span>
            {quandoDe(unico) === 'hoje'
              ? 'faz aniversário hoje 🎂'
              : `fez aniversário ${quandoDe(unico)} 🎂`}
          </span>
          <button type="button" className="home-festa-btn" onClick={() => setMural(unico)}>
            {ehEu(unico)
              ? <><MessageCircleHeart size={16} aria-hidden="true" /> Ver seu mural</>
              : <><PartyPopper size={16} aria-hidden="true" /> Deixar recado</>}
          </button>
        </section>
      )}

      {celebrando.length > 1 && (
        <section className="home-festa home-festa-lista" aria-label={todosHoje ? 'Aniversariantes de hoje' : 'Aniversariantes para dar parabéns'}>
          <h2>🎂 {celebrando.length} aniversariantes {todosHoje ? 'hoje' : 'para dar parabéns'}</h2>
          <ul>
            {celebrando.map((p) => (
              <li key={p.colaborador_id}>
                <Avatar p={p} foto={fotos[p.colaborador_id]} visual={visualDe(p)} t="t1" />
                <span className="home-festa-nome">
                  {nomeProprio(p.nome)}
                  {/* Na segunda o cargo dá lugar ao dia: é a informação que
                      explica por que a pessoa ainda está aqui. */}
                  {quandoDe(p) !== 'hoje'
                    ? <small>fez aniversário {quandoDe(p)}</small>
                    : p.funcao && <small>{cargo(p.funcao)}</small>}
                </span>
                <button
                  type="button"
                  className="home-festa-mini"
                  onClick={() => setMural(p)}
                  aria-label={ehEu(p) ? 'Ver seu mural de parabéns' : `Deixar recado para ${nomeProprio(p.nome)}`}
                  title={ehEu(p) ? 'Ver seu mural' : 'Deixar recado no mural'}
                >
                  <PartyPopper size={15} aria-hidden="true" /> {ehEu(p) ? 'Mural' : 'Recado'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {proximo && (
        <section className="home-prox" aria-label="Próximo aniversário">
          <h2>Próximo aniversário</h2>
          <div className="home-prox-linha">
            <Avatar p={proximo} foto={fotos[proximo.colaborador_id]} visual={visualDe(proximo)} />
            <div>
              <b>{nomeProprio(proximo.nome)}</b>
              <span>{diaDaSemana(proximo.dia)}, {dd(proximo.dia)}/{dd(agora.getMonth() + 1)}</span>
            </div>
          </div>
        </section>
      )}

      {resto.length > 0 && (
        <section className="home-rail-card" aria-label={`Aniversários de ${mes}`}>
          <h2><Cake size={15} aria-hidden="true" /> Aniversários de {mes}</h2>
          <ul className="home-rail-lista">
            {mostrados.map((p) => (
              <Pessoa
                key={p.colaborador_id}
                p={p}
                foto={fotos[p.colaborador_id]}
                visual={visualDe(p)}
                sub={cargo(p.funcao)}
                passou={p.dia < hoje}
                extra={<span className="home-rail-dia">{dd(p.dia)}/{dd(agora.getMonth() + 1)}</span>}
              />
            ))}
          </ul>
          {resto.length > VISIVEIS && (
            <button type="button" className="home-rail-mais" onClick={() => setTodos((v) => !v)}>
              {todos ? 'Mostrar menos' : `Ver todos (${resto.length})`}
            </button>
          )}
        </section>
      )}

      {casa.length > 0 && (
        <section className="home-rail-card" aria-label={`Tempo de casa em ${mes}`}>
          <h2><Award size={15} aria-hidden="true" /> Tempo de casa</h2>
          <ul className="home-rail-lista">
            {casa.map((p) => (
              <Pessoa
                key={p.colaborador_id}
                p={p}
                foto={fotos[p.colaborador_id]}
                visual={visualDe(p)}
                sub={cartaz(p) ? quandoDe(p) : `dia ${dd(p.dia)}`}
                passou={!cartaz(p) && p.dia < hoje}
                extra={<span className="home-rail-anos">{anos(p.anos_casa)}</span>}
              />
            ))}
          </ul>
        </section>
      )}

      {mural && (
        /* key por pessoa: trocar de aniversariante com o mural aberto (dois no
           mesmo dia) tem de começar de zero, e não reaproveitar o recado e o
           texto da pessoa anterior até a resposta do banco chegar. */
        <MuralParabensModal
          key={mural.colaborador_id}
          pessoa={mural}
          linkTeams={ehEu(mural) ? null : linkParabens(mural)}
          onClose={() => setMural(null)}
        />
      )}
    </>
  );
}
