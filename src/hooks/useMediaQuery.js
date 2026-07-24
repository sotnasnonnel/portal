import { useEffect, useState } from 'react';

// true enquanto a media query casar. Existe para os casos em que o layout NAO da
// para resolver so no CSS — o Recharts, por exemplo, define legenda e eixos por
// prop, entao precisa saber em JS que a tela e estreita.
export function useMediaQuery(query) {
  const [casa, setCasa] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setCasa(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return casa;
}
