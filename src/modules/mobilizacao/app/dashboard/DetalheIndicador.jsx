import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { rotuloFluxoCurto } from '../../../../config/mobilizacao';

const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const atraso = (d) => (Number(d) === 1 ? '1 dia' : `${Number(d)} dias`);

/**
 * O detalhe por trás dos cards "Processos travados" e "Etapas vencidas".
 *
 * Um número num card só vira ação quando dá para responder "quais?". Antes,
 * quem via "7 etapas vencidas" tinha de ir à lista de Etapas e refazer o filtro
 * à mão para chegar nas mesmas sete — e não havia garantia de chegar.
 *
 * É só leitura: daqui se navega para o processo, e é lá que se age. Um popup
 * que edita esconderia a mudança de quem está olhando o indicador ao lado.
 */
export default function DetalheIndicador({ titulo, descricao, tipo, itens, onFechar }) {
  const fecharRef = useRef(null);

  // Esc fecha, e o foco começa no botão de fechar: quem abriu por teclado
  // precisa conseguir sair por teclado.
  useEffect(() => {
    fecharRef.current?.focus();
    const aoTeclar = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  return (
    <div className="mob-modal-fundo" role="presentation" onClick={onFechar}>
      {/* stopPropagation: clicar DENTRO do painel não pode fechar. */}
      <div className="mob-modal" role="dialog" aria-modal="true" aria-label={titulo}
        onClick={(e) => e.stopPropagation()}>
        <header className="mob-modal-cab">
          <div>
            <h2 className="mob-modal-tit">{titulo}</h2>
            <p className="mob-modal-sub">{descricao}</p>
          </div>
          <button type="button" ref={fecharRef} className="mob-btn mob-btn-ghost mob-btn-sm"
            onClick={onFechar} aria-label="Fechar">
            <X size={16} />
          </button>
        </header>

        <div className="mob-modal-corpo">
          {!itens.length ? (
            <p className="mob-campo-dica">Nada por aqui — e isso é uma boa notícia.</p>
          ) : (
            <div className="mob-tabela-scroll">
              <table className="mob-tabela">
                <thead>
                  {tipo === 'processos' ? (
                    <tr>
                      <th>#</th><th>Processo</th><th>Fluxo</th>
                      <th className="num">Etapas vencidas</th><th className="num">Pior atraso</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Etapa</th><th>Processo</th><th>Responsável</th>
                      <th className="num">Previsto</th><th className="num">Atraso</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {tipo === 'processos' ? itens.map((p) => (
                    <tr key={p.id}>
                      <td className="num">{p.numero ?? '—'}</td>
                      <td><Link to={`/mobilizacao/processo/${p.id}`} onClick={onFechar}>{p.titulo || '—'}</Link></td>
                      <td>{rotuloFluxoCurto(p.fluxo)}</td>
                      <td className="num">{p.etapas.length}</td>
                      <td className="num is-vencido">{atraso(p.piorAtraso)}</td>
                    </tr>
                  )) : itens.map((e) => (
                    <tr key={e.id}>
                      <td><Link to={`/mobilizacao/processo/${e.processo_id}`} onClick={onFechar}>{e.titulo}</Link></td>
                      <td>{e.processoTitulo || '—'}</td>
                      <td>
                        {e.responsavelNome || <span className="mob-cartao-sem-dono">sem responsável</span>}
                      </td>
                      <td className="num">{dataBr(e.data_prevista)}</td>
                      <td className="num is-vencido">{atraso(e.dias_atraso)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
