import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import {
  SECOES_ATIVO, opcoesDePessoas, opcoesDoCampo, paraBanco, paraRascunho,
} from '../../lib/campos';
import { salvarAtivo } from '../../lib/ti';
import { ehEmail } from '../../lib/regras';
import { PRAZO_MESES, somarMeses } from '../../lib/multa';
import CascaDrawer from './CascaDrawer';
import Confirmar from './Confirmar';
import { ListaSuspensa } from './Pecas';
import { useTi } from './TiContext';
import '../ativos/ativos.css';

const ID_FORM = 'ti-form-ativo';
const idCampo = (k) => `ti-f-${k}`;

/** Erros que impedem salvar, por campo. Vazio = pode gravar. */
function validar(r, valores, { id, original, ativos }) {
  const erros = {};
  if (!valores.numero_serie) {
    erros.numero_serie = 'Informe o número de série.';
  } else {
    // Mesma regra do índice único do banco (upper(numero_serie)), dita antes de
    // ir ao servidor e com o nome do campo.
    const igual = ativos.find((x) => x.id !== id && String(x.numero_serie || '').toUpperCase() === valores.numero_serie);
    if (igual) erros.numero_serie = 'Já existe um ativo com este número de série.';
  }
  // Texto antigo da planilha ("Não encontrado") pode ficar; o que for
  // digitado agora tem de ser e-mail, que é a chave dos termos.
  const mudouResp = valores.responsavel !== (original?.responsavel ?? null);
  if (valores.responsavel && mudouResp && !ehEmail(valores.responsavel)) {
    erros.responsavel = 'O responsável deve ser um e-mail.';
  }
  // Sem isto, um valor digitado errado ("R$ 10") virava vazio sem aviso.
  if (String(r.valor_mensal || '').trim() && valores.valor_mensal == null) {
    erros.valor_mensal = 'Use só números, como 1.234,56.';
  }
  return erros;
}

