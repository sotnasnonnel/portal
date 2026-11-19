// ---------------------------------------------------------------------------
// useVersaoNova — true quando saiu uma publicação depois que esta aba abriu.
//
// Confere version.json a cada INTERVALO_CHECAGEM_MS e sempre que a pessoa
// volta para a aba (quem deixa a página aberta o dia todo é justamente quem
// esquece o F5). Em `npm run dev` fica desligado: lá o Vite já recarrega sozinho.
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react';
import { haVersaoNova, INTERVALO_CHECAGEM_MS } from '../utils/versaoApp.js';

export default function useVersaoNova() {
  const [versaoNova, setVersaoNova] = useState(false);

  useEffect(() => {
    const versaoAtual = import.meta.env.VITE_VERSAO_APP;
    if (import.meta.env.DEV || !versaoAtual || versaoNova) return undefined;

    let vivo = true;
    const conferir = async () => {
      if (document.visibilityState === 'hidden') return; // aba escondida: confere quando voltar
      try {
        // Ao lado do index.html, na pasta do portal (document.baseURI ignora o
        // #rota do HashRouter). ?t= e no-store: vem o arquivo de agora, sem cópia guardada.
        const url = new URL(`version.json?t=${Date.now()}`, document.baseURI);
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) return;
        const json = await resp.json();
        if (vivo && haVersaoNova(versaoAtual, json)) setVersaoNova(true);
      } catch {
        // Sem internet ou servidor fora: tenta de novo na próxima volta, sem avisar nada.
      }
    };

    const aoVoltarParaAba = () => { if (document.visibilityState === 'visible') conferir(); };
    const timer = setInterval(conferir, INTERVALO_CHECAGEM_MS);
    document.addEventListener('visibilitychange', aoVoltarParaAba);
    window.addEventListener('focus', aoVoltarParaAba);
    conferir();

    return () => {
      vivo = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltarParaAba);
      window.removeEventListener('focus', aoVoltarParaAba);
    };
  }, [versaoNova]);

  return versaoNova;
}
