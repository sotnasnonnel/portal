// Descreve COMO editar cada tipo de requisição na tela de "Editar e reenviar"
// (feature de devolução para ajustes). Reaproveita os schemas/validações/payloads
// que já dirigem os formulários de criação — para não divergir das regras.
import {
  CAMPOS_AJUDA_CUSTO, camposVisiveisAjudaCusto, validarAjudaCusto, montarPayloadAjudaCusto,
} from './ajudaCusto.js';
import { CAMPOS_MAPEAMENTO, validarMapeamento, montarPayloadMapeamento } from './mapeamento.js';
import { CAMPOS_NOVA_VAGA, validarNovaVaga, montarPayloadNovaVaga } from './novaVaga.js';
import { CAMPOS, camposVisiveis, validar as validarContratacao, montarPayload as montarPayloadContratacao } from './formularioContratacao.js';
import { parseCurrency } from '../utils/currencyMask.js';

// Campos do envelope editáveis diretamente (tipos sem tabela de detalhe).
const CAMPO_JUSTIFICATIVA = { id: 'justificativa', label: 'Justificativa', tipo: 'textarea', obrigatorio: true };

export const REENVIO_CONFIG = {
  // ---- tipos com tabela de detalhe (schema dirige tudo) ----
  ajuda_custo: {
    modo: 'detalhe', tabela: 'ajudas_custo', titulo: 'Ajuda de Custo', bucket: 'ajuda-custo-anexos',
    campos: CAMPOS_AJUDA_CUSTO, camposVisiveis: camposVisiveisAjudaCusto,
    validar: validarAjudaCusto, montarPayload: montarPayloadAjudaCusto,
  },
  mapeamento: {
    modo: 'detalhe', tabela: 'mapeamentos', titulo: 'Mapeamento', bucket: 'mapeamento-anexos',
    campos: CAMPOS_MAPEAMENTO, validar: validarMapeamento, montarPayload: montarPayloadMapeamento,
  },
  nova_vaga: {
    modo: 'detalhe', tabela: 'vagas', titulo: 'Nova Vaga', bucket: 'vaga-anexos',
    campos: CAMPOS_NOVA_VAGA, validar: validarNovaVaga, montarPayload: montarPayloadNovaVaga,
    foraDoQuadro: true,
    funcaoAlvoDe: (form) => form.funcao || null,
  },
  formulario_contratacao: {
    modo: 'detalhe', tabela: 'formularios_contratacao', titulo: 'Formulário de Contratação',
    campos: CAMPOS, camposVisiveis, validar: validarContratacao, montarPayload: montarPayloadContratacao,
    funcaoAlvoDe: (form) => form.cargo_nivel || null,
  },

  // ---- tipos cujo conteúdo mora no envelope (sem tabela de detalhe) ----
  aumento_salario: {
    modo: 'envelope', titulo: 'Alteração de Cargo / Função',
    campos: [
      { id: 'funcao_proposta', label: 'Nova função', tipo: 'text', obrigatorio: false },
      { id: 'salario_proposto', label: 'Novo valor (R$)', tipo: 'moeda', obrigatorio: false },
      CAMPO_JUSTIFICATIVA,
    ],
    // Ao menos uma alteração (valor OU função) — mesma regra da criação.
    validar: (f) => (
      (!String(f.funcao_proposta || '').trim() && f.salario_proposto == null)
        ? [{ id: 'funcao_proposta', label: 'Informe novo valor ou nova função' }] : []
    ),
    montarPatch: (f) => ({
      funcao_proposta: String(f.funcao_proposta || '').trim() || null,
      salario_proposto: parseCurrency(f.salario_proposto),   // campo moeda -> número
      justificativa: String(f.justificativa || '').trim() || null,
    }),
    funcaoAlvoDe: (form) => form.funcao_proposta || null,
  },
  desligamento: {
    modo: 'envelope', titulo: 'Desligamento',
    campos: [CAMPO_JUSTIFICATIVA],
    validar: (f) => (String(f.justificativa || '').trim() ? [] : [CAMPO_JUSTIFICATIVA]),
    montarPatch: (f) => ({ justificativa: String(f.justificativa || '').trim() }),
  },
};

export const getReenvioConfig = (tipo) => REENVIO_CONFIG[tipo] || null;

// Dono da requisição = quem a abriu (gestor_id). Comparação normalizada porque
// os ids trafegam ora do banco, ora do contexto de auth.
const ehDono = (sol, userId) => {
  const a = String(sol?.gestor_id || '').trim().toLowerCase();
  const b = String(userId || '').trim().toLowerCase();
  return !!a && a === b;
};

/**
 * EDITAR (recomeça a cadeia): só o solicitante e só enquanto a requisição está
 * EM ANDAMENTO. Concluída/cancelada não se mexe mais; reprovada segue pelo
 * caminho de "Responder" abaixo, que volta a quem reprovou sem reiniciar tudo.
 */
export const podeEditarRequisicao = (sol, userId) => (
  !!getReenvioConfig(sol?.tipo) && sol?.status === 'pendente' && ehDono(sol, userId)
);

/** RESPONDER (volta a quem reprovou): só o solicitante, só quando reprovada. */
export const podeResponderRequisicao = (sol, userId) => (
  !!getReenvioConfig(sol?.tipo) && sol?.status === 'reprovada' && ehDono(sol, userId)
);
