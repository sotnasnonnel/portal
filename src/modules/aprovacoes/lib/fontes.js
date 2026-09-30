import { supabase } from '../../../services/supabase';
import { acaoDisponivel, TIPO_LABEL } from '../../../config/aprovacao';
import { acaoDisponivelFin, TIPO_LABEL_FIN } from '../../../config/aprovacaoFinanceiro';
import { isAusenciaRh } from '../../../config/ausenciaProgramada';
import { MOD_AUSENCIA } from '../../../config/modulosAusencia';
import { podeAcessarFolgaCampo, isFolgaCampoRh, ROTA_FOLGA_CAMPO } from '../../../config/folgaCampo';
import { fmtMin } from '../../../config/horasExtras';
import { getClasse, getServico } from '../../../config/administrativo';
import { formatarMoeda } from '../../../utils/formatters';
import { servicoAusencia } from '../../../services/ausenciaProgramada';
import * as folga from '../../../services/folgaCampo';
import * as horasExtras from '../../../services/horasExtras';
import { notificarHoraExtra } from '../../../services/notificarHoraExtra';
import { meusPapeisAlcada } from '../../../services/alcadas';
import { decidirRequisicaoRh } from '../../../services/decisaoRequisicaoRh';
import { decidirSolicitacaoFin } from '../../financeiro/app/solicitacoes/decisaoFin';
import { listarAprovacoesPendentes, decidirChamado } from '../../administrativo/lib/chamados';
import { contextoDoChamado } from '../../administrativo/lib/rotulos';
import { decidirReembolso } from '../../reembolso/services/decisao.js';
import * as adicionais from '../../../services/adicionalAusencia';
import { veAprovacoesAdicional, ROTA_ADICIONAL } from '../../../config/adicionalAusencia';
import {
  minhaVezNaAusencia, minhaVezNoReembolso, prestacaoEsperandoGestor, motivoParaAbrirReembolso,
  minhaVezNoAdicional,
} from './central';

// As fontes da central de Aprovações.
//
// Cada uma LÊ o que espera o usuário no módulo de origem e DECIDE pela mesma
// função que a tela do módulo usa. Não há tabela da central: o que se decide
// aqui já está gravado no módulo, com os mesmos avisos e e-mails.
//
// Item normalizado:
//   { chave, fonte, id, titulo, pessoa, quando, detalhes: [[rótulo, valor]],
//     link, direto, motivoAbrir, observacaoAoAprovar, verbos, raw }
// `direto = false` quando a decisão pede algo que só a tela do módulo tem
// (desconto de reembolso, prestação de contas) — o item aparece com o link.

const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const periodo = (ini, fim) => (ini === fim ? dataBr(ini) : `${dataBr(ini)} a ${dataBr(fim)}`);
const limpar = (pares) => pares.filter(([, v]) => v !== null && v !== undefined && v !== '');

async function nomesDe(ids) {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return {};
  const { data } = await supabase.rpc('nomes_colaboradores', { p_ids: unicos });
  return Object.fromEntries((data || []).map((c) => [c.id, c.nome]));
}

// ---------------------------------------------------------------------------
// Requisições do DP
// ---------------------------------------------------------------------------
const SELECT_RH = `
  id, numero, tipo, status, gestor_id, colaborador_id, justificativa, salario_proposto,
  funcao_proposta, cargo_proposto, created_at,
  etapas:solicitacoes_rh_etapas ( id, ordem, aprovador_id, papel, tipo_etapa, status, justificativa, decidido_em )
`;

const dp = {
  chave: 'dp',
  async listar({ user }) {
    const { data, error } = await supabase.from('solicitacoes_rh').select(SELECT_RH);
    if (error) throw error;
    const minhas = (data || []).filter((s) => acaoDisponivel(user.id, s.etapas) === 'aprovacao');
    const nomes = await nomesDe(minhas.flatMap((s) => [s.gestor_id, s.colaborador_id]));
    return minhas.map((s) => ({
      chave: `dp:${s.id}`,
      fonte: 'dp',
      id: s.id,
      titulo: `${TIPO_LABEL[s.tipo] || s.tipo}${s.numero ? ` #${s.numero}` : ''}`,
      pessoa: nomes[s.gestor_id] || '',
      quando: s.created_at,
      detalhes: limpar([
        ['Colaborador', nomes[s.colaborador_id]],
        ['Função proposta', s.funcao_proposta || s.cargo_proposto],
        ['Salário proposto', s.salario_proposto ? formatarMoeda(s.salario_proposto) : null],
        ['Justificativa', s.justificativa],
      ]),
      link: '/gestor/solicitacoes/acompanhar',
      direto: true,
      observacaoAoAprovar: true,
      raw: s,
    }));
  },
  decidir: (item, { aprovar, comentario }, { user }) => decidirRequisicaoRh({
    sol: item.raw, userId: user.id, aprovar, comentario,
  }),
};

