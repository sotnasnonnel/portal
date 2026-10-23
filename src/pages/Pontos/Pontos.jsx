import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Loader2, CalendarClock, Eye, Aperture, Award, Palette, MessageSquareHeart, Star, Flame, History } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePontos } from '../../contexts/PontosContext';
import { catalogo, comprar, usar, extrato as lerExtrato, definirSustos } from '../../services/pontos';
import {
  CATEGORIAS, NOME_MES, AMOSTRA_TEMA, COMO_GANHAR, TEMA_PADRAO, GRUPOS_TITULO, GRUPO_TITULO, classeMoldura, temaNoMes,
} from '../../config/pontos';
import { IMG } from '../../config/pontosImagens';
import Insignia from '../../components/Pontos/Insignia';
import SeloMoldura from '../../components/Pontos/SeloMoldura';
import RecadoMural from '../../components/Pontos/RecadoMural';
import { iniciais, nomeProprio, cargo } from '../../utils/pessoas';
import { isSuperAdmin } from '../../config/superAdmin';
import './Pontos.css';

const mesAtual = () => new Date().getMonth() + 1;
const fmt = (n) => Number(n || 0).toLocaleString('pt-BR');
const dataCurta = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const ICONE_ABA = { moldura: Aperture, titulo: Award, tema: Palette, mural: MessageSquareHeart };

function emUso(perfil, item) {
  if (!item) return false;
  if (item.categoria === 'moldura') return perfil.moldura === item.id;
  if (item.categoria === 'titulo') return perfil.titulo === item.id;
  // Padrão PHD: vale sempre que nenhum tema do mês está valendo.
  if (item.id === TEMA_PADRAO.id) return !temaNoMes(perfil.tema);
  if (item.categoria === 'tema') return perfil.tema === item.id;
  if (item.categoria === 'mural') return (perfil.mural || []).includes(item.id);
  return false;
}

/** Junta o item que a pessoa está olhando ao que ela já usa (para a prévia). */
function comItem(lista = [], item, itens) {
  if (!item) return lista || [];
  const grupo = item.grupo;
  const base = (lista || []).filter((id) => id !== item.id && !(grupo && itens.find((i) => i.id === id)?.grupo === grupo));
  return [...base, item.id];
}

