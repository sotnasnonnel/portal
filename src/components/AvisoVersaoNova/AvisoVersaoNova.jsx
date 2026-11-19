// ---------------------------------------------------------------------------
// AvisoVersaoNova — cartão no canto inferior direito pedindo F5 quando sai uma
// publicação nova (regra em utils/versaoApp.js, checagem em
// hooks/useVersaoNova.js). Pedido de 19/11/2026: o pessoal deixa a aba aberta
// e fica dias numa versão velha. Mesmo cartão do app-phd.
//
// Não recarrega sozinho: a pessoa pode estar no meio de uma edição.
// "Depois" esconde por ADIAR_MS e o cartão volta.
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import useVersaoNova from '../../hooks/useVersaoNova.js';
import { ADIAR_MS } from '../../utils/versaoApp.js';
import './AvisoVersaoNova.css';

export default function AvisoVersaoNova() {
  const versaoNova = useVersaoNova();
  const [adiado, setAdiado] = useState(false);

  // Passado o tempo do "Depois", o cartão aparece de novo.
  useEffect(() => {
    if (!adiado) return undefined;
    const t = setTimeout(() => setAdiado(false), ADIAR_MS);
    return () => clearTimeout(t);
  }, [adiado]);

  if (!versaoNova || adiado) return null;

  return (
    <div className="aviso-versao" role="status" aria-live="polite">
      <div className="aviso-versao__titulo">
        <RefreshCw size={15} />
        Versão nova disponível
      </div>
      <p className="aviso-versao__texto">
        Atualize a página para ver as últimas mudanças. Salve o que estiver editando antes.
      </p>
      <div className="aviso-versao__acoes">
        <button type="button" className="aviso-versao__btn aviso-versao__btn--primario" onClick={() => window.location.reload()}>
          Atualizar agora
        </button>
        <button type="button" className="aviso-versao__btn aviso-versao__btn--secundario" onClick={() => setAdiado(true)}>
          Depois
        </button>
      </div>
    </div>
  );
}