// ---------------------------------------------------------------------------
// Financeiro (cartão virtual, aumento de limite)
// ---------------------------------------------------------------------------
const SELECT_FIN = `
  id, numero, tipo, status, solicitante_id, nome_despesa, centro_custo, valor, observacao, created_at,
  categoria, alcada_nivel_base, alcada_nivel_final, alcada_excecoes,
  etapas:solicitacoes_financeiro_etapas ( id, ordem, aprovador_id, papel, papel_codigo, tipo_etapa, status, justificativa, decidido_em )
`;

const financeiro = {
  chave: 'financeiro',
  async listar({ user }) {
    const meusPapeis = await meusPapeisAlcada(user.id, { financeiroRole: user.financeiroRole, rhDp: user.rhDp });
    const { data, error } = await supabase.from('solicitacoes_financeiro').select(SELECT_FIN);
    if (error) throw error;
    const isFinAdmin = user.financeiroRole === 'admin';
    // Execução não entra: é o Financeiro efetivando, não aprovação.
    const minhas = (data || [])
      .map((s) => ({ s, acao: acaoDisponivelFin(user.id, s.etapas, isFinAdmin, meusPapeis) }))
      .filter(({ acao }) => acao === 'aprovacao' || acao === 'parecer');
    const nomes = await nomesDe(minhas.map(({ s }) => s.solicitante_id));
    return minhas.map(({ s, acao }) => ({
      chave: `financeiro:${s.id}`,
      fonte: 'financeiro',
      id: s.id,
      titulo: `${TIPO_LABEL_FIN[s.tipo] || s.tipo}${s.numero ? ` #${s.numero}` : ''}${acao === 'parecer' ? ' · parecer' : ''}`,
      pessoa: nomes[s.solicitante_id] || '',
      quando: s.created_at,
      detalhes: limpar([
        ['Valor', s.valor != null ? formatarMoeda(s.valor) : null],
        ['Despesa', s.nome_despesa],
        ['Centro de custo', s.centro_custo],
        ['Observação', s.observacao],
      ]),
      link: '/financeiro/solicitacoes/acompanhar',
      direto: true,
      observacaoAoAprovar: true,
      verbos: acao === 'parecer' ? { aprovar: 'Parecer favorável', reprovar: 'Parecer contrário' } : null,
      raw: s,
    }));
  },
  decidir: (item, { aprovar, comentario }, { user }) => decidirSolicitacaoFin({
    sol: item.raw, user, aprovar, comentario,
  }),
};

// ---------------------------------------------------------------------------
// Atendimento
// ---------------------------------------------------------------------------
const atendimento = {
  chave: 'atendimento',
  async listar({ user }) {
    const lista = await listarAprovacoesPendentes(user.id);
    return lista.map((c) => ({
      chave: `atendimento:${c.id}`,
      fonte: 'atendimento',
      id: c.id,
      titulo: `#${c.numero} · ${c.assunto}`,
      pessoa: c.solicitanteNome,
      quando: c.criado_em,
      detalhes: limpar([
        ['Serviço', contextoDoChamado({
          classeLabel: getClasse(c.classe)?.label, servicoLabel: getServico(c.classe, c.servico)?.label,
          assunto: c.assunto,
        })],
        ['Descrição', c.descricao],
      ]),
      link: `/administrativo/chamado/${c.id}`,
      direto: true,
      observacaoAoAprovar: true,
      raw: c,
    }));
  },
  decidir: async (item, { aprovar, comentario }) => {
    await decidirChamado({ chamadoId: item.id, etapaId: item.raw.etapaId, aprovar, justificativa: comentario });
    return 'ok';
  },
};

// ---------------------------------------------------------------------------
// Ausência Programada e Folga de Campo
// ---------------------------------------------------------------------------
const apiAusencia = servicoAusencia(MOD_AUSENCIA);

const ausencia = {
  chave: 'ausencia',
  async listar({ user }) {
    const lista = await apiAusencia.listarSolicitacoes('aprovar');
    const ehRh = isAusenciaRh(user);
    return lista.filter((s) => minhaVezNaAusencia(s, user.id, ehRh)).map((s) => ({
      chave: `ausencia:${s.id}`,
      fonte: 'ausencia',
      id: s.id,
      titulo: `Ausência programada #${s.numero}`,
      pessoa: s.colaborador_nome,
      quando: s.enviado_em || s.created_at,
      detalhes: limpar([
        ['Período', `${periodo(s.data_inicio, s.data_fim)} (${s.dias} dia${s.dias === 1 ? '' : 's'})`],
        ['Saldo do período', s.saldo_periodo != null ? `${s.saldo_periodo} dia(s), já descontado este pedido` : null],
        ['Fora do prazo', s.fora_do_prazo ? 'Sim' : null],
        ['Observação', s.observacao],
      ]),
      link: `${MOD_AUSENCIA.rota}/aprovacoes`,
      direto: true,
      observacaoAoAprovar: false,
      raw: s,
    }));
  },
  decidir: async (item, { aprovar, comentario }) => {
    await apiAusencia.decidir(item.id, { aprovar, motivo: aprovar ? null : comentario.trim() });
    return 'ok';
  },
};

