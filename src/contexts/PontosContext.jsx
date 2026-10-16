import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { meuResumo, registrarAcesso } from '../services/pontos';
import { chaveTema, diaDeSustos, temaNoMes } from '../config/pontos';
import DecoTema from '../components/Pontos/DecoTema';
import GanhoPontos from '../components/Pontos/GanhoPontos';
import SustosHalloween from '../components/Pontos/SustosHalloween';

// Personalização do usuário logado: saldo de pontos, o que pegou e o que está
// usando. Ao abrir o portal registra o login do dia (o banco não paga duas
// vezes) e aplica o tema escolhido no <html> (data-pts-tema; o CSS está em
// styles/pontos.css), só no mês do tema: passado o mês, o portal volta ao
// visual padrão sozinho.
//
// Quando o saldo SOBE, o ganho vira animação (GanhoPontos): o "+N" voa até o
// contador e só então o número na tela soma, contando. Por isso há dois
// saldos: `saldoReal` (o do banco, para regras como "faltam X") e `saldo`
// (o que a tela mostra, atrasado até a animação chegar).
//
// A lojinha pode EXPERIMENTAR um tema sem comprar: previaTema troca o tema
// enquanto a pessoa olha, e volta ao dela quando sai.
const PontosContext = createContext(null);

export function PontosProvider({ children }) {
  const { user } = useAuth();
  const [resumo, setResumo] = useState(null);
  const [previaTema, setPreviaTema] = useState(undefined);
  const [visivel, setVisivel] = useState(null);
  const [ganhos, setGanhos] = useState([]);
  const [sustoTeste, setSustoTeste] = useState(0);
  const ultimo = useRef(null);

  // Recebe o resumo novo: se o saldo subiu, enfileira a animação; se desceu
  // (troca na lojinha), o número muda na hora.
  const aplicar = useCallback((r, ganhoInicial = 0) => {
    setResumo(r);
    const novo = r?.saldo ?? null;
    if (novo === null) return;
    const antes = ultimo.current ?? novo - ganhoInicial;
    ultimo.current = novo;
    if (novo > antes) {
      setVisivel((v) => v ?? antes);
      setGanhos((g) => [...g, { id: `${Date.now()}-${novo}`, valor: novo - antes, de: antes, para: novo }]);
    } else {
      setVisivel(novo);
    }
  }, []);

  const recarregar = useCallback(async () => {
    try {
      aplicar(await meuResumo());
    } catch {
      // Sem a migration (ou banco fora): o portal segue, só sem pontos.
    }
  }, [aplicar]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let vivo = true;
    ultimo.current = null;
    let ganhou = 0;
    registrarAcesso()
      .then((a) => { ganhou = a?.ganhou || 0; })
      .catch(() => {})
      .then(() => meuResumo())
      .then((r) => { if (vivo) aplicar(r, ganhou); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [user?.id, aplicar]);

  // O "+N" chegou ao contador: soma contando, em ~0,7 s.
  const chegou = useCallback((g) => {
    const t0 = performance.now();
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      setVisivel(Math.round(g.de + (g.para - g.de) * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(passo);
      else setGanhos((fila) => fila.filter((x) => x.id !== g.id));
    };
    requestAnimationFrame(passo);
  }, []);

  const meuTema = user?.id && temaNoMes(resumo?.perfil?.tema) ? resumo.perfil.tema : null;
  const tema = chaveTema(previaTema !== undefined ? previaTema : meuTema);
  useEffect(() => {
    const raiz = document.documentElement;
    if (tema) raiz.dataset.ptsTema = tema;
    else delete raiz.dataset.ptsTema;
  }, [tema]);

  // Sem usuário (logout), nada do anterior aparece.
  const meu = user?.id ? resumo : null;
  const value = useMemo(() => ({
    resumo: meu,
    perfil: meu?.perfil ?? {},
    saldo: meu ? (visivel ?? meu.saldo ?? null) : null,
    saldoReal: meu?.saldo ?? null,
    sequencia: meu?.sequencia ?? 0,
    recarregar,
    setPreviaTema,
    // Botão de teste dos sustos (super admin): solta um agora.
    testarSusto: () => setSustoTeste(Date.now()),
  }), [meu, visivel, recarregar]);

  return (
    <PontosContext.Provider value={value}>
      {children}
      <DecoTema tema={tema} />
      {/* Sustos: só no dia 30 de outubro, com o Halloween valendo de verdade
          (não na prévia) e para quem disse "sim". */}
      {meuTema === 'th-halloween' && previaTema === undefined && resumo?.perfil?.sustos && diaDeSustos() && <SustosHalloween />}
      {sustoTeste > 0 && <SustosHalloween key={sustoTeste} teste onFim={() => setSustoTeste(0)} />}
      {/* Um ganho por vez: o próximo sai quando o anterior chega. */}
      {user?.id && ganhos[0] && <GanhoPontos key={ganhos[0].id} ganho={ganhos[0]} onChegou={chegou} />}
    </PontosContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- o hook mora com o provider, como useAuth
export function usePontos() {
  return useContext(PontosContext) || { resumo: null, perfil: {}, saldo: null, saldoReal: null, sequencia: 0, recarregar: () => {}, setPreviaTema: () => {}, testarSusto: () => {} };
}
