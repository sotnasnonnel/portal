import { useEffect, useState } from 'react';
import { Cake, Award } from 'lucide-react';
import { aniversariantesDoMes } from '../../services/humor';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
// Lista longa empurra a Home; o resto abre no clique.
const VISIVEIS = 6;

const nomeProprio = (nome = '') => nome.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());

// `icone` chega pronto (<Cake />): o ESLint do projeto acusaria um componente
// recebido por prop como variável não usada.
function Lista({ titulo, icone, itens, hoje, vazio, detalhe }) {
  const [todos, setTodos] = useState(false);
  const mostrados = todos ? itens : itens.slice(0, VISIVEIS);
  return (
    <div className="home-aniv-col">
      <h3>{icone} {titulo}</h3>
      {itens.length === 0 ? (
        <p className="home-aniv-vazio">{vazio}</p>
      ) : (
        <ul>
          {mostrados.map((p) => (
            <li key={`${p.tipo}-${p.colaborador_id}`} className={p.dia === hoje ? 'is-hoje' : ''}>
              <span className="home-aniv-dia">{String(p.dia).padStart(2, '0')}</span>
              <span className="home-aniv-nome">
                {nomeProprio(p.nome)}
                {p.funcao && <small>{p.funcao.toLowerCase()}</small>}
              </span>
              <span className="home-aniv-extra">{p.dia === hoje ? 'hoje' : detalhe(p)}</span>
            </li>
          ))}
        </ul>
      )}
      {itens.length > VISIVEIS && (
        <button type="button" className="home-aniv-mais" onClick={() => setTodos((v) => !v)}>
          {todos ? 'Mostrar menos' : `Ver todos (${itens.length})`}
        </button>
      )}
    </div>
  );
}

// Aniversariantes e tempo de casa do mês — só para as pessoas saberem. O banco
// devolve apenas o DIA do aniversário: nem ano, nem idade.
export default function AniversariantesMes() {
  const [lista, setLista] = useState(null);
  const agora = new Date();
  const hoje = agora.getDate();

  useEffect(() => {
    let vivo = true;
    aniversariantesDoMes().then((l) => { if (vivo) setLista(l); }).catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, []);

  if (!lista || lista.length === 0) return null;
  const mes = MESES[agora.getMonth()];

  return (
    <section className="home-aniv" aria-label={`Aniversariantes e tempo de casa de ${mes}`}>
      <Lista
        titulo={`Aniversariantes de ${mes}`}
        icone={<Cake size={16} aria-hidden="true" />}
        itens={lista.filter((p) => p.tipo === 'aniversario')}
        hoje={hoje}
        vazio="Nenhum aniversário neste mês."
        detalhe={() => ''}
      />
      <Lista
        titulo={`Tempo de casa em ${mes}`}
        icone={<Award size={16} aria-hidden="true" />}
        itens={lista.filter((p) => p.tipo === 'tempo_casa')}
        hoje={hoje}
        vazio="Ninguém completa ano de casa neste mês."
        detalhe={(p) => `${p.anos_casa} ${p.anos_casa === 1 ? 'ano' : 'anos'}`}
      />
    </section>
  );
}
