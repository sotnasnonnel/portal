import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MousePointerClick } from 'lucide-react';
import {
  cliquesAdiante, faixasEmVolta, passoDe, posicionarBalao, retanguloBuraco,
} from '../../config/tutoriais';
import './Tour.css';

// O desenho do passo a passo: véu escuro com um buraco em volta do alvo, anel
// pulsando, faixas que engolem cliques fora do buraco e o balão. Só fica
// montado enquanto o passo está à vista (rota certa, sem pausa); ao esconder,
// desmonta e para tudo, inclusive os relógios do opcional e do "desisto".
//
// O alvo é acompanhado a cada quadro (requestAnimationFrame): a página rola,
// o feed carrega foto, o modal cresce, e o buraco vai junto. O estado só muda
// quando algo mudou de verdade, então parado não há render.

const FOLGA = 8;                  // px entre o alvo e a borda do buraco
const PULA_OPCIONAL_MS = 1200;    // opcional sem alvo: some sozinho
const DESISTE_MS = 2500;          // obrigatório sem alvo: balão no meio da tela
const SUMIU_MS = 300;             // alvo que existia e sumiu (modal fechou)
const ANIMA_MS = 320;             // o buraco desliza de um passo para o outro
const CELULAR_PX = 600;           // abaixo disso, balão dos passos livres no pé da tela

const seletor = (alvo) => `[data-tour="${CSS.escape(alvo)}"]`;

/** O primeiro elemento do alvo que está desenhado (rect 0x0 conta como ausente). */
function acharAlvo(alvo) {
  for (const el of document.querySelectorAll(seletor(alvo))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { el, r };
  }
  return null;
}

const FOCAVEL = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
const focavelDe = (el) => (el.matches(FOCAVEL) ? el : el.querySelector(FOCAVEL));
const desabilitado = (el) => el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true';
const menosMovimento = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Nos passos livres a pessoa usa o modal enquanto lê, então o balão evita
// cobrir o diálogo em volta do alvo (posicionarBalao com `evitar`). E quando
// ela abre algo nele (a lista do "@", os emojis: os dois marcam
// aria-expanded), o balão e o véu saem da frente até fechar. Procura só nesse
// diálogo, para um menu aberto em outro canto da página não esconder nada.
const caixaDe = (el) => el.closest('[role="dialog"], [aria-modal="true"]');
const popupAberto = (el) => !!(caixaDe(el) || el).querySelector('[aria-expanded="true"]');

const arred = (r) => ({ top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) });
const chaveDe = (g) => [
  g.passoId, g.buraco?.top, g.buraco?.left, g.buraco?.width, g.buraco?.height, g.naTela, g.semAlvo,
  g.anima, g.recolhido, g.tela.largura, g.tela.altura, g.balao?.largura, g.balao?.altura,
  g.evitar?.top, g.evitar?.left, g.evitar?.width, g.evitar?.height,
].join('|');

