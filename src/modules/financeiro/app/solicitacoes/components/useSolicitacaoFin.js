import { useState, useEffect } from 'react';
import { useAuth } from '../../../../../contexts/AuthContext';
import { buscarFluxoFin } from '../../../../../config/aprovacaoFinanceiro';
import { criarSolicitacaoFin } from '../criarSolicitacao';

/**
 * Encanamento comum aos formulários do Financeiro: pré-checagem do fluxo,
 * aceite dos termos e envio. Os campos ficam por conta de cada formulário
 * (Cartão Virtual e Aumento de Limite são diferentes).
 */
export function useSolicitacaoFin(sol) {
  const { user } = useAuth();
  const [aceite, setAceite] = useState(null);      // { em } quando aceito
  const [termosOpen, setTermosOpen] = useState(false);
  const [aceiteCheck, setAceiteCheck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sucesso, setSucesso] = useState(null);    // { numero }
  const [fluxoOk, setFluxoOk] = useState(null);    // null = checando

  // Pré-checa se há cadeia de aprovação configurada p/ este solicitante+tipo.
  useEffect(() => {
    if (!user?.id) return undefined;
    let vivo = true;
    (async () => {
      const { fluxo, erro } = await buscarFluxoFin(user.id, sol.tipoDb);
      if (vivo) setFluxoOk(erro ? true : !!fluxo); // erro de rede não bloqueia
    })();
    return () => { vivo = false; };
  }, [user, sol.tipoDb]);

  const semFluxo = fluxoOk === false;

  const confirmarTermos = () => {
    if (!aceiteCheck) return;
    setAceite({ em: new Date().toISOString() });
    setTermosOpen(false);
  };

  /** Envia. `envelope` traz só os campos do formulário; o aceite entra aqui. */
  const enviar = async (envelope, aoConcluir) => {
    setSubmitting(true);
    try {
      const criada = await criarSolicitacaoFin({
        tipoDb: sol.tipoDb,
        solicitanteId: user.id,
        envelope: { ...envelope, aceite_termos: true, aceite_termos_em: aceite.em },
      });
      setSucesso({ numero: criada?.numero });
      setAceite(null);
      setAceiteCheck(false);
      aoConcluir?.();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      if (err.message === 'SEM_FLUXO') {
        setFluxoOk(false);
        alert('Ainda não há um fluxo de aprovação configurado para você neste tipo. Solicite ao Financeiro.');
      } else {
        alert(err.message || 'Erro ao enviar a solicitação. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return {
    user, aceite, termosOpen, setTermosOpen, aceiteCheck, setAceiteCheck,
    confirmarTermos, submitting, sucesso, setSucesso, semFluxo, enviar,
  };
}
