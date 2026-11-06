import { useMemo, useRef, useState } from 'react';
import {
  Check, CreditCard, Trash2, TriangleAlert,
} from 'lucide-react';
import { useFrota } from './FrotaContext';
import CascaDrawer from './CascaDrawer';
import CampoArquivos from './Anexos';
import Confirmar from './Confirmar';
import { LinhaAuditoria } from './Pecas';
import ResumoFatura from './ResumoFatura';
import {
  SCHEMAS, COL_NAME, FEM, fmtDec, listasDoForm, textosDoRegistro, valoresDoForm, faltando, tituloDe, pathsDosAnexos,
} from '../../lib/schemas';
import {
  PLACA_RE, compLabel, duplicado, lastComp, patchVeiculo, todayISO,
} from '../../lib/regras';
import { autoPreencher, prepararFatura, veiculosParaFatura } from '../../lib/faturas';
import { fmtDate } from '../../lib/formato';
import { excluirRegistro, removerAnexos, salvarRegistro } from '../../lib/frota';

const listaDe = (v) => {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
};

/** O que um registro salvo muda no cadastro do veículo (ver patchVeiculo). */
function efeitoNoVeiculo(col, vals, dados) {
  if (!vals.placa) return null;
  const v = dados.veiculos.find((x) => x.placa === vals.placa);
  if (!v) return null;
  if (col === 'mensal' && vals.competencia === lastComp(dados.mensal)) {
    return { id: v.id, patch: patchVeiculo(v, { km_atual: vals.km_atual }) };
  }
  if (col === 'manutencoes') {
    const prev = vals.tipo === 'Revisão preventiva'
      ? { km_ultima_manutencao: vals.km, data_ultima_revisao: vals.data }
      : {};
    return { id: v.id, patch: patchVeiculo(v, { km_atual: vals.km, ...prev, data_proxima_revisao: vals.proxima_data }) };
  }
  return null;
}

function Campo({
  campo, valor, onChange, veiculos,
}) {
  const id = `frota-fd-${campo.k}`;
  const mudar = (e) => onChange(e.target.value);
  let input;
  if (campo.t === 'veic') {
    const ativos = veiculosParaFatura(veiculos);
    input = (
      <select id={id} className="frota-inp" value={valor} onChange={mudar}>
        <option value="">Selecione um veículo ativo ({ativos.length})…</option>
        {ativos.map((v) => (
          <option key={v.id} value={v.placa}>{v.placa} — {v.modelo || ''} · {v.condutor || 'sem condutor'} · {v.locadora || ''}</option>
        ))}
        {/* Fatura antiga de veículo já devolvido continua abrindo. */}
        {valor && !ativos.some((v) => v.placa === valor) && <option value={valor}>{valor} (não está ativo)</option>}
      </select>
    );
  } else if (campo.t === 'select') {
    input = (
      <select id={id} className="frota-inp" value={valor} onChange={mudar}>
        <option value="" />
        {campo.opts.map((o) => <option key={o}>{o}</option>)}
        {/* Valor que veio da planilha e não está na lista continua aparecendo. */}
        {valor && !campo.opts.includes(valor) && <option>{valor}</option>}
      </select>
    );
  } else if (campo.t === 'area') {
    input = <textarea id={id} className="frota-inp" value={valor} onChange={mudar} />;
  } else if (campo.t === 'date' || campo.t === 'month') {
    input = <input id={id} className="frota-inp" type={campo.t} value={valor} onChange={mudar} />;
  } else if (campo.t === 'money' || campo.t === 'int') {
    input = (
      <input
        id={id}
        className="frota-inp num"
        inputMode={campo.t === 'money' ? 'decimal' : 'numeric'}
        placeholder={campo.t === 'money' ? '0,00' : undefined}
        value={valor}
        onChange={mudar}
      />
    );
  } else {
    input = (
      <input
        id={id}
        className={`frota-inp ${campo.upper ? 'upper' : ''}`}
        list={campo.list ? `frota-dl-${campo.list}` : undefined}
        autoComplete="off"
        value={valor}
        onChange={mudar}
      />
    );
  }
  return (
    <div className={`frota-fld ${campo.full || campo.t === 'area' ? 'full' : ''}`}>
      <label htmlFor={id}>{campo.l}{campo.req ? ' *' : ''}</label>
      {input}
      {campo.hint && <span className="frota-hint">{campo.hint}</span>}
    </div>
  );
}

