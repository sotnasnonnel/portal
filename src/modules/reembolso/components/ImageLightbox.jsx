import { useEffect } from "react";
import { X } from "lucide-react";
import "./ImageLightbox.css";

// Visualizador simples de imagem em tela cheia. Clique no fundo ou Esc fecha.
export default function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!src) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Fechar">
        <X size={24} />
      </button>
      <img
        className="lightbox-img"
        src={src}
        alt={alt || "Nota fiscal"}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