const folgaCampo = {
  chave: 'folga',
  async listar({ user }) {
    if (!podeAcessarFolgaCampo(user)) return [];
    const lista = await folga.listar('aprovar');
    const ehRh = isFolgaCampoRh(user);
    return lista.filter((r) => minhaVezNaAusencia(r, user.id, ehRh)).map((r) => ({
      chave: `folga:${r.id}`,
      fonte: 'folga',
      id: r.id,
      titulo: `Folga de campo #${r.numero}`,
      pessoa: r.colaborador_nome,
      quando: r.enviado_em || r.created_at || r.data_inicio,
      detalhes: limpar([
        ['Período', `${periodo(r.data_inicio, r.data_fim)} (${r.dias} dia${r.dias === 1 ? '' : 's'})`],
        ['Obra', r.obra],
        ['Motivo', r.motivo],
      ]),
      link: `${ROTA_FOLGA_CAMPO}/aprovacoes`,
      direto: true,
      observacaoAoAprovar: false,
      raw: r,
    }));
  },
  decidir: async (item, { aprovar, comentario }) => {
    await folga.decidir(item.id, { aprovar, motivo: aprovar ? null : comentario.trim() });
    return 'ok';
  },
};

// ---------------------------------------------------------------------------
// Adicional de Ausências — aprovado, soma no saldo da Ausência Programada
// ---------------------------------------------------------------------------
const adicional = {
  chave: 'adicional',
  async listar({ user }) {
    if (!veAprovacoesAdicional(user)) return [];
    const lista = await adicionais.listar('aprovar');
    const ehRh = isAusenciaRh(user);
    return lista.filter((r) => minhaVezNoAdicional(r, user.id, ehRh)).map((r) => ({
      chave: `adicional:${r.id}`,
      fonte: 'adicional',
      id: r.id,
      titulo: `Adicional de ausência #${r.numero}`,
      pessoa: r.registrado_por_nome,
      quando: r.created_at,
      detalhes: limpar([
        ['Colaborador', r.colaborador_nome],
        ['Projeto', r.projeto_nome],
        ['Dias adicionais', String(r.dias)],
        ['Observação', r.observacao],
      ]),
      link: `${ROTA_ADICIONAL}/aprovacoes`,
      direto: true,
      observacaoAoAprovar: false,
      raw: r,
    }));
  },
  decidir: async (item, { aprovar, comentario }) => {
    await adicionais.decidir(item.id, { aprovar, motivo: aprovar ? null : comentario.trim() });
    return 'ok';
  },
};

// ---------------------------------------------------------------------------
// Horas Extras — aprovar define o destino da hora (modal próprio do módulo)
// ---------------------------------------------------------------------------
const he = {
  chave: 'horas_extras',
  async listar({ user }) {
    const lista = await horasExtras.fetchSolicitacoes();
    return lista.filter((s) => s.aprovador_id === user.id && s.status === 'pendente').map((s) => ({
      chave: `horas_extras:${s.id}`,
      fonte: 'horas_extras',
      id: s.id,
      titulo: `Hora extra${s.numero ? ` #${s.numero}` : ''}`,
      pessoa: s.colaborador_nome,
      quando: s.created_at || s.data_he,
      detalhes: limpar([
        ['Data', s.data_he ? `${dataBr(s.data_he)}${s.hora_inicio ? `, ${String(s.hora_inicio).slice(0, 5)} às ${String(s.hora_fim || '').slice(0, 5)}` : ''}` : null],
        ['Horas', s.minutos != null ? fmtMin(s.minutos) : null],
        ['Projeto', s.projeto_nome],
        ['Motivo', s.motivo || s.justificativa],
      ]),
      link: '/horas/extras/aprovacoes',
      direto: true,
      precisaDestino: true,
      observacaoAoAprovar: false,
      raw: s,
    }));
  },
  // `extra` vem do DestinoHEModal: { destino, compensacao, observacao }.
  decidir: async (item, { aprovar, comentario, extra }, { user }) => {
    if (aprovar) {
      await horasExtras.aprovar(item.id, { ...extra, decididoPor: user.id });
    } else {
      await horasExtras.reprovar(item.id, { motivo: comentario.trim(), decididoPor: user.id });
    }
    await notificarHoraExtra(item.id, 'decidida');
    return 'ok';
  },
};