/** Bolinha da pessoa, no tamanho de cada lugar do portal. */
function Bolinha({ nome, foto, moldura, tam = 52 }) {
  return (
    <span className={`pl-av ${classeMoldura(moldura)}`} style={{ width: tam, height: tam }}>
      {foto ? <img src={foto} alt="" /> : iniciais(nome)}
      <SeloMoldura moldura={moldura} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// "Você": como a pessoa aparece de verdade, em cada lugar do portal
// ---------------------------------------------------------------------------
function Voce({ user, foto, moldura, titulo, tituloNome, mural, olhando }) {
  const nome = nomeProprio(user?.nome);
  const curto = nome.split(' ').filter((_, i, a) => i === 0 || i === a.length - 1).join(' ');
  return (
    <section className="pl-voce" aria-label="Como você aparece">
      <div className="pl-voce-eu">
        <Bolinha nome={user?.nome} foto={foto} moldura={moldura} tam={96} />
        <div className="pl-voce-nome">
          <b>{nome}</b>
          <small>{cargo(user?.funcao || '')}</small>
          {titulo && <Insignia id={titulo} nome={tituloNome} />}
        </div>
        {olhando && <span className="pl-voce-tag"><Eye size={13} /> Prévia: {olhando}</span>}
      </div>

      <div className="pl-voce-onde">
        <div className="pl-onde">
          <small>Topo da Home</small>
          <div className="pl-onde-home">
            <span className="pl-onde-ola">Olá, {curto.split(' ')[0]}!</span>
            <Bolinha nome={user?.nome} foto={foto} moldura={moldura} tam={36} />
          </div>
        </div>
        <div className="pl-onde">
          <small>Menu dos módulos</small>
          <div className="pl-onde-menu">
            <Bolinha nome={user?.nome} foto={foto} moldura={moldura} tam={36} />
            <span><b>{curto}</b><em>{cargo(user?.funcao || '')}</em></span>
          </div>
        </div>
        <div className="pl-onde">
          <small>Aniversários na Home</small>
          <div className="pl-onde-lista">
            <Bolinha nome={user?.nome} foto={foto} moldura={moldura} tam={32} />
            <span><b>{curto}</b><em>dia 16</em></span>
          </div>
        </div>
        <div className="pl-onde pl-onde-largo">
          <small>Seu recado no mural de aniversário</small>
          <RecadoMural nome={user?.nome} foto={foto} moldura={moldura} mural={mural} meu
            texto="Feliz aniversário! Muita saúde e sucesso." />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Miniatura de cada item na vitrine
// ---------------------------------------------------------------------------
function Miniatura({ item, user, foto }) {
  if (item.categoria === 'moldura') return <Bolinha nome={user?.nome} foto={foto} moldura={item.id} tam={64} />;
  // A frase já está no card (descrição), embaixo da insígnia.
  if (item.categoria === 'titulo') return <Insignia id={item.id} nome={item.nome} frase={false} />;
  if (item.categoria === 'tema') {
    const [menu, acento, fundo, enfeite] = AMOSTRA_TEMA[item.id] || [];
    return (
      <span className="pl-amostra" style={{ '--a-menu': menu, '--a-acc': acento, '--a-fundo': fundo }}>
        <i /><span><b /><em /><em /><em /></span>
        {enfeite && <img className="pl-amostra-enfeite" src={IMG[enfeite]} alt="" />}
      </span>
    );
  }
  if (item.categoria === 'mural') {
    return (
      <div className="pl-mural-mini">
        <RecadoMural nome={user?.nome} foto={foto} texto="Parabéns! 🎉" mural={[item.id]} />
      </div>
    );
  }
  return null;
}

export default function Pontos() {
  const { user, fotoUrl } = useAuth();
  const { resumo, perfil: perfilCtx, saldo, saldoReal, sequencia, recarregar, setPreviaTema, testarSusto } = usePontos();
  const [verExtrato, setVerExtrato] = useState(false);
  const [perguntaSustos, setPerguntaSustos] = useState(false);
  const perfil = useMemo(() => perfilCtx || {}, [perfilCtx]);
  const [itens, setItens] = useState([]);
  const [erroCatalogo, setErroCatalogo] = useState('');
  const [aba, setAba] = useState('moldura');
  const [selId, setSelId] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    // Vindo da Home, a página nascia rolada para o meio.
    window.scrollTo(0, 0);
    catalogo().then(setItens).catch((e) => setErroCatalogo(e.message));
  }, []);

  // Sair da lojinha devolve o tema da pessoa.
  useEffect(() => () => setPreviaTema(undefined), [setPreviaTema]);

  // O Padrão PHD não vem do banco: é o portal sem tema, de graça, e vem
  // primeiro na aba de temas.
  const vitrine = useMemo(() => [TEMA_PADRAO, ...itens], [itens]);
  const item = vitrine.find((i) => i.id === selId) || null;
  // Tema: clicar experimenta no portal inteiro, mesmo fora do mês. O Padrão
  // experimenta "sem tema" (null), e não o tema que a pessoa usa.
  useEffect(() => {
    if (item?.id === TEMA_PADRAO.id) setPreviaTema(null);
    else setPreviaTema(item?.categoria === 'tema' ? item.id : undefined);
  }, [item, setPreviaTema]);

  const compras = useMemo(() => new Map((resumo?.compras || []).map((c) => [c.item_id, c])), [resumo]);

  // O que a pessoa está olhando entra na prévia por cima do que ela usa.
  const moldura = item?.categoria === 'moldura' ? item.id : perfil.moldura;
  const titulo = item?.categoria === 'titulo' ? item.id : perfil.titulo;
  const tituloItem = itens.find((i) => i.id === titulo);
  const mural = item?.categoria === 'mural' ? comItem(perfil.mural, item, itens) : perfil.mural;

  const acao = async (it) => {
    setOcupado(it.id);
    setMsg(null);
    try {
      // Voltar ao Padrão PHD = tirar o tema que estiver em uso.
      if (it.id === TEMA_PADRAO.id) {
        if (perfil.tema) await usar(perfil.tema, false);
        setMsg({ ok: true, t: 'Padrão PHD em uso.' });
        await recarregar();
        return;
      }
      const cp = compras.get(it.id);
      if (cp && cp.status === 'ok') {
        const ligar = !emUso(perfil, it);
        await usar(it.id, ligar);
        if (ligar && it.id === 'th-halloween') setPerguntaSustos(true);
        setMsg({ ok: true, t: ligar ? `${it.nome} em uso.` : `${it.nome} tirado de uso.` });
      } else {
        await comprar(it.id);
        if (it.id === 'th-halloween') setPerguntaSustos(true);
        setMsg({ ok: true, t: it.custo > 0 ? `${it.nome} é seu (−${fmt(it.custo)} pts) e já está em uso.` : `${it.nome} em uso.` });
      }
      await recarregar();
    } catch (e) {
      setMsg({ ok: false, t: e.message });
    } finally {
      setOcupado(null);
    }
  };

  const abas = CATEGORIAS;
  const daAba = vitrine.filter((i) => i.categoria === aba);
  // Títulos em grupos (config/pontos.js), na ordem de lá; título que o front
  // ainda não conhece vai para o fim. As outras abas são uma grade só.
  const gruposDaAba = aba !== 'titulo' ? [{ nome: null, itens: daAba }]
    : [...GRUPOS_TITULO.map((g) => g.nome), 'Outros']
      .map((nome) => ({ nome, itens: daAba.filter((i) => (GRUPO_TITULO[i.id] || 'Outros') === nome) }))
      .filter((g) => g.itens.length > 0);

  return (
    <div className="pl-page">
      <header className="pl-header">
        <Link to="/home" className="pl-back"><ArrowLeft size={18} /> Portal</Link>
        <div className="pl-header-linha">
          <div>
            <h1>Personalização</h1>
            <p>Escolha como você aparece no portal: moldura, título, tema do mês e enfeite dos seus recados. Cada item sai por pontos, que você ganha usando o portal.</p>
          </div>
          <div className="pl-saldo">
            <div className="pl-chip is-pts" data-pontos-alvo><Star size={18} aria-hidden="true" /><span><strong>{fmt(saldo)}</strong><small>seus pontos</small></span></div>
            <div className="pl-chip"><Flame size={18} aria-hidden="true" /><span><strong>{sequencia}</strong><small>dias úteis seguidos</small></span></div>
          </div>
        </div>
      </header>

      {/* Ganhar tem que ser fácil: o tema do mês cabe dentro do mês. */}
      <section className="pl-ganhar" aria-label="Como ganhar pontos">
        <b>Como ganhar</b>
        <ul>
          {COMO_GANHAR.map((g) => (
            <li key={g.o}><span className="pl-ganhar-p">+{g.p}</span><span>{g.o}<small>{g.d}</small></span></li>
          ))}
        </ul>
        <button type="button" className="pl-extrato-btn" onClick={() => setVerExtrato((v) => !v)} aria-expanded={verExtrato}>
          <History size={15} aria-hidden="true" /> {verExtrato ? 'Fechar extrato' : 'Ver extrato'}
        </button>
      </section>
      {verExtrato && <Extrato saldo={saldoReal} />}

      <Voce
        user={user}
        foto={fotoUrl}
        moldura={moldura}
        titulo={titulo}
        tituloNome={tituloItem?.nome}
        mural={mural}
        olhando={item && !emUso(perfil, item) && item.categoria !== 'tema' ? item.nome : null}
      />

      {msg && <p className={`pl-msg ${msg.ok ? 'is-ok' : 'is-erro'}`} role="status">{msg.t}</p>}

      {/* As categorias são a porta de entrada da página: botões grandes, com
          ícone e o que cada uma muda. */}
      <nav className="pl-abas" aria-label="O que personalizar">
        {abas.map((c) => {
          const Icone = ICONE_ABA[c.id];
          return (
            <button key={c.id} type="button" className={`pl-aba ${aba === c.id ? 'is-on' : ''}`} aria-pressed={aba === c.id}
              onClick={() => { setAba(c.id); setSelId(null); setMsg(null); }}>
              <span className="pl-aba-ic"><Icone size={22} aria-hidden="true" /></span>
              <span className="pl-aba-txt"><b>{c.nome}</b><small>{c.sub}</small></span>
            </button>
          );
        })}
      </nav>

      {erroCatalogo && <p className="pl-aviso">{erroCatalogo}</p>}
      {gruposDaAba.map((g) => (
        <section key={g.nome || aba} className="pl-grupo" aria-label={g.nome || undefined}>
          {g.nome && <h2 className="pl-grupo-tit">{g.nome}</h2>}
          <div className="pl-grade">
            {g.itens.map((it) => {
              const usando = emUso(perfil, it);
              const foraDoMes = it.mes && it.mes !== mesAtual();
              const temIt = compras.get(it.id)?.status === 'ok';
              const pago = it.custo > 0 && !temIt;
              const falta = pago ? it.custo - (saldoReal ?? 0) : 0;
              return (
                <article key={it.id} className={`pl-item ${selId === it.id ? 'is-sel' : ''} ${usando ? 'is-uso' : ''}`}>
                  <button type="button" className="pl-item-ver" onClick={() => setSelId(selId === it.id ? null : it.id)}
                    aria-label={`Ver ${it.nome} em você`}>
                    <span className="pl-item-vit"><Miniatura item={it} user={user} foto={fotoUrl} /></span>
                    <span className="pl-item-nome">{it.nome}{it.custo > 0 && <span className="pl-preco"><Star size={12} aria-hidden="true" /> {fmt(it.custo)}</span>}</span>
                    <span className="pl-item-desc">{it.descricao}</span>
                  </button>
                  {/* Só o super admin: solta um susto agora, para ver e ouvir. */}
                  {it.id === 'th-halloween' && isSuperAdmin(user) && (
                    <button type="button" className="pl-sustos-troca pl-sustos-teste" onClick={testarSusto}>
                      👻 Testar um susto agora
                    </button>
                  )}
                  {it.id === 'th-halloween' && usando && (
                    <button type="button" className="pl-sustos-troca" onClick={() => setPerguntaSustos(true)}>
                      Sustos: <b>{perfil.sustos ? 'ligados' : 'desligados'}</b>
                    </button>
                  )}
                  <div className="pl-item-acao">
                    {/* Em uso: o selo diz o que está valendo e "Tirar" desliga. */}
                    {usando ? (
                      <>
                        <span className="pl-item-uso"><Check size={15} aria-hidden="true" /> Em uso</span>
                        {it.id !== TEMA_PADRAO.id && <button type="button" className="pl-btn is-sec pl-btn-tirar" disabled={ocupado === it.id}
                          onClick={() => acao(it)} aria-label={`Tirar ${it.nome} de uso`}>
                          {ocupado === it.id ? <Loader2 size={15} className="pl-spin" /> : <X size={15} aria-hidden="true" />} Tirar
                        </button>}
                      </>
                    ) : foraDoMes ? (
                      <span className="pl-item-mes"><CalendarClock size={14} /> Chega em {NOME_MES[it.mes - 1]}</span>
                    ) : (
                      falta > 0 ? (
                        <span className="pl-item-mes">Faltam {fmt(falta)} pts</span>
                      ) : (
                        <button type="button" className="pl-btn" disabled={ocupado === it.id || !resumo} onClick={() => acao(it)}>
                          {ocupado === it.id && <Loader2 size={15} className="pl-spin" />}
                          {pago ? `Trocar por ${fmt(it.custo)} pts` : 'Usar'}
                        </button>
                      )
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {perguntaSustos && (
        <PerguntaSustos
          ligados={!!perfil.sustos}
          onEscolher={async (sim) => {
            setPerguntaSustos(false);
            try {
              await definirSustos(sim);
              setMsg({ ok: true, t: sim ? 'Sustos ligados. Boa sorte. 👻' : 'Sem sustos. O Halloween fica só no visual.' });
              await recarregar();
            } catch (e) {
              setMsg({ ok: false, t: e.message });
            }
          }}
          onFechar={() => setPerguntaSustos(false)}
        />
      )}
      {aba === 'tema' && (
        <p className="pl-nota">Clique num tema para experimentar: ele aparece no portal enquanto você está nesta página, mesmo fora do mês.</p>
      )}
    </div>
  );
}

function Extrato({ saldo }) {
  const [linhas, setLinhas] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => { lerExtrato(30).then(setLinhas).catch((e) => setErro(e.message)); }, [saldo]);
  if (erro) return <p className="pl-aviso">{erro}</p>;
  return (
    <section className="pl-extrato" aria-label="Extrato de pontos">
      {!linhas && <p className="pl-nota"><Loader2 size={14} className="pl-spin" /> Carregando…</p>}
      {linhas?.length === 0 && <p className="pl-nota">Nenhum movimento ainda.</p>}
      {linhas?.map((l, i) => (
        <div key={i} className="pl-extrato-linha">
          <span>{l.descricao}</span>
          <small>{dataCurta(l.criado_em)}</small>
          <b className={l.pontos > 0 ? 'is-mais' : 'is-menos'}>{l.pontos > 0 ? '+' : ''}{fmt(l.pontos)}</b>
        </div>
      ))}
    </section>
  );
}

/**
 * Pergunta, ao escolher o Halloween, se a pessoa quer levar sustos.
 *
 * Só a pergunta: o que acontece, e principalmente QUANDO, não se conta
 * (pedido do usuário, 19/10/2026 — explicar estraga o susto).
 */
function PerguntaSustos({ ligados, onEscolher, onFechar }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar]);
  return (
    <div className="pl-sustos-fundo" onClick={onFechar}>
      <div className="pl-sustos" role="dialog" aria-modal="true" aria-labelledby="pl-sustos-tit" onClick={(e) => e.stopPropagation()}>
        <img src={IMG.fantasma} alt="" />
        <h2 id="pl-sustos-tit">Quer levar uns sustos?</h2>
        <div className="pl-sustos-acoes">
          <button type="button" className="pl-btn is-sec" onClick={() => onEscolher(false)}>{ligados ? 'Desligar os sustos' : 'Não, obrigado'}</button>
          <button type="button" className="pl-btn" onClick={() => onEscolher(true)} autoFocus>{ligados ? 'Manter os sustos' : 'Quero sustos'}</button>
        </div>
      </div>
    </div>
  );
}
