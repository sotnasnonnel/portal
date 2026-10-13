import { useEffect, useState } from 'react';
import { Cake, Award, PartyPopper } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { aniversariantesDoMes } from '../../services/humor';
import { cargo, iniciais, nomeProprio } from '../../utils/pessoas';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira',
  'sexta-feira', 'sábado'];
// Lista longa empurra a coluna; o resto abre no clique.
const VISIVEIS = 5;

const dd = (n) => String(n).padStart(2, '0');
const anos = (n) => `${n} ${n === 1 ? 'ano' : 'anos'}`;

// Cor do avatar presa à pessoa, e não à posição na lista: a mesma pessoa tem a
// mesma cor em qualquer lugar.
const TONS = ['t1', 't2', 't3', 't4'];
const tom = (id) => TONS[[...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) % TONS.length];

// "Dar parabéns" abre a conversa do Teams com a pessoa e a mensagem já escrita
// — quem envia ainda pode editar antes de mandar. O link funciona no app e no
// navegador.
function linkParabens(p) {
  const primeiro = nomeProprio(p.nome).split(' ')[0];
  const msg = `Feliz aniversário, ${primeiro}! 🎉 Desejo muita saúde, felicidade e sucesso. Um grande abraço!`;
  return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(p.email)}&message=${encodeURIComponent(msg)}`;
}

function Pessoa({ p, sub, extra, passou }) {
  return (
    <li className={passou ? 'is-passou' : ''}>
      <span className={`home-pav ${tom(p.colaborador_id)}`}>{iniciais(p.nome)}</span>
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
let cache = { dia: '', lista: null };
const diaDeHoje = () => new Date().toDateString();

// Coluna de pessoas da Home: quem faz aniversário hoje em destaque, depois o
// mês. O banco devolve só o DIA do aniversário: nem ano, nem idade.
export default function AniversariantesMes() {
  const { user } = useAuth();
  const [lista, setLista] = useState(() => (cache.dia === diaDeHoje() ? cache.lista : null));
  const [todos, setTodos] = useState(false);
  const agora = new Date();
  const hoje = agora.getDate();

  useEffect(() => {
    if (cache.dia === diaDeHoje()) return undefined;
    let vivo = true;
    aniversariantesDoMes()
      .then((l) => {
        cache = { dia: diaDeHoje(), lista: l };
        if (vivo) setLista(l);
      })
      .catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, []);

  if (!lista || lista.length === 0) return null;
  // Sem e-mail no cadastro não há como abrir a conversa; e ninguém dá
  // parabéns para si mesmo.
  const podeParabenizar = (p) => p.email && p.email.toLowerCase() !== user?.email?.toLowerCase();
  const mes = MESES[agora.getMonth()];

  const aniv = lista.filter((p) => p.tipo === 'aniversario');
  const deHoje = aniv.filter((p) => p.dia === hoje);
  // Os que ainda vêm primeiro; os que já passaram ficam no fim, esmaecidos.
  const proximos = aniv.filter((p) => p.dia > hoje).sort((a, b) => a.dia - b.dia);
  const passados = aniv.filter((p) => p.dia < hoje).sort((a, b) => a.dia - b.dia);
  // Sem aniversário hoje, o próximo ganha o cartão — e sai da lista para não
  // aparecer duas vezes.
  const proximo = deHoje.length === 0 ? proximos[0] : null;
  const resto = [...(proximo ? proximos.slice(1) : proximos), ...passados];
  const mostrados = todos ? resto : resto.slice(0, VISIVEIS);
  const casa = lista.filter((p) => p.tipo === 'tempo_casa').sort((a, b) => a.dia - b.dia);
  const diaDaSemana = (dia) => SEMANA[new Date(agora.getFullYear(), agora.getMonth(), dia).getDay()];

  return (
    <>
      {/* Uma pessoa: cartão de destaque. Duas ou mais: o mesmo cartão vira
          lista, uma linha por pessoa com o próprio botão — avatares grandes
          lado a lado não cabem na coluna a partir de quatro. */}
      {deHoje.length === 1 && (
        <section className="home-festa" aria-label="Aniversário hoje">
          <div className="home-festa-avs">
            <span className="home-pav t1">{iniciais(deHoje[0].nome)}</span>
          </div>
          <b>{nomeProprio(deHoje[0].nome)}</b>
          <span>faz aniversário hoje 🎂</span>
          {podeParabenizar(deHoje[0]) && (
            <a className="home-festa-btn" href={linkParabens(deHoje[0])} target="_blank" rel="noopener noreferrer">
              <PartyPopper size={16} aria-hidden="true" /> Dar parabéns
            </a>
          )}
        </section>
      )}

      {deHoje.length > 1 && (
        <section className="home-festa home-festa-lista" aria-label="Aniversariantes de hoje">
          <h2>🎂 {deHoje.length} aniversariantes hoje</h2>
          <ul>
            {deHoje.map((p) => (
              <li key={p.colaborador_id}>
                <span className="home-pav t1">{iniciais(p.nome)}</span>
                <span className="home-festa-nome">
                  {nomeProprio(p.nome)}
                  {p.funcao && <small>{cargo(p.funcao)}</small>}
                </span>
                {podeParabenizar(p) && (
                  <a
                    className="home-festa-mini"
                    href={linkParabens(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Dar parabéns a ${nomeProprio(p.nome)}`}
                    title="Dar parabéns no Teams"
                  >
                    <PartyPopper size={15} aria-hidden="true" /> Parabéns
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {proximo && (
        <section className="home-prox" aria-label="Próximo aniversário">
          <h2>Próximo aniversário</h2>
          <div className="home-prox-linha">
            <span className={`home-pav ${tom(proximo.colaborador_id)}`}>{iniciais(proximo.nome)}</span>
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
                sub={p.dia === hoje ? 'hoje' : `dia ${dd(p.dia)}`}
                passou={p.dia < hoje}
                extra={<span className="home-rail-anos">{anos(p.anos_casa)}</span>}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