/** Formulário de qualquer coleção, dirigido por SCHEMAS. */
export default function FormFrota({ col, id, init }) {
  const {
    dados, recarregar, toast, abrirDetalhe, fecharDrawer, podeEscrever, podeExcluir,
  } = useFrota();
  const doc = id ? dados[col].find((x) => x.id === id) : null;
  const schema = SCHEMAS[col];

  // Previsto que o próprio formulário sugeriu: só ele é trocado ao mudar veículo,
  // mês ou tipo. Valor digitado à mão fica.
  const [inicial] = useState(() => {
    const base = textosDoRegistro(col, doc || init || {});
    if (col !== 'faturas' || doc || !init?.placa) return { textos: base, sugestao: '' };
    return autoPreencher(base, 'placa', dados, '', (v) => fmtDec.format(v));
  });
  const [textos, setTextos] = useState(inicial.textos);
  const [sugestao, setSugestao] = useState(inicial.sugestao);
  const mudar = (k, v) => {
    const next = { ...textos, [k]: v };
    if (col !== 'faturas') {
      setTextos(next);
      return;
    }
    const r = autoPreencher(next, k, dados, sugestao, (n) => fmtDec.format(n));
    setSugestao(r.sugestao);
    setTextos(r.textos);
  };
  const [arquivos, setArquivos] = useState(() => Object.fromEntries(
    schema.filter((f) => f.t === 'files').map((f) => [f.k, listaDe((doc || init)?.[f.k])]),
  ));
  const [salvando, setSalvando] = useState(false);
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const formRef = useRef(null);
  const listas = useMemo(() => listasDoForm(dados), [dados]);
  const pathsOriginais = useMemo(() => pathsDosAnexos(col, doc), [col, doc]);

  // Cancelar devolve ao bucket o que subiu neste rascunho. É cópia de CNH e de BO:
  // não fica guardada sem nenhum registro apontando para ela.
  const cancelar = () => {
    const atuais = Object.values(arquivos).flat().map((a) => a.path);
    removerAnexos(atuais.filter((p) => !pathsOriginais.includes(p)));
    fecharDrawer();
  };

  const salvar = async (e, textosForcados) => {
    e?.preventDefault();
    let vals = valoresDoForm(col, textosForcados || textos);
    schema.filter((f) => f.t === 'files').forEach((f) => {
      vals[f.k] = f.multi ? arquivos[f.k] : (arquivos[f.k][0] || null);
    });
    const falta = faltando(col, vals);
    if (falta.length) {
      toast(`Preencha: ${falta.map((f) => f.l).join(', ')}`, 'err');
      formRef.current?.querySelector(`#frota-fd-${falta[0].k}`)?.focus();
      return;
    }
    if (col === 'veiculos' && vals.placa && !PLACA_RE.test(vals.placa)) {
      toast('Placa inválida. Use o formato ABC1D23 ou ABC1234.', 'err');
      return;
    }
    if (col === 'faturas') {
      const r = prepararFatura(vals, dados);
      if (r.erro) {
        toast(r.erro, 'err');
        formRef.current?.querySelector(`#frota-fd-${r.campo}`)?.focus();
        return;
      }
      vals = r.vals;
    }
    const dup = duplicado(col, vals, id, dados);
    if (dup) {
      toast(`Já existe um registro “${dup}”. Abra o existente para editar.`, 'err');
      return;
    }

    setSalvando(true);
    let salvo;
    try {
      salvo = await salvarRegistro(col, id, vals);
    } catch (err) {
      setSalvando(false);
      toast(err.message, 'err');
      return;
    }

    const depois = pathsDosAnexos(col, vals);
    removerAnexos(pathsOriginais.filter((p) => !depois.includes(p)));

    // O registro já está salvo: falha daqui em diante não pode virar "tente de
    // novo", que duplicaria um registro novo.
    const efeito = efeitoNoVeiculo(col, vals, dados);
    let veiculoFicouPara = false;
    if (efeito?.patch) {
      try {
        await salvarRegistro('veiculos', efeito.id, efeito.patch);
      } catch {
        veiculoFicouPara = true;
      }
    }

    const nome = COL_NAME[col][0].toUpperCase() + COL_NAME[col].slice(1);
    try {
      await recarregar(efeito?.patch ? [col, 'veiculos'] : [col]);
      if (veiculoFicouPara) toast(`${nome} ${FEM[col] ? 'salva' : 'salvo'}, mas o cadastro do veículo não foi atualizado. Ajuste o km por lá.`, 'err');
      else toast(`${nome} ${FEM[col] ? 'salva' : 'salvo'}`);
    } catch {
      toast(`${nome} ${FEM[col] ? 'salva' : 'salvo'}, mas a tela não atualizou. Recarregue a página.`, 'err');
    }
    if (col === 'veiculos' || col === 'condutores') abrirDetalhe(col, salvo.id);
    else fecharDrawer();
  };

  const excluir = async () => {
    try {
      await excluirRegistro(col, id);
      removerAnexos(pathsOriginais);
      await recarregar([col]);
      toast(FEM[col] ? 'Excluída' : 'Excluído');
      fecharDrawer();
    } catch (err) {
      setConfirmaExcluir(false);
      toast(err.message, 'err');
    }
  };

  // Agrupa os campos por seção, na ordem do esquema.
  const secoes = [];
  schema.forEach((f) => {
    if (f.sec) secoes.push({ titulo: f.sec, campos: [] });
    else secoes[secoes.length - 1].campos.push(f);
  });

  // Atalhos da conferência: mudam a situação e salvam de uma vez.
  const conferir = (status) => {
    const next = { ...textos, status };
    if (status === 'Paga' && !next.data_pagamento) next.data_pagamento = todayISO();
    setTextos(next);
    if (status === 'Divergência' && !String(next.obs_conferencia || '').trim()) {
      toast('Descreva a divergência em “Observação da conferência” e clique em Salvar.', 'err');
      formRef.current?.querySelector('#frota-fd-obs_conferencia')?.focus();
      return;
    }
    salvar(null, next);
  };
  const atalhosFatura = col === 'faturas' && id && podeEscrever;

  const titulo = doc ? tituloDe(col, doc, compLabel, fmtDate) : '';
  return (
    <CascaDrawer
      onFechar={cancelar}
      cabecalho={(
        <>
          <h2>{id ? 'Editar' : (FEM[col] ? 'Nova' : 'Novo')} {COL_NAME[col]}</h2>
          <p>{id ? titulo : 'Preencha os campos e salve.'}</p>
        </>
      )}
      rodape={(
        <>
          {id && podeExcluir(col) && (
            <button type="button" className="frota-btn danger" onClick={() => setConfirmaExcluir(true)}><Trash2 size={15} /> Excluir</button>
          )}
          <span className="frota-sp" />
          {atalhosFatura ? (
            <>
              <button type="button" className="frota-btn" onClick={() => conferir('Divergência')} disabled={salvando}><TriangleAlert size={15} /> Divergência</button>
              <button type="button" className="frota-btn" onClick={() => conferir('Conferida')} disabled={salvando}><Check size={15} /> Conferida</button>
              <button type="button" className="frota-btn" onClick={() => conferir('Paga')} disabled={salvando}><CreditCard size={15} /> Paga</button>
            </>
          ) : (
            <button type="button" className="frota-btn" onClick={cancelar}>Cancelar</button>
          )}
          {podeEscrever && (
            <button type="button" className="frota-btn primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
          )}
        </>
      )}
    >
      {col === 'faturas' && doc && <ResumoFatura fatura={doc} />}
      <form ref={formRef} className="frota-stack frota-form" onSubmit={salvar} noValidate>
        {secoes.map((s) => (
          <section key={s.titulo} className="frota-fsec">
            <h3>{s.titulo}</h3>
            <div className="frota-fgrid">
              {s.campos.map((f) => (f.t === 'files' ? (
                <CampoArquivos
                  key={f.k}
                  campo={f}
                  col={col}
                  lista={arquivos[f.k]}
                  podeEditar={podeEscrever}
                  onChange={(lista) => setArquivos((a) => ({ ...a, [f.k]: lista }))}
                />
              ) : (
                <Campo key={f.k} campo={f} valor={textos[f.k]} veiculos={dados.veiculos} onChange={(v) => mudar(f.k, v)} />
              )))}
            </div>
          </section>
        ))}
        {Object.entries(listas).map(([k, arr]) => (
          <datalist key={k} id={`frota-dl-${k}`}>
            {arr.map((v) => <option key={v} value={v} />)}
          </datalist>
        ))}
        {/* Enter em qualquer campo salva, como no protótipo. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
      <LinhaAuditoria doc={doc} />
      {confirmaExcluir && (
        <Confirmar
          titulo={`Excluir ${COL_NAME[col]}?`}
          texto={`“${titulo}” será removido da base para todos os usuários. Essa ação não pode ser desfeita.`}
          ok="Excluir"
          perigo
          onOk={excluir}
          onFechar={() => setConfirmaExcluir(false)}
        />
      )}
    </CascaDrawer>
  );
}
