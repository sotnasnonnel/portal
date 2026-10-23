import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, Palette, Star, Heart, MessageCircle, Trophy, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePontos } from '../../contexts/PontosContext';
import { COMO_GANHAR, NOME_TITULO } from '../../config/pontos';
import { ROTA_AUSENCIA } from '../../config/ausenciaProgramada';
import { tempoRelativo } from '../../config/feed';
import { destaquesDaSemana } from '../../services/feed';
import { cargo, nomeProprio } from '../../utils/pessoas';
import Insignia from '../../components/Pontos/Insignia';
import { AvatarFeed } from './Autor';
import HumorDoDia from '../Home/HumorDoDia';
import AniversariantesMes from '../Home/AniversariantesMes';
import DestaqueDoDia from '../Home/DestaqueDoDia';
// Os três blocos da Home acima usam as classes home-* (todas com prefixo, sem
// regra global), por isso o CSS dela vem junto.
import '../Home/Home.css';

/** Esquerda: quem está lendo — perfil com moldura e pontos, humor e atalhos. */
export function LateralEsquerda() {
  const { user } = useAuth();
  const { perfil, saldo } = usePontos();
  return (
    <aside className="feed-lateral is-esq" aria-label="Você">
      <section className="feed-bloco feed-perfil">
        <AvatarFeed id={user?.id} nome={user?.nome} moldura={perfil?.moldura} className="is-grande" />
        <b>{nomeProprio(user?.nome || '')}</b>
        {user?.funcao && <span className="feed-perfil-cargo">{cargo(user.funcao)}</span>}
        {perfil?.titulo && NOME_TITULO[perfil.titulo] && <Insignia id={perfil.titulo} nome={NOME_TITULO[perfil.titulo]} mini />}
        {saldo !== null && (
          <Link to="/personalizacao" className="feed-perfil-pontos" data-pontos-alvo>
            <Star size={14} aria-hidden="true" /> <b>{saldo.toLocaleString('pt-BR')}</b> pts · Trocar visual
          </Link>
        )}
      </section>

      <HumorDoDia />

      <nav className="feed-bloco feed-atalhos" aria-label="Atalhos">
        <Link to={ROTA_AUSENCIA}><CalendarDays size={16} /> Minha Ausência</Link>
        <Link to="/aprovacoes"><ClipboardCheck size={16} /> Aprovações</Link>
        <Link to="/personalizacao"><Palette size={16} /> Personalização</Link>
      </nav>
    </aside>
  );
}

/** "Mais curtidos da semana": clicar rola até o post, se ele já estiver na tela. */
function MaisCurtidos() {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    let vivo = true;
    destaquesDaSemana(3).then((l) => { if (vivo) setLista(l); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  if (lista.length === 0) return null;
  const irPara = (id) => document.getElementById(`post-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <section className="feed-bloco">
      <h2 className="feed-bloco-tit"><Trophy size={15} /> Mais curtidos da semana</h2>
      <ol className="feed-top">
        {lista.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => irPara(p.id)}>
              <b>{nomeProprio(p.autor_nome).split(' ').slice(0, 2).join(' ')}</b>
              <span className="feed-top-trecho">
                {p.trecho || (p.fotos ? <><ImageIcon size={12} /> {p.fotos} foto{p.fotos === 1 ? '' : 's'}</> : '—')}
              </span>
              <span className="feed-top-num">
                <Heart size={12} /> {p.curtidas} · <MessageCircle size={12} /> {p.comentarios} · {tempoRelativo(p.criado_em)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Direita: a empresa — aniversariantes, destaque do dia, mais curtidos e pontos. */
export function LateralDireita() {
  return (
    <aside className="feed-lateral is-dir" aria-label="Na PHD">
      <DestaqueDoDia />
      <div className="home-rail feed-rail"><AniversariantesMes /></div>
      <MaisCurtidos />
      <section className="feed-bloco">
        <h2 className="feed-bloco-tit"><Star size={15} /> Como ganhar pontos</h2>
        <ul className="feed-ganhar">
          {COMO_GANHAR.map((g) => (
            <li key={g.o}><span>{g.o}<small>{g.d}</small></span><b>+{g.p}</b></li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