export default function FormAtivo({ id, init }) {
  const {
    dados, trocarAtivos, toast, fecharDrawer, abrirAtivo,
  } = useTi();
  const original = id ? dados.ativos.find((a) => a.id === id) : null;
  const [inicial] = useState(() => ({ ...paraRascunho(original || {}), ...(init || {}) }));
  const [r, setR] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [erros, setErros] = useState({});
  const [sair, setSair] = useState(null); // ação de saída à espera de "descartar?"
  const set = (k, v) => {
    // O vencimento acompanha o início do prazo (24 meses); dá para corrigir à mão depois.
    const venc = k === 'inicio_contrato' && v ? { vencimento_contrato: somarMeses(v, PRAZO_MESES) || '' } : {};
    setR((x) => ({ ...x, [k]: v, ...venc }));
    if (erros[k]) {
      setErros((atual) => {
        const resto = { ...atual };
        delete resto[k];
        return resto;
      });
    }
  };
  const pessoasOpcoes = useMemo(
    () => opcoesDePessoas(dados.pessoas, dados.ativos, ['responsavel', 'responsavel_base']),
    [dados.pessoas, dados.ativos],
  );
  const alterado = useMemo(
    () => JSON.stringify(paraBanco(r)) !== JSON.stringify(paraBanco(inicial)),
    [r, inicial],
  );
  const contratoInvertido = r.inicio_contrato && r.vencimento_contrato && r.vencimento_contrato < r.inicio_contrato;

  // Ctrl+S / Cmd+S salva sem tirar a mão do teclado.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        document.getElementById(ID_FORM)?.requestSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Fechar com alteração pendente pergunta antes; sem alteração, fecha direto.
  const pedirSaida = (acao) => {
    if (salvando) return;
    if (alterado) setSair(() => acao);
    else acao();
  };
  const cancelar = () => pedirSaida(() => (id ? abrirAtivo(id) : fecharDrawer()));
  const fechar = () => pedirSaida(fecharDrawer);

  const salvar = async (e) => {
    e.preventDefault();
    if (salvando) return;
    const valores = paraBanco(r);
    const novos = validar(r, valores, { id, original, ativos: dados.ativos });
    const chaves = Object.keys(novos);
    if (chaves.length) {
      setErros(novos);
      setErro('');
      // Foco no primeiro campo com problema, na ordem da tela.
      const primeiro = SECOES_ATIVO.flatMap((s) => s.campos).find((c) => novos[c.k]);
      document.getElementById(idCampo(primeiro.k))?.focus();
      return;
    }
    setErros({});
    setSalvando(true);
    setErro('');
    try {
      const salvo = await salvarAtivo(id, valores);
      trocarAtivos([salvo]);
      toast(id ? 'Ativo atualizado.' : 'Ativo cadastrado.');
      abrirAtivo(salvo.id);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  const qtdErros = Object.keys(erros).length;

  return (
    <CascaDrawer
      onFechar={fechar}
      cabecalho={(
        <>
          <h2>{id ? `Editar ${original?.numero_serie || 'ativo'}` : 'Novo ativo'}</h2>
          <p>
            {id
              ? 'Altere o que precisar e salve. Campos marcados com * são obrigatórios.'
              : 'Só o número de série é obrigatório; o resto pode ser completado depois.'}
          </p>
        </>
      )}
      rodape={(
        <>
          {erro && <span className="ti-note crit ti-ativos-erro-geral" role="alert">{erro}</span>}
          {!erro && qtdErros > 0 && (
            <span className="ti-note crit ti-ativos-erro-geral" role="alert">
              {qtdErros === 1 ? 'Corrija o campo destacado.' : `Corrija os ${qtdErros} campos destacados.`}
            </span>
          )}
          {!erro && !qtdErros && alterado && <span className="ti-hint">Alterações não salvas.</span>}
          <span className="ti-sp" />
          <button type="button" className="ti-btn" onClick={cancelar} disabled={salvando}>Cancelar</button>
          <button type="submit" form={ID_FORM} className="ti-btn primary" disabled={salvando} aria-busy={salvando} title="Salvar (Ctrl+S)">
            <Save size={15} aria-hidden="true" /> {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      )}
    >
      <form id={ID_FORM} className="ti-stack ti-form" onSubmit={salvar} noValidate aria-busy={salvando}>
        {SECOES_ATIVO.map((s) => {
          const idSec = `ti-fs-${s.titulo.replace(/\W+/g, '-').toLowerCase()}`;
          return (
            <section key={s.titulo} className="ti-card ti-fsec" aria-labelledby={idSec}>
              <h3 id={idSec}>{s.titulo}</h3>
              <div className="ti-fgrid">
                {s.campos.map((c) => {
                  const idc = idCampo(c.k);
                  const msg = erros[c.k];
                  const aviso = c.k === 'vencimento_contrato' && contratoInvertido
                    ? 'O vencimento está antes do início do contrato.'
                    : '';
                  // A dica do responsável só faz sentido ao editar quem já tem dono.
                  const dica = c.k === 'responsavel' && !id ? '' : c.dica;
                  const idMsg = msg ? `${idc}-erro` : undefined;
                  const idDica = dica || aviso ? `${idc}-dica` : undefined;
                  const descr = [idMsg, idDica].filter(Boolean).join(' ') || undefined;
                  const comum = {
                    id: idc,
                    className: 'ti-inp',
                    value: r[c.k],
                    onChange: (e) => set(c.k, e.target.value),
                    placeholder: c.ph,
                    'aria-invalid': msg ? true : undefined,
                    'aria-describedby': descr,
                  };
                  let input;
                  if (c.t === 'select') {
                    // Fechada: só os valores da regra (valor antigo fora dela aparece em texto).
                    input = <ListaSuspensa id={idc} valor={r[c.k]} onChange={(v) => set(c.k, v)} opcoes={c.opcoes} livre={!!r[c.k] && !c.opcoes.includes(r[c.k])} />;
                  } else if (c.pessoas) {
                    input = (
                      <ListaSuspensa
                        id={idc}
                        valor={r[c.k]}
                        onChange={(v) => set(c.k, v)}
                        opcoes={pessoasOpcoes}
                        vazio="Ninguém"
                        placeholderOutro="e-mail@phdengenharia.eng.br"
                      />
                    );
                  } else if (c.lista) {
                    input = <ListaSuspensa id={idc} valor={r[c.k]} onChange={(v) => set(c.k, v)} opcoes={opcoesDoCampo(dados.ativos, c)} placeholderOutro={c.ph || 'Digite o valor'} />;
                  } else if (c.t === 'area') {
                    input = <textarea {...comum} rows={3} />;
                  } else if (c.t === 'date') {
                    input = <input {...comum} type="date" />;
                  } else if (c.t === 'money') {
                    input = (
                      <div className="ti-ativos-moeda">
                        <span aria-hidden="true">R$</span>
                        <input {...comum} className="ti-inp num" inputMode="decimal" autoComplete="off" />
                      </div>
                    );
                  } else {
                    input = (
                      <input
                        {...comum}
                        className={`ti-inp ${c.k === 'numero_serie' ? 'upper' : ''}`}
                        required={c.obrigatorio}
                        aria-required={c.obrigatorio || undefined}
                        autoComplete="off"
                        spellCheck={c.k === 'numero_serie' ? false : undefined}
                        autoFocus={c.k === 'numero_serie' && !id}
                        inputMode={c.k === 'link_termo' ? 'url' : undefined}
                      />
                    );
                  }
                  return (
                    <div key={c.k} className={`ti-fld ${c.full ? 'full' : ''} ${msg ? 'ti-ativos-inv' : ''}`}>
                      <label htmlFor={idc}>
                        {c.l}
                        {c.obrigatorio && <span className="ti-ativos-obrig" aria-hidden="true"> *</span>}
                      </label>
                      {input}
                      {msg && <span id={idMsg} className="ti-ativos-msg">{msg}</span>}
                      {(dica || aviso) && (
                        <span id={idDica} className={`ti-ativos-dica ${aviso ? 'aviso' : ''}`}>{aviso || dica}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </form>

      {sair && (
        <Confirmar
          titulo="Descartar alterações?"
          texto="O que você preencheu neste formulário ainda não foi salvo e será perdido."
          ok="Descartar"
          cancelar="Continuar editando"
          perigo
          onOk={async () => { const acao = sair; setSair(null); acao(); }}
          onFechar={() => setSair(null)}
        />
      )}
    </CascaDrawer>
  );
}
