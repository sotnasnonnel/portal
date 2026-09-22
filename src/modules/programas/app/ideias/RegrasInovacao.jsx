import { useState } from 'react';
import { Award, FileText, X } from 'lucide-react';
import { REGRAS_INOVACAO } from '../../../../config/programasTermos';

/**
 * Regras do Programa de Inovação 2026, dentro do Campo de Ideias.
 *
 * Leitura, sem aceite: ao contrário da Alavanca (TermosAlavanca), aqui o
 * colaborador não declara nada — ele consulta as condições de elegibilidade e
 * de premiação. Por isso o popup não trava o formulário; quem quer registrar
 * registra, e quem quer conferir a regra abre.
 *
 * `variante="caixa"` é o bloco da tela do Campo de Ideias; `variante="link"` é
 * a chamada discreta que entra no formulário, onde o assunto principal é
 * preencher, não ler regra.
 */
export default function RegrasInovacao({ variante = 'caixa' }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {variante === 'caixa' ? (
        <div className="pg-termos-box">
          <p>
            <strong>Programa de Inovação 2026:</strong> a solução registrada aqui concorre à
            premiação. Valem as iniciativas — ideia registrada não é contabilizada — e o
            cadastro tem que ser feito até <strong>30/11/2026</strong>, com medição de retorno.
          </p>
          <button type="button" className="pg-btn pg-btn-primary" onClick={() => setAberto(true)}>
            <FileText size={16} /> Ler as regras do programa
          </button>
        </div>
      ) : (
        <button type="button" className="pg-btn pg-btn-ghost pg-btn-sm" onClick={() => setAberto(true)}>
          <Award size={16} /> Regras do Programa de Inovação
        </button>
      )}

      {aberto && (
        <div className="pg-modal-overlay" onClick={() => setAberto(false)}>
          <div
            className="pg-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={REGRAS_INOVACAO.titulo}
          >
            <div className="pg-modal-cab">
              <h2>{REGRAS_INOVACAO.titulo}</h2>
              <button type="button" className="pg-modal-x" onClick={() => setAberto(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="pg-modal-corpo">
              <p className="pg-campo-dica" style={{ marginBottom: 14 }}>{REGRAS_INOVACAO.intro}</p>

              {REGRAS_INOVACAO.secoes.map((secao) => {
                // A elegibilidade é numerada porque a última regra cita "a
                // regra número 5" — sem número, a frase fica sem referência.
                const Lista = secao.numerada ? 'ol' : 'ul';
                return (
                  <section key={secao.titulo} style={{ marginBottom: 18 }}>
                    <h3 className="pg-secao" style={{ marginTop: 0 }}>{secao.titulo}</h3>
                    {secao.intro && (
                      <p className="pg-campo-dica" style={{ marginBottom: 10 }}>{secao.intro}</p>
                    )}
                    <Lista className={secao.numerada ? 'pg-regras pg-regras-num' : 'pg-regras'}>
                      {secao.itens.map((item) => <li key={item}>{item}</li>)}
                    </Lista>
                  </section>
                );
              })}
            </div>

            <div className="pg-modal-pe">
              <button type="button" className="pg-btn pg-btn-primary" onClick={() => setAberto(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
