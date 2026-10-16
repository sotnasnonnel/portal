import { useCallback, useEffect, useRef, useState } from 'react';
import { IMG } from '../../config/pontosImagens';
import gritoA from '../../assets/pontos/sustos/grito-a.mp3';
import gritoB from '../../assets/pontos/sustos/grito-b.mp3';
import gritoC from '../../assets/pontos/sustos/grito-c.mp3';

// Sustos do tema Halloween, só no dia 30 de outubro e só para quem disse
// "sim" na Personalização (pontos_perfil.sustos; o dia é checado em
// PontosContext). Assustam de verdade: fotos de terror que pulam na tela,
// rosto surgindo do escuro, vulto com a luz falhando, aranha gigante, sempre
// com um GRITO alto: um dos três gravados (assets/pontos/sustos/grito-*.mp3,
// enviados pelo usuário, recortados e no mesmo volume), sorteado a cada susto;
// se não carregarem, um grito sintetizado aqui mesmo.
// Regras para não atrapalhar o trabalho:
//  - raros: o primeiro depois de 1–2 min, os outros a cada 3–7 min;
//  - curtos (1,5–2,6 s), não bloqueiam clique (clicar ou Esc encerra);
//  - nunca com a pessoa digitando, com popup aberto ou com a aba escondida;
//  - quem pede menos animação no sistema não recebe nenhum.
// Cada susto: a foto (chave de IMG) e quando o grito entra (ms do início).
const SUSTOS = {
  mulher: { foto: 'sustoMulher', dura: 1500, grito: 60 },
  grito: { foto: 'sustoGrito', dura: 1500, grito: 60 },
  sorriso: { foto: 'sustoSorriso', dura: 2900, grito: 1750 },
  porta: { foto: 'sustoPorta', dura: 2600, grito: 1500 },
  aranha: { foto: null, dura: 2200, grito: 420 },
};
const TIPOS = Object.keys(SUSTOS);
const sorteio = (min, max) => min + Math.random() * (max - min);

function ocupado() {
  if (document.hidden) return true;
  const el = document.activeElement;
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return true;
  return !!document.querySelector('[role="dialog"], [aria-modal="true"]');
}

// ---------------------------------------------------------------- o grito
let ctx = null;
function audio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function curvaDistorcao(k) {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / n - 1;
    c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return c;
}

// Gritos gravados, já decodificados para tocar sem atraso.
let gravados = [];
async function carregarGritos() {
  const a = audio();
  if (!a || gravados.length) return;
  const lista = await Promise.all([gritoA, gritoB, gritoC].map(async (url) => {
    try {
      const resp = await fetch(url);
      return await a.decodeAudioData(await resp.arrayBuffer());
    } catch {
      return null;
    }
  }));
  gravados = lista.filter(Boolean);
}

function tocarGravado() {
  const a = audio();
  if (!a || a.state !== 'running' || gravados.length === 0) return false;
  const som = a.createBufferSource();
  som.buffer = gravados[Math.floor(Math.random() * gravados.length)];
  som.connect(a.destination);
  som.start();
  return true;
}

/** Grito alto: um dos gravados; sem eles, vozes sintetizadas com distorção. */
function gritar(dur = 1.4) {
  if (tocarGravado()) return;
  const a = audio();
  if (!a || a.state !== 'running') return;
  const t = a.currentTime;

  const comp = a.createDynamicsCompressor();
  comp.threshold.value = -8;
  comp.ratio.value = 6;
  comp.connect(a.destination);

  const volume = a.createGain();
  volume.gain.setValueAtTime(0.0001, t);
  volume.gain.exponentialRampToValueAtTime(1, t + 0.03);
  volume.gain.setValueAtTime(1, t + dur * 0.65);
  volume.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  volume.connect(comp);

  const dist = a.createWaveShaper();
  dist.curve = curvaDistorcao(60);
  dist.oversample = '4x';
  dist.connect(volume);

  [0, 9, -7].forEach((detune) => {
    const voz = a.createOscillator();
    voz.type = 'sawtooth';
    voz.frequency.setValueAtTime(380, t);
    voz.frequency.exponentialRampToValueAtTime(1050, t + 0.12);
    voz.frequency.exponentialRampToValueAtTime(760, t + dur);
    voz.detune.value = detune * 12;
    const vib = a.createOscillator();
    vib.frequency.value = 8 + Math.random() * 3;
    const vibAmp = a.createGain();
    vibAmp.gain.value = 45;
    vib.connect(vibAmp);
    vibAmp.connect(voz.frequency);
    const boca = a.createBiquadFilter();
    boca.type = 'bandpass';
    boca.frequency.value = 1500;
    boca.Q.value = 1.1;
    voz.connect(boca);
    boca.connect(dist);
    voz.start(t);
    voz.stop(t + dur);
    vib.start(t);
    vib.stop(t + dur);
  });

  // rouquidão
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const dados = buf.getChannelData(0);
  for (let i = 0; i < dados.length; i += 1) dados[i] = Math.random() * 2 - 1;
  const ruido = a.createBufferSource();
  ruido.buffer = buf;
  const rf = a.createBiquadFilter();
  rf.type = 'bandpass';
  rf.frequency.value = 2200;
  rf.Q.value = 0.7;
  const rg = a.createGain();
  rg.gain.value = 0.7;
  ruido.connect(rf);
  rf.connect(rg);
  rg.connect(dist);
  ruido.start(t);
}

