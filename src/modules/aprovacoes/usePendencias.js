import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { listarPendencias, EVENTO_APROVACOES } from './lib/fontes';

// O que espera a decisão do usuário — o número do atalho na barra e a caixa
// "Para você aprovar" da Home, que mostra os primeiros itens.
//
// Contar exige ler os sete módulos, e o atalho está em toda tela. Por isso a
// leitura fica em cache por alguns minutos, compartilhada entre as instâncias
// (a barra e a Home não leem duas vezes), e só é refeita antes do prazo quando
// alguém decide algo — pelo evento que decidirPendencia dispara.
const VALIDADE_MS = 3 * 60 * 1000;
let cache = { dono: null, em: 0, itens: [], promessa: null };

async function ler(ctx, forcar) {
  const dono = ctx.user.id;
  const fresco = cache.dono === dono && Date.now() - cache.em < VALIDADE_MS;
  if (!forcar && fresco) return cache.itens;
  if (!forcar && cache.dono === dono && cache.promessa) return cache.promessa;
  cache.dono = dono;
  cache.promessa = listarPendencias(ctx)
    .then(({ itens }) => {
      cache = { dono, em: Date.now(), itens, promessa: null };
      return itens;
    })
    .catch(() => {
      cache.promessa = null;
      return cache.itens;
    });
  return cache.promessa;
}

/** Os itens pendentes; `carregado` só fica true depois da primeira leitura. */
export function usePendenciasLista() {
  const { user, reembolsoProfile } = useAuth();
  const doCache = cache.dono === user?.id && cache.em > 0;
  const [estado, setEstado] = useState(() => ({ itens: doCache ? cache.itens : [], carregado: doCache }));

  const recarregar = useCallback(async (forcar = false) => {
    if (!user?.id) return;
    const itens = await ler({ user, reembolsoProfile }, forcar);
    setEstado({ itens, carregado: true });
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

  return estado;
}

/** Só o número — o atalho da barra. */
export function usePendenciasAprovacao() {
  return usePendenciasLista().itens.length;
}
