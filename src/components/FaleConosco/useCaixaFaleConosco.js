import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { ehSuporte } from '../../config/suporte';

// Quanta coisa está esperando resposta na caixa do Fale conosco.
//
// Existe porque uma fila com prazo precisa se anunciar: a notificação do sino
// é lida uma vez e some, mas o item continua aberto — e quem atende só
// descobriria o atraso abrindo a tela por conta própria. Com o número no botão,
// a fila cobra sozinha.
//
// Só consulta para quem ATENDE (duas pessoas): para todo o resto seria uma
// consulta por carregamento de página sem nada a mostrar.
export function useCaixaFaleConosco() {
  const { user } = useAuth();
  const atende = ehSuporte(user);
  const [estado, setEstado] = useState({ abertos: 0, atrasados: 0 });

  // Uma consulta só: traz o prazo dos abertos e conta os dois números aqui.
  // Duas consultas (total e vencidos) seriam duas idas ao banco para responder
  // a mesma pergunta.
  const recarregar = useCallback(async () => {
    if (!atende) return;
    const { data } = await supabase
      .from('fale_conosco')
      .select('prazo_em')
      .eq('status', 'aberto');
    const agora = Date.now();
    setEstado({
      abertos: data?.length ?? 0,
      atrasados: (data ?? []).filter((i) => new Date(i.prazo_em).getTime() < agora).length,
    });
  }, [atende]);

  useEffect(() => {
    // `recarregar` só mexe no estado depois do await — não há render em cascata.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recarregar();
  }, [recarregar]);

  return { atende, ...estado, recarregar };
}