// ---------------------------------------------------------------------------
// Reembolso e Adiantamento — o aprovador é o perfil do próprio Reembolso
// ---------------------------------------------------------------------------
const reembolso = {
  chave: 'reembolso',
  async listar({ reembolsoProfile }) {
    if (!reembolsoProfile || reembolsoProfile.role !== 'gestor') return [];
    const { data, error } = await supabase
      .from('reembolso_reimbursements')
      .select('*')
      .eq('manager_id', reembolsoProfile.id)
      .or('status.eq.em_analise,accountability_status.eq.em_analise');
    if (error) throw error;
    const pedidos = (data || []).filter((r) => minhaVezNoReembolso(r, reembolsoProfile));
    const prestacoes = (data || []).filter((r) => prestacaoEsperandoGestor(r, reembolsoProfile));

    // Itens só dos pedidos: é deles que sai o excedente e o item proibido.
    const itensPor = {};
    if (pedidos.length) {
      const { data: itens } = await supabase
        .from('reembolso_items').select('*').in('reimbursement_id', pedidos.map((r) => r.id));
      (itens || []).forEach((it) => { (itensPor[it.reimbursement_id] ||= []).push(it); });
    }

    const base = (r) => {
      const adiant = r.kind === 'adiantamento';
      return {
        fonte: 'reembolso',
        id: r.id,
        pessoa: r.requester_name,
        quando: r.created_at,
        link: `/${adiant ? 'adiantamentos' : 'reembolsos'}/${r.id}`,
        observacaoAoAprovar: false,
        raw: r,
      };
    };
    return [
      ...pedidos.map((r) => {
        const motivo = motivoParaAbrirReembolso(r, itensPor[r.id] || []);
        return {
          ...base(r),
          chave: `reembolso:${r.id}`,
          titulo: r.kind === 'adiantamento' ? 'Adiantamento' : 'Reembolso',
          detalhes: limpar([
            ['Valor', formatarMoeda(Number(r.total || 0))],
            ['Data', r.request_date ? dataBr(r.request_date) : null],
            ['Obra / cliente', r.client_obra],
            ['Observação', r.notes],
          ]),
          direto: !motivo,
          motivoAbrir: motivo,
        };
      }),
      ...prestacoes.map((r) => ({
        ...base(r),
        chave: `reembolso-prestacao:${r.id}`,
        titulo: 'Prestação de contas de adiantamento',
        detalhes: limpar([
          ['Adiantado', formatarMoeda(Number(r.total || 0))],
          ['Prestado', r.accountability_total != null ? formatarMoeda(Number(r.accountability_total)) : null],
        ]),
        direto: false,
        motivoAbrir: 'A prestação de contas é conferida nota a nota: abra o adiantamento para decidir.',
      })),
    ];
  },
  // Direto só pelo valor total: com desconto, o item nem chega aqui como direto.
  decidir: async (item, { aprovar, comentario }, { reembolsoProfile }) => {
    const r = item.raw;
    const { error } = await decidirReembolso({
      reembolso: r,
      aprovar,
      actor: reembolsoProfile,
      note: aprovar ? null : comentario.trim(),
      approvedAmount: aprovar ? Number(r.total || 0) : null,
    });
    if (error) throw new Error(error.message);
    return 'ok';
  },
};

export const ADAPTADORES = [dp, ausencia, adicional, folgaCampo, he, atendimento, financeiro, reembolso];
const porChave = Object.fromEntries(ADAPTADORES.map((a) => [a.chave, a]));

/**
 * Tudo o que espera o usuário. Uma fonte que falha não derruba as outras: ela
 * volta em `falhas`, e a tela diz qual módulo não respondeu — sumir calado
 * faria a pessoa achar que não tem nada lá.
 */
export async function listarPendencias(ctx) {
  const resultados = await Promise.allSettled(ADAPTADORES.map((a) => a.listar(ctx)));
  const itens = [];
  const falhas = [];
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') itens.push(...r.value);
    else falhas.push({ fonte: ADAPTADORES[i].chave, erro: r.reason?.message || String(r.reason) });
  });
  return { itens, falhas };
}

export async function decidirPendencia(item, decisao, ctx) {
  const r = await porChave[item.fonte].decidir(item, { comentario: '', ...decisao }, ctx);
  window.dispatchEvent(new Event(EVENTO_APROVACOES));
  return r;
}

/** Disparado a cada decisão, para o contador da barra se atualizar. */
export const EVENTO_APROVACOES = 'aprovacoes_atualizadas';
