import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  decidirRota, indicePasso, passoAnterior, passoDe, passosDe, proximoPasso, rotuloContagem,
} from '../../config/tutoriais';
import TourOverlay from './TourOverlay';

// Passo a passo vivo (tutoriais em config/tutoriais.js). O estado mora só na
// memória, de propósito: recarregar a página encerra o tutorial, e ninguém
// fica preso num destaque que voltou sozinho depois de um F5.
//
// O provider fica dentro do HashRouter (AppRoutes) porque o tutorial
// atravessa rotas: o passo da Home manda para o /feed, e cada passo só
// aparece quando a rota dele bate (decidirRota). Enquanto não bate, o
// desenho some e o tutorial espera; ir para uma terceira rota encerra.
//
// Pausa: telas que abrem algo POR CIMA do que o tutorial aponta (termo do
// feed, boas-vindas, carregamento) chamam usePausaTour(true). É um contador,
// não um booleano: duas telas pausando ao mesmo tempo só liberam quando as
// duas soltarem. Pausado, o desenho some e nenhum relógio do motor corre.
const TourContext = createContext(null);
const PausaContext = createContext(null);

const FORA_DO_PROVIDER = { ativo: false, tourId: null, passoId: null, iniciar: () => {}, encerrar: () => {} };

// `tour`: null ou { tourId, passoId, inicio, origem, chegou, pulados }
//   inicio  passo onde começou (a contagem "1 de 6" parte dele)
//   origem  pathname de quando o passo atual começou
//   chegou  a rota do passo atual já bateu desde então
//   pulados opcionais que o motor pulou por falta de alvo (o Voltar não volta neles)
export function TourProvider({ children }) {
  const { pathname } = useLocation();
  const [tour, setTour] = useState(null);
  const [pausas, setPausas] = useState(0);

  // A rota de agora para quem muda de passo fora do render (clique no alvo,
  // botões do balão). Atualizada no commit: no clique do ícone da Home ela
  // ainda é /home, que é exatamente a origem do passo seguinte.
  const rotaRef = useRef(pathname);
  useLayoutEffect(() => { rotaRef.current = pathname; }, [pathname]);

  const iniciar = useCallback((tourId, { passo } = {}) => {
    const lista = passosDe(tourId);
    if (!lista.length) return;
    const inicio = passo && lista.some((p) => p.id === passo) ? passo : lista[0].id;
    const origem = rotaRef.current;
    setTour({ tourId, passoId: inicio, inicio, origem, chegou: passoDe(tourId, inicio).rota === origem, pulados: [] });
  }, []);

  const encerrar = useCallback(() => setTour(null), []);

  // Anda a partir de `deId` (o atual, ou um passo de clique mais adiante que a
  // pessoa já fez). Depois do último, encerra. `pulou`: o motor pulou um
  // opcional sem alvo.
  const avancar = useCallback((deId, { pulou = false } = {}) => {
    const origem = rotaRef.current;
    setTour((t) => {
      if (!t) return t;
      // Chamada atrasada (um quadro de animação que já tinha saído): não volta.
      if (indicePasso(t.tourId, deId) < indicePasso(t.tourId, t.passoId)) return t;
      const prox = proximoPasso(t.tourId, deId);
      if (!prox) return null;
      return {
        ...t,
        passoId: prox,
        origem,
        chegou: passoDe(t.tourId, prox).rota === origem,
        pulados: pulou ? [...t.pulados, deId] : t.pulados,
      };
    });
  }, []);

  // Pula direto para um passo: o Voltar e o `seSumir`.
  const irPara = useCallback((passoId) => {
    const origem = rotaRef.current;
    setTour((t) => (t && passoDe(t.tourId, passoId)
      ? { ...t, passoId, origem, chegou: passoDe(t.tourId, passoId).rota === origem }
      : t));
  }, []);

  const pausar = useCallback(() => {
    setPausas((n) => n + 1);
    let solto = false;
    return () => {
      if (solto) return;
      solto = true;
      setPausas((n) => n - 1);
    };
  }, []);

  // A rota decide se o passo aparece, espera ou acaba. A mudança de estado
  // acontece aqui mesmo, no render (o padrão do React para "estado que
  // depende de uma mudança de prop"), e não num efeito: assim o passo nunca
  // aparece um quadro na rota errada.
  const passo = tour ? passoDe(tour.tourId, tour.passoId) : null;
  const decisao = passo ? decidirRota({ rota: passo.rota, origem: tour.origem, chegou: tour.chegou, pathname }) : null;
  if (tour && (!passo || decisao === 'encerrar')) setTour(null);
  else if (decisao === 'mostrar' && !tour.chegou) setTour({ ...tour, chegou: true });

  const tourId = tour?.tourId ?? null;
  const passoId = tour?.passoId ?? null;
  const valor = useMemo(
    () => (tourId ? { ativo: true, tourId, passoId, iniciar, encerrar } : { ...FORA_DO_PROVIDER, iniciar, encerrar }),
    [tourId, passoId, iniciar, encerrar],
  );

  const visivel = decisao === 'mostrar' && pausas <= 0;

  return (
    <TourContext.Provider value={valor}>
      <PausaContext.Provider value={pausar}>
        {children}
        {visivel && (
          <TourOverlay
            tourId={tour.tourId}
            passo={passo}
            rotulo={rotuloContagem(tour.tourId, passo.id, tour.inicio, tour.pulados)}
            anterior={passoAnterior(tour.tourId, passo.id, tour.pulados)}
            ultimo={!proximoPasso(tour.tourId, passo.id)}
            onAvancar={avancar}
            onIrPara={irPara}
            onEncerrar={encerrar}
          />
        )}
      </PausaContext.Provider>
    </TourContext.Provider>
  );
}

/** { ativo, tourId, passoId, iniciar(tourId, { passo } = {}), encerrar() } */
// eslint-disable-next-line react-refresh/only-export-components -- o hook mora com o provider, como useAuth
export function useTour() {
  return useContext(TourContext) || FORA_DO_PROVIDER;
}

/**
 * Enquanto `pausado` for true neste componente, o desenho do tutorial some
 * (sem encerrar). Volta quando TODOS os que pausaram soltarem, ou quando o
 * componente desmonta.
 */
// eslint-disable-next-line react-refresh/only-export-components -- idem
export function usePausaTour(pausado) {
  const pausar = useContext(PausaContext);
  useEffect(() => {
    if (!pausado || !pausar) return undefined;
    return pausar();
  }, [pausado, pausar]);
}
