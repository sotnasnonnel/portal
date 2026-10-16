import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Pencil } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePontos } from '../../contexts/PontosContext';
import {
  HUMORES, COMENTARIO_MAX, humorPorValor, veResumoHumor, veResumoEmpresa,
} from '../../config/humor';
import { registrarHumor, meuHumorHoje } from '../../services/humor';
import CarinhaHumor from '../../components/UI/CarinhaHumor';

// "Como você está hoje?" — uma marcação por dia, que dá para trocar até o fim
// do dia, com comentário opcional. O RH vê a resposta e o comentário de cada
// pessoa; o gestor só vê os números da equipe (config/humor.js). O aviso abaixo
// da pílula precisa dizer exatamente isso: é ele que a pessoa lê ao responder.
//
// Respondido, a pílula encolhe para a carinha e o botão "Mudar": a pergunta já
// foi feita, e as cinco carinhas de volta só quando a pessoa pede.
// A marcação de hoje fica em memória (por pessoa e por dia): voltar para a
// Home mostra a pílula já pronta, sem piscar vazia enquanto relê o banco.
let cache = { chave: '', humor: null, comentario: '' };
const chaveDe = (userId) => `${userId}|${new Date().toDateString()}`;

export default function HumorDoDia() {
  const { user } = useAuth();
  const { recarregar } = usePontos();
  const emCache = cache.chave === chaveDe(user?.id);
  const [hoje, setHoje] = useState(emCache ? cache.humor : null); // valor marcado hoje
  const [comentario, setComentario] = useState(emCache ? cache.comentario : ''); // o que está salvo
  const [rascunho, setRascunho] = useState(emCache ? cache.comentario : '');
  const [carregado, setCarregado] = useState(emCache);
  const [mudando, setMudando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (cache.chave === chaveDe(user?.id)) return undefined;
    let vivo = true;
    meuHumorHoje()
      .then((r) => {
        const humor = r?.humor ?? null;
        const texto = r?.comentario || '';
        cache = { chave: chaveDe(user?.id), humor, comentario: texto };
        if (!vivo) return;
        setHoje(humor);
        setComentario(texto);
        setRascunho(texto);
      })
      .catch(() => {})
      .finally(() => { if (vivo) setCarregado(true); });
    return () => { vivo = false; };
  }, [user?.id]);

  async function salvar(valor, texto, depois) {
    setSalvando(true);
    setErro('');
    try {
      await registrarHumor(valor, texto);
      cache = { chave: chaveDe(user?.id), humor: valor, comentario: texto };
      depois();
      // Marcar e contar o motivo dão pontos (gatilho no banco): saldo novo.
      recarregar();
    } catch (e) {
      setErro(e?.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  // Trocar a carinha leva junto o comentário já salvo — não o rascunho, que a
  // pessoa ainda não mandou.
  function marcar(valor) {
    if (salvando) return;
    if (valor === hoje) { setMudando(false); return; }
    salvar(valor, comentario, () => { setHoje(valor); setMudando(false); });
  }

  function salvarComentario(e) {
    e.preventDefault();
    const texto = rascunho.trim();
    if (salvando || texto === comentario) return;
    salvar(hoje, texto, () => { setComentario(texto); setRascunho(texto); });
  }

  const marcado = humorPorValor(hoje);
  const perguntando = !marcado || mudando;
  const semMudanca = rascunho.trim() === comentario;

  return (
    <div className="home-humor-wrap">
      {/* Enquanto carrega, a pílula vazia segura o lugar: sem ela os módulos
          pulavam para baixo quando a resposta chegava. */}
      <section className="home-humor" aria-label="Como você está hoje?" aria-busy={!carregado}>
        {!carregado ? null : perguntando ? (
          <>
            <span className="home-humor-pergunta">Como você está hoje?</span>
            <div className="home-humor-opcoes" role="radiogroup" aria-label="Seu humor hoje">
              {HUMORES.map((h) => (
                <button
                  key={h.valor}
                  type="button"
                  role="radio"
                  aria-checked={hoje === h.valor}
                  aria-label={h.rotulo}
                  title={h.rotulo}
                  disabled={salvando}
                  className={`home-humor-btn${hoje === h.valor ? ' is-on' : ''}`}
                  onClick={() => marcar(h.valor)}
                >
                  <CarinhaHumor valor={h.valor} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <span className="home-humor-marcado">
              <CarinhaHumor valor={marcado.valor} size={34} className="home-humor-em" />
              <span>Você marcou <strong>{marcado.rotulo.toLowerCase()}</strong> hoje</span>
            </span>
            <button
              type="button"
              className="home-humor-mudar"
              onClick={() => setMudando(true)}
              aria-label="Mudar o humor de hoje"
            >
              <Pencil size={14} /> Mudar
            </button>
          </>
        )}
      </section>
      {carregado && marcado && !mudando && (
        <form className="home-humor-coment" onSubmit={salvarComentario}>
          <input
            type="text"
            className="home-humor-input"
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            maxLength={COMENTARIO_MAX}
            placeholder="Quer contar o motivo? (opcional)"
            aria-label="Comentário sobre o seu dia (opcional)"
            disabled={salvando}
          />
          <button type="submit" className="home-humor-salvar" disabled={salvando || semMudanca}>
            {comentario && semMudanca ? 'Salvo' : 'Salvar'}
          </button>
        </form>
      )}
      <span className="home-humor-nota">
        <Lock size={12} aria-hidden="true" /> O RH vê a sua resposta e o comentário. A equipe vê o total, sem nomes.
        {/* O painel do RH já abre na empresa: "da equipe" fazia o RH achar que
            não tinha acesso ao resumo de todos. */}
        {veResumoHumor(user) && (
          <> · <Link to="/humor">Humor da {veResumoEmpresa(user) ? 'empresa' : 'equipe'}</Link></>
        )}
      </span>
      {erro && <span className="home-humor-erro" role="alert">{erro}</span>}
    </div>
  );
}
