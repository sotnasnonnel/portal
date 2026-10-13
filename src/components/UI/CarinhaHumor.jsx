import { humorPorValor } from '../../config/humor';

// Carinha do humor do dia, desenhada aqui em vez de emoji: o emoji muda de
// desenho em cada aparelho (no Windows ficava pequeno e apagado). A cor de
// fundo é a do nível em config/humor.js — a mesma do painel da equipe.

// Quadro de 40x40. Índice = valor - 1.
const BOCAS = [
  'M12 29 Q20 21 28 29',
  'M13 28 Q20 24 27 28',
  'M13 26 L27 26',
  'M12 23 Q20 30 28 23',
  'M11 22 Q20 34 29 22 Z',
];
// Pontas de dentro mais altas: tristeza, e não raiva (que é o contrário).
const SOBRANCELHAS = ['M10 14 L16 11 M30 14 L24 11', 'M11 13.5 L16 12 M29 13.5 L24 12'];

export default function CarinhaHumor({ valor, size = 28, className = '' }) {
  const h = humorPorValor(valor);
  if (!h) return null;
  const i = h.valor - 1;
  // O cinza do "Ok" é claro: traço escuro nele, branco nos outros.
  const traco = h.chave === 'ok' ? '#3d3d38' : '#ffffff';
  const boca = BOCAS[i];
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      fill="none"
      stroke={traco}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="20" cy="20" r="18" fill={h.cor} stroke="none" />
      {SOBRANCELHAS[i] && <path d={SOBRANCELHAS[i]} />}
      {h.chave === 'muito_feliz' ? (
        <path d="M12 17 Q14.5 14 17 17 M23 17 Q25.5 14 28 17" />
      ) : (
        <>
          <circle cx="14.5" cy="17" r="2" fill={traco} stroke="none" />
          <circle cx="25.5" cy="17" r="2" fill={traco} stroke="none" />
        </>
      )}
      <path d={boca} fill={boca.endsWith('Z') ? traco : 'none'} />
    </svg>
  );
}