export default function TourOverlay({ tourId, passo, rotulo, anterior, ultimo, onAvancar, onIrPara, onEncerrar }) {
  // geo: o que o último quadro mediu.
  //   buraco    retângulo do buraco (fica o do passo anterior até o novo alvo aparecer)
  //   naTela    o alvo DESTE passo está (ou acabou de estar) na tela
  //   semAlvo   desistiu de esperar o alvo: balão no meio, sem buraco
  const [geo, setGeo] = useState(null);
  const geoRef = useRef(null);
  const balaoRef = useRef(null);
  const proximoRef = useRef(null);
  const pularRef = useRef(null);
  const focouRef = useRef(null);
  const [treme, setTreme] = useState(0);
  const idTitulo = useId();
  const idTexto = useId();

  const clique = passo.acao === 'clique';
  const livre = !!passo.livre;

  // O laço de cada passo. Os contadores são do passo: trocar de passo (ou
  // voltar de uma pausa, que remonta o desenho) começa tudo do zero.
  useEffect(() => {
    let raf = 0;
    let antes = performance.now();
    let achou = false;
    let esperando = 0;     // ms à vista sem nunca ter achado o alvo
    let sumido = 0;        // ms desde que o alvo achado sumiu
    let mudou = false;     // já pediu outro passo: não pede de novo
    let animaAte = 0;
    let chave = '';

    const tick = (agora) => {
      // Teto no intervalo: aba escondida congela o rAF, e a volta não pode
      // contar o tempo fora como espera (pularia o opcional na hora). Não
      // menor que isso: janela coberta roda a poucos quadros por segundo, e
      // o relógio do opcional não pode andar devagar por causa disso.
      const dt = Math.min(agora - antes, 1000);
      antes = agora;
      const tela = { largura: document.documentElement.clientWidth, altura: document.documentElement.clientHeight };
      const achado = acharAlvo(passo.alvo);
      const ultimoGeo = geoRef.current;

      if (achado) {
        sumido = 0;
        if (!achou) {
          achou = true;
          const r = achado.r;
          const inteiro = r.top >= 0 && r.left >= 0 && r.bottom <= tela.altura && r.right <= tela.largura;
          if (!inteiro) achado.el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: menosMovimento() ? 'auto' : 'smooth' });
          // Desliza do buraco anterior até o novo. Se a página vai rolar, não:
          // o buraco acompanhar a rolagem já é o movimento, e a transição só
          // o faria correr atrás do alvo.
          if (inteiro && ultimoGeo?.buraco) animaAte = agora + ANIMA_MS;
        }
      } else if (achou) {
        sumido += dt;
        if (sumido > SUMIU_MS && passo.seSumir && !mudou) { mudou = true; onIrPara(passo.seSumir); }
      } else {
        esperando += dt;
        if (passo.opcional && esperando > PULA_OPCIONAL_MS && !mudou) { mudou = true; onAvancar(passo.id, { pulou: true }); }
      }

      const semAlvo = !achado && (achou ? sumido > SUMIU_MS : !passo.opcional && esperando > DESISTE_MS);
      const balao = balaoRef.current ? { largura: balaoRef.current.offsetWidth, altura: balaoRef.current.offsetHeight } : null;
      const caixa = livre && achado ? caixaDe(achado.el) : null;
      const novo = {
        passoId: passo.id,
        // Sumiu há pouco: o buraco fica onde estava (pode ser só um re-render).
        buraco: achado ? arred(retanguloBuraco(achado.r, FOLGA)) : (semAlvo ? null : ultimoGeo?.buraco ?? null),
        naTela: achou && !semAlvo,
        semAlvo,
        anima: agora < animaAte,
        recolhido: livre && !!achado && popupAberto(achado.el),
        evitar: caixa ? arred(caixa.getBoundingClientRect()) : null,
        tela,
        balao,
      };
      const k = chaveDe(novo);
      if (k !== chave) {
        chave = k;
        geoRef.current = novo;
        setGeo(novo);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [passo, livre, onAvancar, onIrPara]);

  // Passo de clique: anda quando a pessoa clica no destaque. Escuta na
  // captura do documento, antes de qualquer handler da tela, e não segura o
  // clique: ele segue normal (navega, abre o modal). Vale também o clique num
  // passo de clique mais adiante (publicou direto do "Escreva o seu post").
  // Botão desabilitado não conta (o Publicar sem texto).
  useEffect(() => {
    const alvos = cliquesAdiante(tourId, passo.id).map((id) => ({ id, sel: seletor(passoDe(tourId, id).alvo) }));
    if (!alvos.length) return undefined;
    const aoClicar = (e) => {
      // Ctrl/Cmd/Shift/meio abrem o link em outra aba: esta tela não muda, e
      // avançar deixaria o tour esperando uma rota que não vem.
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;
      for (const a of alvos) {
        const el = t.closest(a.sel);
        if (el && !desabilitado(el)) { onAvancar(a.id); return; }
      }
    };
    document.addEventListener('click', aoClicar, true);
    return () => document.removeEventListener('click', aoClicar, true);
  }, [tourId, passo, onAvancar]);

  // Esc encerra, menos nos passos livres: lá o Esc é do modal de publicar
  // (fecha a lista do "@", os emojis ou o próprio modal).
  useEffect(() => {
    if (livre) return undefined;
    const tecla = (e) => { if (e.key === 'Escape') onEncerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [livre, onEncerrar]);

  const doPasso = geo?.passoId === passo.id;
  const semAlvo = doPasso && geo.semAlvo;
  const pronto = doPasso && (geo.naTela || semAlvo) && !!geo.balao;

  // Foco, uma vez por passo, quando o balão aparece. Clique: no alvo (o Enter
  // aciona). Leitura: no "Próximo". Livre: em lugar nenhum, a pessoa está
  // digitando no modal.
  useEffect(() => {
    if (!pronto || focouRef.current === passo.id) return;
    focouRef.current = passo.id;
    if (livre) return;
    const achado = semAlvo ? null : acharAlvo(passo.alvo);
    const el = clique ? (achado && focavelDe(achado.el)) || pularRef.current : proximoRef.current;
    el?.focus({ preventScroll: true });
  }, [pronto, passo, livre, clique, semAlvo]);

  const tremer = () => setTreme((n) => (n % 2) + 1); // alterna 1/2: reinicia a animação

  const tela = geo?.tela;
  const buraco = semAlvo ? null : geo?.buraco;

  let pos = null;
  if (pronto && semAlvo) {
    pos = {
      top: Math.max(16, (tela.altura - geo.balao.altura) / 2),
      left: Math.max(16, (tela.largura - geo.balao.largura) / 2),
      lado: null,
      seta: null,
    };
  } else if (pronto && buraco && livre && tela.largura < CELULAR_PX) {
    // Celular, dentro do modal de publicar: não há lado livre, e em cima ou
    // embaixo o balão tapava o X, o texto digitado ou o Publicar. Preso no pé
    // da tela, cobre só o fundo; o recorte mostra onde é.
    pos = { top: tela.altura - geo.balao.altura - 16, left: 16, lado: null, seta: null };
  } else if (pronto && buraco) {
    pos = posicionarBalao({ alvo: buraco, balao: geo.balao, tela, evitar: doPasso ? geo.evitar : null });
  }

  const recolhido = doPasso && geo.recolhido;
  const classes = ['tour', livre && 'is-livre', recolhido && 'is-recolhido'].filter(Boolean).join(' ');
  const estiloSeta = pos?.seta ? { '--tour-seta': `${pos.seta.x ?? pos.seta.y}px` } : {};

  return createPortal(
    <div className={classes}>
      {buraco && (
        <div className={`tour-buraco${geo.anima ? ' is-anima' : ''}`} aria-hidden="true"
          style={{ transform: `translate(${buraco.left}px, ${buraco.top}px)`, width: buraco.width, height: buraco.height }}>
          <span className="tour-anel" />
        </div>
      )}
      {semAlvo && <div className="tour-veu" aria-hidden="true" />}

      {/* Fora do buraco nada recebe clique (menos nos passos livres). O
          mousedown não tira o foco de onde ele está; o clique sacode o balão
          para mostrar onde olhar. */}
      {!livre && tela && (buraco || semAlvo) && (
        semAlvo
          ? <div className="tour-faixa" style={{ inset: 0 }} onMouseDown={(e) => e.preventDefault()} onClick={tremer} aria-hidden="true" />
          : faixasEmVolta(buraco, tela).map((f, i) => (
            <div key={i} className="tour-faixa" style={f} onMouseDown={(e) => e.preventDefault()} onClick={tremer} aria-hidden="true" />
          ))
      )}

      <div
        ref={balaoRef}
        className={`tour-balao${pronto && pos ? ' is-pronto' : ''}`}
        role="dialog"
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
        aria-live="polite"
        data-lado={pos?.seta ? pos.lado : undefined}
        data-treme={treme || undefined}
        style={{ top: pos?.top ?? 16, left: pos?.left ?? 16, ...estiloSeta }}
      >
        {pos?.seta && <span className="tour-seta" aria-hidden="true" />}
        <p className="tour-contagem">{rotulo}</p>
        <h2 id={idTitulo} className="tour-titulo">{passo.titulo}</h2>
        <p id={idTexto} className="tour-texto">{passo.texto}</p>
        {clique && !semAlvo && (
          <p className="tour-selo"><MousePointerClick size={15} aria-hidden="true" /> Clique no destaque</p>
        )}
        <div className="tour-rodape">
          <button ref={pularRef} type="button" className="tour-pular" onClick={onEncerrar}>Pular tutorial</button>
          <div className="tour-nav">
            {anterior && (
              <button type="button" className="tour-btn is-sec" onClick={() => onIrPara(anterior)}>Voltar</button>
            )}
            {!clique && (
              <button ref={proximoRef} type="button" className="tour-btn" onClick={() => onAvancar(passo.id)}>
                {ultimo ? 'Concluir' : 'Próximo'}
              </button>
            )}
            {/* Último passo de clique: o Publicar fica desabilitado sem texto
                nem foto, e clique em botão desabilitado nem chega aqui. */}
            {clique && ultimo && (
              <button type="button" className="tour-btn is-sec" onClick={onEncerrar}>Concluir</button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
