import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { ehAdminSetorAdm } from '../../../../config/setorAdm';
import {
  TABELAS as T, atualizar, criarAlojamento, excluir, inserir, salvarQuartos,
} from '../../lib/alojamentos';
import {
  ALOJ_PADRAO, alojFields, contaFields, itemFields, ocorrenciaFields, pagamentoFields, saidaFields, stayFields,
} from '../../lib/formularios';
import {
  byId, compLong, doAloj, num, plural, quartoNome, staysOn, todayISO,
} from '../../lib/regras';
import { rotaFicha } from './nav';

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
  const [toast, setToast] = useState('');

  const fechar = useCallback(() => {
    setForm(null);
    setConfirmacao(null);
    setQuartosDe(null);
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
        await excluir(T.alojamentos, a.id);
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

  /* ---------- pagamentos ---------- */
  const excluirPagamento = (p) => confirmar({
    titulo: 'Excluir pagamento?',
    texto: `Excluir o lançamento de ${p.conta}?`,
    onOk: async () => {
      await excluir(T.pagamentos, p.id);
      await concluir('Pagamento excluído');
    },
  });

  const formPagamento = (p, preset = {}) => {
    const vals = p || { status: 'pago', ...preset };
    const a = byId(base, vals.alojamento_id);
    setForm({
      titulo: p ? `Editar pagamento · ${p.conta}` : 'Lançar pagamento',
      sub: a ? `${a.nome}${vals.competencia ? ` · ${compLong(vals.competencia)}` : ''}` : 'Conta fixa do alojamento',
      campos: pagamentoFields(base),
      valores: vals,
      rotulo: p ? 'Salvar' : 'Lançar',
      esquerda: p ? { rotulo: 'Excluir', onClick: () => excluirPagamento(p) } : null,
      onSalvar: async (v) => {
        if (v.status === 'pago' && !v.data_pagamento && num(v.valor) === null) {
          throw new Error('Para marcar como pago, informe o valor ou a data do pagamento.');
        }
        if (p) await atualizar(T.pagamentos, p.id, v);
        else await inserir(T.pagamentos, v);
        await concluir(p ? 'Pagamento atualizado' : 'Pagamento lançado');
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
    toast,
    base,
    fechar,
    limparToast,
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
    editarPagamento: (p) => formPagamento(p),
    excluirPagamento,
    novoItem: (aid) => formItem(null, aid),
    editarItem: (i) => formItem(i),
    excluirItem,
    novaOcorrencia: (aid) => formOcorrencia(null, aid),
    editarOcorrencia: (o) => formOcorrencia(o),
    excluirOcorrencia,
  };
}
