import { useCallback, useEffect, useState } from 'react';
import { carregarBase } from './alojamentos';

export const BASE_VAZIA = { alojamentos: [], estadias: [], pagamentos: [], itens: [], ocorrencias: [] };

/**
 * A base que toda tela do módulo lê. `recarregar` roda depois de cada gravação
 * e NÃO volta a `carregando`: a tela fica no lugar, sem piscar o aviso de carga.
 */
export function useBase() {
  const [base, setBase] = useState(BASE_VAZIA);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async () => {
    try {
      setBase(await carregarBase());
      setErro('');
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  return { base, carregando, erro, recarregar };
}
