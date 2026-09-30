import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { HUMORES, humorPorValor, veResumoHumor } from '../../config/humor';
import { registrarHumor, meuHumorHoje } from '../../services/humor';

// "Como você está hoje?" — uma marcação por dia, que dá para trocar até o fim
// do dia. Ninguém vê a resposta individual: o resumo é só agregado (config/humor.js).
export default function HumorDoDia() {
  const { user } = useAuth();
  const [hoje, setHoje] = useState(null);      // valor marcado hoje
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    meuHumorHoje()
      .then((v) => { if (vivo) setHoje(v); })
      .catch(() => {})
      .finally(() => { if (vivo) setCarregado(true); });
    return () => { vivo = false; };
  }, []);

  async function marcar(valor) {
    if (salvando || valor === hoje) return;
    setSalvando(true);
    setErro('');
    try {
      await registrarHumor(valor);
      setHoje(valor);
    } catch (e) {
      setErro(e?.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (!carregado) return null;
  const marcado = humorPorValor(hoje);

  return (
    <section className="home-humor" aria-label="Como você está hoje?">
      <span className="home-humor-pergunta">
        {marcado ? <>Hoje você está <strong>{marcado.rotulo.toLowerCase()}</strong></> : 'Como você está hoje?'}
      </span>
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
            className={`home-humor-btn${hoje === h.valor ? ' is-on' : ''}${hoje && hoje !== h.valor ? ' is-apagado' : ''}`}
            onClick={() => marcar(h.valor)}
          >
            <span aria-hidden="true">{h.emoji}</span>
          </button>
        ))}
      </div>
      <span className="home-humor-nota">
        Só você vê a sua resposta.
        {veResumoHumor(user) && <> · <Link to="/humor">Ver o humor da equipe</Link></>}
      </span>
      {erro && <span className="home-humor-erro" role="alert">{erro}</span>}
    </section>
  );
}
