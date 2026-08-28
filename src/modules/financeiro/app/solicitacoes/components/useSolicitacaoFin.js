import { useState } from 'react';
import { useAuth } from '../../../../../contexts/AuthContext';
import { criarSolicitacaoFin } from '../criarSolicitacao';

/**
 * Encanamento comum aos formulários do Financeiro: aceite dos termos e envio.
 * Os campos ficam por conta de cada formulário (Cartão e Aumento de Limite são
 * diferentes), e quem checa a cadeia de aprovação é a prévia (PreviaAprovacao),
 * pelo mesmo caminho que a criação usa.
 */
export function useSolicitacaoFin(sol) {
  const { user } = useAuth();
  const [aceite, setAceite] = useState(null);      // { em } quando aceito
  const [termosOpen, setTermosOpen] = useState(false);
  const [aceiteCheck, setAceiteCheck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sucesso, setSucesso] = useState(null);    // { numero }

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
      alert(err.message || 'Erro ao enviar a solicitação. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    user, aceite, termosOpen, setTermosOpen, aceiteCheck, setAceiteCheck,
    confirmarTermos, submitting, sucesso, setSucesso, enviar,
  };
}
