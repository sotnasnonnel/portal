import { FileText } from "lucide-react";
import { isPdfAnexo } from "../lib/image.js";
import "./NfAnexoPreview.css";

/**
 * Miniatura de uma nota anexada. Existe porque o anexo deixou de ser sempre
 * imagem: nota em PDF não renderiza em `<img>`, e mostrar o quadrado quebrado
 * fazia parecer que o anexo tinha se perdido.
 *
 * - imagem -> miniatura clicável, que abre no lightbox da própria tela;
 * - PDF    -> um bloco com o ícone, que abre o arquivo em outra aba (é o
 *             visualizador do navegador que sabe desenhar PDF, não nós).
 *
 * `src` é o dataUrl (nota recém-anexada, ainda não salva) ou a URL assinada do
 * bucket. Sem `src`, não renderiza nada.
 */
export default function NfAnexoPreview({ img, label, src, onOpenImage }) {
  const alvo = src ?? img?.dataUrl ?? img?.url ?? img?.ref?.value ?? null;
  if (!alvo) return null;

  if (isPdfAnexo({ ...img, dataUrl: img?.dataUrl, url: alvo })) {
    return (
      <button
        type="button"
        className="nf-pdf-tile"
        onClick={() => window.open(alvo, "_blank", "noopener")}
        title="Abrir o PDF em outra aba"
      >
        <FileText size={20} aria-hidden="true" />
        <span>PDF</span>
      </button>
    );
  }

  return (
    <img
      src={alvo}
      alt={label}
      title="Clique para abrir"
      role="button"
      tabIndex={0}
      onClick={() => onOpenImage?.({ src: alvo, alt: label })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenImage?.({ src: alvo, alt: label });
        }
      }}
    />
  );
}
