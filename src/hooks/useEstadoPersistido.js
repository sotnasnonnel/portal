import { useEffect, useState } from 'react';

/**
 * Estado que sobrevive à troca de tela — guardado no sessionStorage.
 *
 * Nasceu dos filtros do Atendimento: o time filtra a Fila, abre um chamado
 * para avaliar, volta, e o filtro tinha sumido — refeito a cada chamado.
 *
 * SESSION e não local, de propósito. O filtro dura enquanto a aba estiver
 * aberta (troca de tela e F5 inclusive) e some ao fechar o navegador. Com
 * localStorage, um "criado entre 01 e 05/09" esquecido ainda estaria aplicado
 * na semana seguinte, e a Fila — que é a lista de trabalho do dia — abriria
 * escondendo chamado sem ninguém perceber.
 *
 * `restaurar` recebe o que estava guardado e devolve o valor a usar. É onde se
 * descarta dado velho ou malformado: o guardado é de outra versão do portal, e
 * confiar nele cegamente é o jeito de uma tela quebrar só na máquina de alguém.
 *
 * `ignorarSalvo` começa do `inicial` mesmo havendo algo guardado — para quando
 * a navegação já traz uma intenção explícita (um link que abre a Fila filtrada).
 * O novo valor passa a ser o guardado.
 *
 * Nunca lança: sem storage (aba anônima restrita, cota cheia) o estado só não
 * persiste, e a tela funciona como antes.
 */
export function useEstadoPersistido(chave, inicial, { restaurar = (v) => v, ignorarSalvo = false } = {}) {
  const [valor, setValor] = useState(() => {
    if (!chave || ignorarSalvo) return inicial;
    try {
      const cru = window.sessionStorage.getItem(chave);
      return cru === null ? inicial : restaurar(JSON.parse(cru));
    } catch {
      return inicial;
    }
  });

  useEffect(() => {
    if (!chave) return;
    try {
      window.sessionStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      // Sem storage o filtro só não persiste — não é motivo para derrubar a tela.
    }
  }, [chave, valor]);

  return [valor, setValor];
}
