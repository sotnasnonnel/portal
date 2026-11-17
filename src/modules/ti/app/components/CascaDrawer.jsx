import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import '../ativos/ativos.css';

// Origem do foco do painel aberto (sobrevive à troca ficha <-> formulário).
let origemDoPainel = null;

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Casca do painel lateral. Esc, o X e o fundo fecham por `onFechar`.
 *
 * Foco: ao abrir, vai para dentro do painel (a não ser que um campo já tenha
 * pego com autoFocus); Tab circula só dentro dele; ao fechar, volta para quem
 * abriu (a linha da tabela, por exemplo). Trocar ficha <-> formulário remonta a
 * casca, e o foco faz o mesmo caminho sem se perder.
 */
export default function CascaDrawer({
  cabecalho, rodape, onFechar, children,
}) {
  const painel = useRef(null);
  // Lido no primeiro render, antes de o painel existir: é quem estava com o foco.
  const voltarPara = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  const idTitulo = useId();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onFechar(); return; }
      if (e.key !== 'Tab' || !painel.current) return;
      // Com a confirmação aberta, ela cuida do próprio Tab.
      if (painel.current.querySelector('.ti-modal')) return;
      const itens = [...painel.current.querySelectorAll(FOCAVEIS)].filter((el) => el.offsetParent !== null);
      if (!itens.length) return;
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const dentro = painel.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === primeiro || !dentro)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (document.activeElement === ultimo || !dentro)) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar]);

  useEffect(() => {
    const el = painel.current;
    const capturado = voltarPara.current;
    // Veio de outro painel (Editar na ficha): herda a origem dele, porque o
    // botão que abriu este já saiu da tela.
    const origem = capturado?.closest?.('.ti-drawer') ? origemDoPainel : capturado;
    origemDoPainel = origem;
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
    return () => {
      const ativo = document.activeElement;
      // Só devolve se o foco estava aqui (ou caiu no body com o painel saindo);
      // se outro painel já pegou o foco com autoFocus, deixa como está.
      const devolver = !ativo || ativo === document.body || el?.contains(ativo);
      if (devolver && origem && typeof origem.focus === 'function' && document.contains(origem)) {
        origem.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <>
      <div className="ti-scrim" onClick={onFechar} aria-hidden="true" />
      <aside
        ref={painel}
        className="ti-drawer ti-ativos-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
      >
        <div className="ti-dr-h">
          <div className="ti-dr-t" id={idTitulo}>{cabecalho}</div>
          <button type="button" className="ti-ibtn" onClick={onFechar} aria-label="Fechar painel" title="Fechar (Esc)"><X size={16} /></button>
        </div>
        <div className="ti-dr-b">{children}</div>
        {rodape && <div className="ti-dr-f">{rodape}</div>}
      </aside>
    </>
  );
}
