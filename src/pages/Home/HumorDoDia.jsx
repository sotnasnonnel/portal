import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Pencil } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { HUMORES, humorPorValor, veResumoHumor } from '../../config/humor';
import { registrarHumor, meuHumorHoje } from '../../services/humor';
import CarinhaHumor from '../../components/UI/CarinhaHumor';

// "Como você está hoje?" — uma marcação por dia, que dá para trocar até o fim
// do dia. Ninguém vê a resposta individual: o resumo é só agregado (config/humor.js).
//
// Respondido, a pílula encolhe para a carinha e o botão "Mudar": a pergunta já
// foi feita, e as cinco carinhas de volta só quando a pessoa pede.
// A marcação de hoje fica em memória (por pessoa e por dia): voltar para a
// Home mostra a pílula já pronta, sem piscar vazia enquanto relê o banco.
let cache = { chave: '', valor: null };
const chaveDe = (userId) => `${userId}|${new Date().toDateString()}`;

export default function HumorDoDia() {
  const { user } = useAuth();
  const emCache = cache.chave === chaveDe(user?.id);
  const [hoje, setHoje] = useState(emCache ? cache.valor : null); // valor marcado hoje
  const [carregado, setCarregado] = useState(emCache);
  const [mudando, setMudando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (cache.chave === chaveDe(user?.id)) return undefined;
    let vivo = true;
    meuHumorHoje()
      .then((v) => {
        cache = { chave: chaveDe(user?.id), valor: v };
        if (vivo) setHoje(v);
      })
      .catch(() => {})
      .finally(() => { if (vivo) setCarregado(true); });
    return () => { vivo = false; };
  }, [user?.id]);

  async function marcar(valor) {
    if (salvando) return;
    if (valor === hoje) { setMudando(false); return; }
    setSalvando(true);
    setErro('');
    try {
      await registrarHumor(valor);
      cache = { chave: chaveDe(user?.id), valor };
      setHoje(valor);
      setMudando(false);
    } catch (e) {
      setErro(e?.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const marcado = humorPorValor(hoje);
  const perguntando = !marcado || mudando;

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
      <span className="home-humor-nota">
        <Lock size={12} aria-hidden="true" /> Só você vê. A equipe vê o total, sem nomes.
        {veResumoHumor(user) && <> · <Link to="/humor">Humor da equipe</Link></>}
      </span>
      {erro && <span className="home-humor-erro" role="alert">{erro}</span>}
    </div>
  );
}
