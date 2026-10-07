import { useCallback, useEffect, useState } from 'react';
import { Check, MinusCircle, User } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { listarEtapasDoProcesso, listarComentariosDasEtapas } from '../../../mobilizacao/lib/mobilizacao';
import { rotuloStatus, ehEncerrada } from '../../../mobilizacao/lib/statusEtapa';
import ComentariosEtapa from '../../../mobilizacao/app/components/ComentariosEtapa';
import '../../../mobilizacao/mobilizacao.css';

const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

/**
 * Passo a passo do processo de mobilização dentro do chamado (pedido da
 * Edijane, 07/10/2026: "não preciso colocar as informações em dois lugares").
 * As etapas são só leitura — mover etapa continua sendo no processo —, mas os
 * comentários são os MESMOS do processo: o que se escreve aqui aparece lá, e
 * vice-versa. A RLS da etapa decide quem lê e quem comenta.
 *
 * Silencioso: falhar aqui deixa só o resumo do processo, que já está acima.
 */
export default function EtapasDoProcesso({ processoId }) {
  const { user } = useAuth();
  const [etapas, setEtapas] = useState(null);
  const [comentarios, setComentarios] = useState(new Map());

  // Etapas e comentários juntos; devolve null na falha (a seção some).
  const buscar = useCallback(async () => {
    try {
      const e = await listarEtapasDoProcesso(processoId);
      return { e, c: await listarComentariosDasEtapas(e.map((x) => x.id)) };
    } catch {
      return null;
    }
  }, [processoId]);

  const aplicar = (r) => {
    setEtapas(r?.e || []);
    setComentarios(r?.c || new Map());
  };

  // Depois de comentar: recarrega para o comentário novo aparecer.
  const carregar = async () => aplicar(await buscar());

  useEffect(() => {
    let vivo = true;
    buscar().then((r) => { if (vivo) aplicar(r); });
    return () => { vivo = false; };
  }, [buscar]);

  if (!etapas?.length) return null;

  return (
    <div className="mobRoot mob-embutido">
      <div className="mob-etapas">
        {etapas.map((e) => {
          const dispensada = e.status === 'dispensada';
          return (
            <article key={e.id}
              className={`mob-etapa ${ehEncerrada(e.status) ? 'is-concluida' : ''} ${dispensada ? 'is-dispensada' : ''}`}>
              <span className="mob-etapa-ord">
                {dispensada ? <MinusCircle size={14} /> : ehEncerrada(e.status) ? <Check size={14} /> : e.ordem}
              </span>
              <div className="mob-etapa-txt">
                <div className="mob-etapa-tit">{e.titulo}</div>
                <div className="mob-etapa-meta">
                  <span>{rotuloStatus(e.status)}</span>
                  <span>Previsto: {dataBr(e.data_prevista)}</span>
                  {e.data_real && <span>Real: {dataBr(e.data_real)}</span>}
                  {e.responsavelNome && <span><User size={11} /> {e.responsavelNome}</span>}
                </div>
                <ComentariosEtapa
                  etapaId={e.id}
                  comentarios={comentarios.get(e.id) || []}
                  meuId={user?.id}
                  onEnviado={carregar}
                />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
