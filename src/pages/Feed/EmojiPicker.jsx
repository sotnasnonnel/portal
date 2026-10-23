import { useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';

// Seletor de emoji do modal de publicar, trazido do selink
// (selink-web/src/components/feed/EmojiPicker.tsx).
//
// Lista curada e fixa, sem biblioteca: um pacote de emoji custa centenas de KB
// para resolver busca e tom de pele que ninguém pediu. Só emoji de plano único
// (sem ZWJ nem tom de pele), que aparece igual no Windows, Android e iOS.
const GRUPOS = [
  {
    nome: 'Reações',
    emojis: ['😀', '😄', '😊', '🙂', '😉', '😍', '🤩', '😎', '🤔', '👏', '🙌', '👍', '🙏', '💪', '🤝', '👌'],
  },
  {
    nome: 'Obra e projeto',
    emojis: ['🏗️', '👷', '🧱', '🔨', '🛠️', '🔧', '📐', '📏', '🏢', '🏠', '🚜', '⚙️', '🧰', '⛏️', '🪛', '🔩'],
  },
  {
    nome: 'Sinais',
    emojis: ['🎉', '🔥', '✨', '💡', '⭐', '✅', '⚠️', '📈', '🚀', '🏆', '📣', '📌', '📊', '🌱', '♻️', '⚡'],
  },
];

/** Botão com painel de emojis. `onEscolher(emoji)`: quem chama decide onde inserir. */
export default function EmojiPicker({ onEscolher, desabilitado = false }) {
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef(null);
  const botaoRef = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (!raizRef.current?.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  // Escape fecha só o painel, não o modal em volta (que perderia o texto).
  const aoTeclar = (e) => {
    if (e.key !== 'Escape' || !aberto) return;
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setAberto(false);
    botaoRef.current?.focus();
  };

  return (
    <div ref={raizRef} className="feed-emoji" onKeyDown={aoTeclar}>
      <button ref={botaoRef} type="button" className="feed-ferramenta" onClick={() => setAberto((v) => !v)}
        disabled={desabilitado} aria-expanded={aberto} aria-haspopup="dialog" title="Inserir emoji">
        <Smile size={20} /> Emoji
      </button>
      {aberto && (
        // Abre para cima: o botão fica no rodapé do modal.
        <div className="feed-emoji-painel" role="dialog" aria-label="Emojis">
          {GRUPOS.map((g) => (
            <div key={g.nome} className="feed-emoji-grupo">
              <p>{g.nome}</p>
              <div className="feed-emoji-grade">
                {g.emojis.map((emoji) => (
                  // Fecha ao escolher: o painel cobre o texto, e o emoji entraria
                  // sem a pessoa ver onde. Para outro, um clique reabre.
                  <button key={emoji} type="button" aria-label={`Inserir ${emoji}`}
                    onClick={() => { onEscolher(emoji); setAberto(false); }}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
