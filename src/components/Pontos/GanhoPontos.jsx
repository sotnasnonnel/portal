import { useEffect, useRef } from 'react';
import { Star } from 'lucide-react';

// "+10 pts" que aparece no meio da tela, sobe um pouco e voa até o contador
// de pontos (o elemento com data-pontos-alvo que estiver visível: o botão da
// Home ou o saldo da Personalização). Ao chegar, o contador dá um pulo e o
// contexto soma o valor contando. Sem contador na tela, só sobe e some.
export default function GanhoPontos({ ganho, onChegou }) {
  const ref = useRef(null);
  const chegou = useRef(onChegou);
  useEffect(() => { chegou.current = onChegou; });

  useEffect(() => {
    const el = ref.current;
    const fim = () => chegou.current(ganho);
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { fim(); return undefined; }

    // O login do dia chega junto com a abertura da Home: com a página ainda
    // carregando, a animação travava no lugar. Espera a página terminar e o
    // contador aparecer (até ~4 s) e sai com um pequeno respiro.
    let anim;
    let espera;
    const acharAlvo = () => [...document.querySelectorAll('[data-pontos-alvo]')].find((e) => e.getClientRects().length > 0);
    let tentativas = 0;
    const tentar = () => {
      const alvo = acharAlvo();
      const pronta = document.readyState === 'complete';
      if ((!alvo || !pronta) && tentativas < 40) { tentativas += 1; espera = setTimeout(tentar, 100); return; }
      espera = setTimeout(() => voar(alvo), 350);
    };

    const x0 = window.innerWidth / 2;
    const y0 = window.innerHeight * 0.6;
    const pos = (x, y, esc) => `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${esc})`;

    const voar = (alvo) => {
      if (alvo) {
        const r = alvo.getBoundingClientRect();
        const x1 = r.left + r.width / 2;
        const y1 = r.top + r.height / 2;
        anim = el.animate([
          { transform: pos(x0, y0 + 30, 0.6), opacity: 0 },
          { transform: pos(x0, y0, 1.15), opacity: 1, offset: 0.18 },
          { transform: pos(x0, y0 - 36, 1), opacity: 1, offset: 0.45 },
          { transform: pos(x1, y1, 0.45), opacity: 0.85 },
        ], { duration: 1500, easing: 'cubic-bezier(.55, 0, .3, 1)', fill: 'forwards' });
        anim.onfinish = () => {
          alvo.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
          fim();
        };
      } else {
        anim = el.animate([
          { transform: pos(x0, y0 + 30, 0.6), opacity: 0 },
          { transform: pos(x0, y0, 1.15), opacity: 1, offset: 0.2 },
          { transform: pos(x0, y0 - 120, 1), opacity: 0 },
        ], { duration: 1600, easing: 'ease-out', fill: 'forwards' });
        anim.onfinish = fim;
      }
    };
    tentar();
    // Cancelar (sair da tela, StrictMode) não conta como chegada.
    return () => { clearTimeout(espera); anim?.cancel(); };
  }, [ganho]);

  return (
    <>
      <div ref={ref} className="pts-ganho" aria-hidden="true">
        <Star size={20} /> +{ganho.valor} <small>pts</small>
      </div>
      <span className="pts-ganho-leitor" role="status">Você ganhou {ganho.valor} pontos.</span>
    </>
  );
}
