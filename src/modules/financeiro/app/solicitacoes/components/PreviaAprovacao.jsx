import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Users } from 'lucide-react';
import { formatarMoeda } from '../../../../../utils/formatters';
import { cabecaDaCadeiaFin, alcadaDoValorFin, faixasFin } from '../cadeiaFin';

/**
 * Prévia de QUEM vai aprovar, mostrada antes do envio.
 *
 * Duas partes, que chegam em momentos diferentes:
 *
 *   1. A CABEÇA DA CADEIA — o gestor da pessoa no organograma (ou a exceção
 *      cadastrada em Fluxos). Não depende do valor, então aparece com os nomes
 *      assim que o formulário abre.
 *   2. A FAIXA DE VALOR — os aprovadores que ENTRAM conforme o valor sobe.
 *      Enquanto o valor não está informado, mostramos a régua das faixas, para
 *      a pessoa saber de antemão quem vai entrar se pedir mais.
 *
 * A régua sai da própria tabela de alçada (config/alcadas.js): número escrito à
 * mão aqui viraria mentira no dia em que a diretoria mudasse a faixa.
 */

const faixaTexto = (f) => (f.ate === Infinity
  ? `Acima de ${formatarMoeda(faixaAnterior(f))}`
  : `Até ${formatarMoeda(f.ate)}`);

// O piso de uma faixa é o teto da anterior — guardado no módulo para o texto
// "Acima de X" da última faixa não precisar de outro número solto.
let faixasCache = null;
function faixaAnterior(f) {
  const lista = faixasCache || (faixasCache = faixasFin());
  const i = lista.findIndex((x) => x.nivel === f.nivel);
  return i > 0 ? lista[i - 1].ate : 0;
}

export default function PreviaAprovacao({ valor, solicitanteId, tipoDb, onBloqueio }) {
  const [cabeca, setCabeca] = useState(null);
  const [alcadaBruta, setAlcadaBruta] = useState(null);
  const [erro, setErro] = useState('');

  const temValor = Number(valor) > 0;
  const faixas = useMemo(() => faixasFin(), []);

  // Sem valor, o que estiver guardado da faixa não vale mais: derivado em vez
  // de zerado por efeito, para a lista nunca mostrar aprovador de um valor que
  // a pessoa acabou de apagar.
  const alcada = temValor ? alcadaBruta : null;

  // 1. Cabeça da cadeia: não depende do valor.
  useEffect(() => {
    if (!solicitanteId) return undefined;
    let vivo = true;
    cabecaDaCadeiaFin(solicitanteId, tipoDb)
      .then((r) => { if (vivo) { setCabeca(r); setErro(''); } })
      .catch((e) => { if (vivo) { setCabeca(null); setErro(e.message || 'Não foi possível ler o organograma.'); } });
    return () => { vivo = false; };
  }, [solicitanteId, tipoDb]);

  // 2. Faixa de valor: recalcula enquanto a pessoa digita (com debounce).
  useEffect(() => {
    if (!temValor || !solicitanteId) return undefined;
    let vivo = true;
    const t = setTimeout(() => {
      alcadaDoValorFin(solicitanteId, valor)
        .then((r) => { if (vivo) setAlcadaBruta(r); })
        .catch(() => { if (vivo) setAlcadaBruta(null); });
    }, 400);
    return () => { vivo = false; clearTimeout(t); };
  }, [valor, temValor, solicitanteId]);

  // O que impede o envio. A faixa só entra na conta depois de resolvida, para
  // não bloquear enquanto o cálculo ainda está no ar.
  const bloqueio = (() => {
    if (!cabeca) return null;
    if (alcada?.lacunas.length) return 'lacuna';
    if (alcada?.foraDaCadeia.length) return 'fora_da_cadeia';
    if (!cabeca.pessoas.length && !alcada?.etapasAlcada.length) return 'sem_aprovador';
    return null;
  })();

  useEffect(() => { onBloqueio?.(bloqueio); }, [bloqueio, onBloqueio]);

  const passos = [
    ...(cabeca?.pessoas || []).map((p) => ({
      nome: p.nome,
      detalhe: cabeca.origem === 'cadastro' ? 'Fluxo cadastrado' : p.papel,
    })),
    ...(alcada?.etapasAlcada || []).map((e) => ({
      nome: e.nome,
      detalhe: e.candidatos.length > 1
        ? `Qualquer um: ${e.candidatos.map((c) => c.nome).join(', ')}`
        : 'Exigido pela faixa de valor',
    })),
    { nome: 'Financeiro', detalhe: 'Execução — gera o cartão depois das aprovações' },
  ];

  return (
    <div className="alc-bloco">
      <div className="alc-bloco-head">
        <Users size={15} />
        <span>Quem vai aprovar</span>
        <small>Definido pelo organograma e pela faixa de valor</small>
      </div>

      {/* Carregando é derivado: sem cabeça e sem erro, a consulta ainda está no ar. */}
      {!!solicitanteId && !cabeca && !erro && (
        <div className="fin-hint" style={{ marginTop: 0 }}>
          <Loader2 size={13} className="animate-spin" /> Montando a cadeia...
        </div>
      )}

      {erro && (
        <div className="fin-aviso" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={15} /> {erro}
        </div>
      )}

      {cabeca && (
        <div className={`alc-previa ${bloqueio ? 'is-bloqueado' : ''}`}>
          <div className="alc-previa-head">
            {temValor && alcada ? (
              <>
                <span className="alc-nivel">Nível {alcada.decisao.nivelFinal}</span>
                <span className="alc-rotulo">{alcada.decisao.rotuloNivel}</span>
                <span className="alc-valor">{formatarMoeda(Number(valor) || 0)}</span>
              </>
            ) : (
              <span className="alc-rotulo">Cadeia da sua área</span>
            )}
          </div>

          {bloqueio === 'lacuna' && (
            <div className="fin-aviso" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={15} />
              Esta faixa exige um papel sem ninguém atribuído. O envio fica bloqueado até
              o Financeiro configurar em Alçadas → Papéis.
            </div>
          )}
          {bloqueio === 'fora_da_cadeia' && (
            <div className="fin-aviso" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={15} />
              A faixa exige um papel que não existe acima de você no organograma. Peça ao
              Financeiro para ajustar o organograma antes de enviar.
            </div>
          )}
          {bloqueio === 'sem_aprovador' && (
            <div className="fin-aviso" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={15} />
              Não há ninguém acima de você no organograma nem fluxo cadastrado. Peça ao
              Financeiro para ajustar antes de enviar.
            </div>
          )}

          <ol className="alc-previa-lista">
            {passos.map((p, i) => (
              <li key={`${p.nome}-${i}`}>
                <span className="alc-previa-num">{i + 1}</span>
                <strong>{p.nome}</strong>
                <em> — {p.detalhe}</em>
              </li>
            ))}
          </ol>

          {/* Régua das faixas: enquanto não há valor, é ela que responde "e se
              eu pedir mais?". Com valor informado, a faixa da vez fica marcada. */}
          <ul className="alc-faixas">
            {faixas.map((f) => (
              <li
                key={f.nivel}
                className={temValor && alcada?.decisao.nivelFinal === f.nivel ? 'is-atual' : ''}
              >
                <span className="alc-faixa-valor">{faixaTexto(f)}</span>
                <span className="alc-faixa-quem">
                  {f.exigePapeis ? `entram ${f.rotulo.replace(/^Dupla obrigatória: /, '')}` : 'só a cadeia acima'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
