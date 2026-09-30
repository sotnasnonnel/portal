import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { listarPendencias, EVENTO_APROVACOES } from './lib/fontes';

// Quantas aprovações esperam o usuário — o número do atalho na barra e do card
// da Home.
//
// Contar exige ler os sete módulos, e o atalho está em toda tela. Por isso a
// leitura fica em cache por alguns minutos, compartilhada entre as instâncias
// (a barra e a Home não leem duas vezes), e só é refeita antes do prazo quando
// alguém decide algo — pelo evento que decidirPendencia dispara.
const VALIDADE_MS = 3 * 60 * 1000;
let cache = { dono: null, em: 0, total: 0, promessa: null };

async function contar(ctx, forcar) {
  const dono = ctx.user.id;
  const fresco = cache.dono === dono && Date.now() - cache.em < VALIDADE_MS;
  if (!forcar && fresco) return cache.total;
  if (!forcar && cache.dono === dono && cache.promessa) return cache.promessa;
  cache.dono = dono;
  cache.promessa = listarPendencias(ctx)
    .then(({ itens }) => {
      cache = { dono, em: Date.now(), total: itens.length, promessa: null };
      return itens.length;
    })
    .catch(() => {
      cache.promessa = null;
      return cache.total;
    });
  return cache.promessa;
}

export function usePendenciasAprovacao() {
  const { user, reembolsoProfile } = useAuth();
  const [total, setTotal] = useState(() => (cache.dono === user?.id ? cache.total : 0));

  const recarregar = useCallback(async (forcar = false) => {
    if (!user?.id) return;
    setTotal(await contar({ user, reembolsoProfile }, forcar));
  }, [user, reembolsoProfile]);

  useEffect(() => {
    // O estado só muda depois do await — não há render em cascata.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recarregar();
    const aoDecidir = () => recarregar(true);
    const aoVoltar = () => recarregar();
    window.addEventListener(EVENTO_APROVACOES, aoDecidir);
    window.addEventListener('focus', aoVoltar);
    return () => {
      window.removeEventListener(EVENTO_APROVACOES, aoDecidir);
      window.removeEventListener('focus', aoVoltar);
    };
  }, [recarregar]);

  return total;
}