// `teste`: solta um susto na hora (botão do super admin na Personalização),
// sem agenda nem dia 30, e avisa `onFim` quando acaba.
export default function SustosHalloween({ teste = false, onFim }) {
  const [susto, setSusto] = useState(null);
  const fimTeste = useRef(onFim);
  useEffect(() => { fimTeste.current = onFim; });
  // Cada rodada agenda um susto; quando ele acaba, começa a próxima.
  const [rodada, setRodada] = useState(0);
  const ultimo = useRef(null);

  useEffect(() => {
    Object.values(SUSTOS).forEach(({ foto }) => { if (foto) { const im = new Image(); im.src = IMG[foto]; } });
  }, []);

  // O navegador só deixa tocar som depois de um clique ou tecla da pessoa:
  // o primeiro gesto já "destrava" o áudio para o grito poder tocar depois.
  useEffect(() => {
    const destravar = () => { audio(); carregarGritos(); };
    carregarGritos();
    window.addEventListener('pointerdown', destravar, { once: true });
    window.addEventListener('keydown', destravar, { once: true });
    return () => {
      window.removeEventListener('pointerdown', destravar);
      window.removeEventListener('keydown', destravar);
    };
  }, []);

  useEffect(() => {
    if (!teste) return undefined;
    let vivo = true;
    // Espera os gritos gravados carregarem para o teste já sair com o som certo.
    carregarGritos().finally(() => {
      if (!vivo) return;
      const tipo = TIPOS[Math.floor(Math.random() * TIPOS.length)];
      setSusto({ tipo, id: Date.now() });
    });
    return () => { vivo = false; };
  }, [teste]);

  useEffect(() => {
    if (teste || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let t;
    const tentar = () => {
      // Ocupado: tenta de novo daqui a pouco, sem perder a vez.
      if (ocupado()) { t = setTimeout(tentar, 20000); return; }
      // Nunca o mesmo susto duas vezes seguidas.
      const tipos = TIPOS.filter((x) => x !== ultimo.current);
      const tipo = tipos[Math.floor(Math.random() * tipos.length)];
      ultimo.current = tipo;
      setSusto({ tipo, id: Date.now() });
    };
    const espera = rodada === 0 ? sorteio(60, 120) : sorteio(180, 420);
    t = setTimeout(tentar, espera * 1000);
    return () => clearTimeout(t);
  }, [rodada, teste]);

  const acabar = useCallback(() => {
    setSusto(null);
    if (teste) fimTeste.current?.();
    else setRodada((r) => r + 1);
  }, [teste]);

  // Grito na hora certa; termina sozinho, ou com clique / Esc.
  useEffect(() => {
    if (!susto) return undefined;
    const cfg = SUSTOS[susto.tipo];
    const grito = setTimeout(() => gritar(susto.tipo === 'aranha' ? 1.1 : 1.4), cfg.grito);
    const fim = setTimeout(acabar, cfg.dura);
    const onKey = (e) => { if (e.key === 'Escape') acabar(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', acabar);
    return () => {
      clearTimeout(grito);
      clearTimeout(fim);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', acabar);
    };
  }, [susto, acabar]);

  if (!susto) return null;
  return (
    <div className={`pts-susto pts-susto-${susto.tipo}`} key={susto.id} aria-hidden="true">
      {SUSTOS[susto.tipo].foto && <img className="s-foto" src={IMG[SUSTOS[susto.tipo].foto]} alt="" />}
      {susto.tipo === 'aranha' && <span className="s-aranha"><i /><img src={IMG.aranha} alt="" /></span>}
    </div>
  );
}
