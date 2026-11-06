import { createElement, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { ehAdminSetorAdm } from '../../../../config/setorAdm';
import {
  TABELAS as T, atualizar, criarAlojamento, excluir, inserir, salvarQuartos,
} from '../../lib/alojamentos';
import { removerAnexos } from '../../lib/anexos';
import {
  ALOJ_PADRAO, alojFields, conferenciaFields, contaFields, itemFields, ocorrenciaFields, pagamentoFields, saidaFields, stayFields,
} from '../../lib/formularios';
import {
  byId, compLong, confSt, doAloj, erroConferencia, num, plural, quartoNome, staysOn, todayISO, voltaParaConferir,
} from '../../lib/regras';
import { rotaFicha } from './nav';
import { NotaConferencia, ResumoConferencia } from './Conferencia';

/**
 * Tudo que uma tela do módulo pode abrir: os formulários, as confirmações e a
 * configuração de quartos. As telas chamam daqui e desenham <Dialogos acoes={...} />.
 * No protótipo era o despachante único de cliques (ACT).
 */
export function useAcoes({ base, recarregar }) {
  const navigate = useNavigate();
  const { user, modules } = useAuth();
  const isAdmin = ehAdminSetorAdm(modules, user);

  const [form, setForm] = useState(null);
  const [confirmacao, setConfirmacao] = useState(null);
  const [quartosDe, setQuartosDe] = useState(null);
  const [lista, setLista] = useState(null);
  const [toast, setToast] = useState('');

  const fechar = useCallback(() => {
    setForm(null);
    setConfirmacao(null);
    setQuartosDe(null);
    setLista(null);
  }, []);
  const limparToast = useCallback(() => setToast(''), []);

  const concluir = async (msg) => {
    await recarregar();
    setToast(msg);
  };

  const confirmar = (config) => {
    setForm(null);
    setConfirmacao(config);
  };

  /* ---------- alojamento ---------- */
  const excluirAlojamento = (a) => {
    const n = ['itens', 'estadias', 'pagamentos', 'ocorrencias'].reduce((s, c) => s + doAloj(base[c], a.id).length, 0);
    confirmar({
      titulo: `Excluir ${a.nome}?`,
      texto: `Isso apaga o cadastro e ${plural(n, 'registro vinculado', 'registros vinculados')} (moradores, pagamentos, mobiliário e ocorrências). Para manter o histórico, prefira mudar a situação para Inativo.`,
      ok: 'Excluir definitivamente',
      onOk: async () => {
        // O cascade leva os lançamentos, mas o arquivo no bucket fica: pega antes.
        const paths = doAloj(base.pagamentos, a.id).flatMap((p) => (p.anexos || []).map((f) => f.path));
        await excluir(T.alojamentos, a.id);
        removerAnexos(paths);
        await concluir('Alojamento excluído');
        navigate('/alojamentos/lista');
      },
    });
  };

  const novoAlojamento = () => setForm({
    titulo: 'Novo alojamento',
    sub: 'Base de dados do imóvel: endereço, contrato, valores e contatos',
    largo: true,
    campos: alojFields(true),
    valores: ALOJ_PADRAO,
    rotulo: 'Cadastrar alojamento',
    onSalvar: async ({ _nq, ...vals }) => {
      const novo = await criarAlojamento(vals, _nq || 0);
      await concluir('Alojamento cadastrado');
      navigate(rotaFicha(novo.id));
    },
  });

  const editarAlojamento = (a) => setForm({
    titulo: `Editar ${a.nome}`,
    sub: 'Atualize os dados cadastrais do alojamento',
    largo: true,
    campos: alojFields(false),
    valores: a,
    rotulo: 'Salvar alterações',
    // Só o admin exclui: o cadastro leva junto todo o histórico. A RLS garante.
    esquerda: isAdmin ? { rotulo: 'Excluir', onClick: () => excluirAlojamento(a) } : null,
    onSalvar: async (vals) => {
      await atualizar(T.alojamentos, a.id, vals);
      await concluir('Cadastro atualizado');
    },
  });

  /* ---------- contas de consumo ---------- */
  const excluirConta = (a, c) => confirmar({
    titulo: 'Remover conta?',
    texto: `Remover ${c.tipo}${c.fornecedor ? ` · ${c.fornecedor}` : ''} do cadastro de ${a.nome}? Os pagamentos já lançados continuam no histórico.`,
    ok: 'Remover',
    onOk: async () => {
      await excluir(T.contas, c.id);
      await concluir('Conta removida');
    },
  });

  const formConta = (a, c) => setForm({
    titulo: c ? `Editar conta de ${c.tipo}` : 'Nova conta de consumo',
    sub: a.nome,
    campos: contaFields,
    valores: c || { status: 'ativa' },
    onSalvar: async (vals) => {
      if (c) await atualizar(T.contas, c.id, vals);
      else await inserir(T.contas, { ...vals, alojamento_id: a.id });
      await concluir('Conta salva');
    },
  });

  /* ---------- pendências: sem formulário, então o erro vira aviso ---------- */
  const semForm = async (fn, msg) => {
    try {
      await fn();
      await concluir(msg);
    } catch (e) {
      setToast(e.message);
    }
  };
  const adicionarPendencia = (a, texto) => semForm(
    () => inserir(T.pendencias, { alojamento_id: a.id, texto, feito: false }),
    'Pendência adicionada',
  );
  const alternarPendencia = (p, feito) => semForm(
    () => atualizar(T.pendencias, p.id, { feito, feito_em: feito ? todayISO() : null }),
    feito ? 'Pendência concluída' : 'Pendência reaberta',
  );
  const removerPendencia = (p) => semForm(() => excluir(T.pendencias, p.id), 'Pendência removida');

  /* ---------- estadias ---------- */
  const entrada = (aid, qid) => {
    let q = qid;
    if (aid && !q) {
      const a = byId(base, aid);
      const on = staysOn(base, aid);
      const livre = (a?.quartos || []).find((r) => on.filter((e) => e.quarto_id === r.id).length < Math.max(1, +r.vagas || 1));
      q = livre?.id || (a?.quartos || [])[0]?.id || '';
    }
    setForm({
      titulo: 'Registrar entrada',
      sub: 'Novo morador em um quarto',
      campos: stayFields(base, false),
      valores: {
        alojamento_id: aid || '', quarto_id: q || '', entrada: todayISO(), chave: 'com_morador',
      },
      rotulo: 'Registrar entrada',
      onSalvar: async (vals) => {
        await inserir(T.estadias, vals);
        await concluir('Entrada registrada');
      },
    });
  };

  const saida = (e) => {
    const a = byId(base, e.alojamento_id);
    setForm({
      titulo: `Registrar saída · ${e.morador}`,
      sub: `${a?.nome || ''} · ${quartoNome(a, e)}`,
      campos: saidaFields,
      valores: {
        saida: todayISO(), chave: 'devolvida', chave_obs: e.chave_obs || '', obs: e.obs || '',
      },
      rotulo: 'Registrar saída',
      onSalvar: async (vals) => {
        await atualizar(T.estadias, e.id, vals);
        await concluir('Saída registrada');
      },
    });
  };

  const excluirEstadia = (e) => confirmar({
    titulo: 'Excluir estadia?',
    texto: `Apagar o registro de ${e.morador} do histórico? Para encerrar a estadia, use Registrar saída.`,
    onOk: async () => {
      await excluir(T.estadias, e.id);
      await concluir('Estadia excluída');
    },
  });

  const editarEstadia = (e) => setForm({
    titulo: `Editar estadia · ${e.morador}`,
    campos: stayFields(base, true),
    valores: e,
    esquerda: { rotulo: 'Excluir', onClick: () => excluirEstadia(e) },
    onSalvar: async (vals) => {
      await atualizar(T.estadias, e.id, vals);
      await concluir('Estadia atualizada');
    },
  });

  /* ---------- pagamentos e faturas ---------- */
  const excluirPagamento = (p) => {
    const nf = (p.anexos || []).length;
    confirmar({
      titulo: 'Excluir lançamento?',
      texto: `${p.conta} · ${compLong(p.competencia)} · ${byId(base, p.alojamento_id)?.nome || ''}${nf ? ` · ${plural(nf, 'fatura anexada será apagada', 'faturas anexadas serão apagadas')}` : ''}`,
      onOk: async () => {
        await excluir(T.pagamentos, p.id);
        removerAnexos((p.anexos || []).map((f) => f.path));
        await concluir('Lançamento excluído');
      },
    });
  };

  const formPagamento = (p, preset = {}) => {
    const vals = p || { status: 'pago', ...preset };
    const a = byId(base, vals.alojamento_id);
    const cs = p ? confSt(p) : 'pendente';
    setLista(null);
    setForm({
      titulo: p ? `Editar lançamento · ${p.conta}` : (preset.status === 'pendente' ? 'Lançar fatura' : 'Lançar pagamento'),
      sub: a ? `${a.nome}${vals.competencia ? ` · ${compLong(vals.competencia)}` : ''}` : 'Conta do alojamento, com fatura anexada para o Contas a Pagar',
      largo: true,
      intro: p && cs !== 'pendente' ? createElement(NotaConferencia, { p }) : null,
      campos: pagamentoFields(base),
      valores: vals,
      rotulo: p ? 'Salvar' : 'Lançar',
      esquerda: p ? { rotulo: 'Excluir', onClick: () => excluirPagamento(p) } : null,
      onSalvar: async (v) => {
        if (v.status === 'pago' && !v.data_pagamento && num(v.valor) === null) {
          throw new Error('Para marcar como pago, informe o valor ou a data do pagamento.');
        }
        if (p) {
          // Quem devolve para "A conferir" é o gatilho do banco; aqui só se avisa.
          await atualizar(T.pagamentos, p.id, v);
          await concluir(voltaParaConferir(p, v) ? 'Lançamento atualizado. Voltou para “A conferir”.' : 'Lançamento atualizado');
        } else {
          await inserir(T.pagamentos, v);
          await concluir((v.anexos || []).length ? 'Lançamento salvo com a fatura' : 'Pagamento lançado');
        }
      },
    });
  };

  const conferir = (p) => {
    const cs = confSt(p);
    const a = byId(base, p.alojamento_id);
    setLista(null);
    setForm({
      titulo: `Conferir fatura · ${p.conta}`,
      sub: `${a?.nome || ''} · ${compLong(p.competencia)}`,
      largo: true,
      intro: createElement(ResumoConferencia, { p, a, onErro: setToast }),
      campos: conferenciaFields,
      valores: {
        conferencia_status: cs === 'pendente' ? 'conferida' : cs,
        conferencia_obs: cs !== 'pendente' ? (p.conferencia_obs || '') : '',
        status: p.status || 'pendente',
        data_pagamento: p.data_pagamento || '',
        forma: p.forma || '',
      },
      rotulo: 'Registrar conferência',
      onSalvar: async (v) => {
        const msg = erroConferencia(p, v);
        if (msg) throw new Error(msg);
        // conferido_por_nome e conferido_em quem grava é o gatilho do banco.
        await atualizar(T.pagamentos, p.id, v);
        await concluir({ conferida: 'Fatura conferida', divergencia: 'Divergência registrada' }[v.conferencia_status] || 'Conferência atualizada');
      },
    });
  };

  /* ---------- mobiliário ---------- */
  const excluirItem = (i) => confirmar({
    titulo: 'Excluir item?',
    texto: `Remover ${i.produto} do inventário?`,
    onOk: async () => {
      await excluir(T.itens, i.id);
      await concluir('Item excluído');
    },
  });

  const formItem = (i, aid) => setForm({
    titulo: i ? `Editar item · ${i.produto}` : 'Adicionar item ao mobiliário',
    sub: 'Compra feita pela PHD para compor o alojamento',
    campos: itemFields(base),
    valores: i || { alojamento_id: aid || '', quantidade: 1, destino: 'Em uso' },
    rotulo: i ? 'Salvar' : 'Adicionar',
    esquerda: i ? { rotulo: 'Excluir', onClick: () => excluirItem(i) } : null,
    onSalvar: async (v) => {
      if (i) await atualizar(T.itens, i.id, v);
      else await inserir(T.itens, v);
      await concluir(i ? 'Item atualizado' : 'Item adicionado');
    },
  });

  /* ---------- ocorrências ---------- */
  const excluirOcorrencia = (o) => confirmar({
    titulo: 'Excluir ocorrência?',
    texto: 'O registro sai do histórico do alojamento.',
    onOk: async () => {
      await excluir(T.ocorrencias, o.id);
      await concluir('Ocorrência excluída');
    },
  });

  const formOcorrencia = (o, aid) => setForm({
    titulo: o ? 'Editar ocorrência' : 'Registrar ocorrência',
    campos: ocorrenciaFields(base),
    valores: o || { alojamento_id: aid || '', data: todayISO(), tipo: 'Contrato' },
    esquerda: o ? { rotulo: 'Excluir', onClick: () => excluirOcorrencia(o) } : null,
    onSalvar: async (v) => {
      if (o) await atualizar(T.ocorrencias, o.id, v);
      else await inserir(T.ocorrencias, v);
      await concluir(o ? 'Ocorrência atualizada' : 'Ocorrência registrada');
    },
  });

  /* ---------- quartos ---------- */
  const salvarListaQuartos = async (a, linhas, removidos) => {
    await salvarQuartos(a.id, linhas, removidos);
    await concluir('Quartos atualizados');
  };

  return {
    // estado que o <Dialogos> desenha
    form,
    confirmacao,
    quartosDe,
    lista,
    toast,
    base,
    fechar,
    limparToast,
    avisar: setToast,
    salvarListaQuartos,
    // ações das telas
    novoAlojamento,
    editarAlojamento,
    novaConta: (a) => formConta(a, null),
    editarConta: formConta,
    excluirConta,
    adicionarPendencia,
    alternarPendencia,
    removerPendencia,
    configurarQuartos: (a) => setQuartosDe(a),
    entrada,
    saida,
    editarEstadia,
    excluirEstadia,
    novoPagamento: (preset) => formPagamento(null, preset),
    novaFatura: (preset) => formPagamento(null, { status: 'pendente', ...preset }),
    editarPagamento: (p) => formPagamento(p),
    excluirPagamento,
    listarPagamentos: (aid, conta, comp) => setLista({ aid, conta, comp }),
    conferir,
    novoItem: (aid) => formItem(null, aid),
    editarItem: (i) => formItem(i),
    excluirItem,
    novaOcorrencia: (aid) => formOcorrencia(null, aid),
    editarOcorrencia: (o) => formOcorrencia(o),
    excluirOcorrencia,
  };
}
