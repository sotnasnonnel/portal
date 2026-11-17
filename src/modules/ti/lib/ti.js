import { supabase } from '../../../services/supabase';
import { emailChave } from './regras';

export const BUCKET_TI = 'ti-anexos';

// PGRST205: tabela fora do cache do PostgREST; 42P01: tabela inexistente.
const TABELA_AUSENTE = ['PGRST205', '42P01', 'PGRST202'];
const PAGINA = 1000;
const SEM_PERMISSAO = 'Sem permissão para alterar. Peça o acesso "TI" em Gerenciar acessos.';

async function buscarTudo(tabela, ordem = 'id') {
  const linhas = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase.from(tabela).select('*').order(ordem).range(de, de + PAGINA - 1);
    if (error) {
      if (TABELA_AUSENTE.includes(error.code)) {
        throw new Error('As tabelas do módulo TI ainda não existem no banco (falta aplicar supabase_migration_ti.sql).');
      }
      throw new Error(`Não foi possível carregar ${tabela}: ${error.message}`);
    }
    linhas.push(...data);
    if (data.length < PAGINA) return linhas;
  }
}

async function carregarPessoas() {
  const { data, error } = await supabase.rpc('ti_pessoas');
  // Sem a função, a tela segue: os termos só perdem nome e vínculo.
  if (error) {
    console.warn('TI: ti_pessoas indisponível', error.message);
    return [];
  }
  return data || [];
}

export async function carregarTudo() {
  const [ativos, movimentacoes, termos, pessoas] = await Promise.all([
    buscarTudo('ti_ativos', 'numero_serie'),
    buscarTudo('ti_movimentacoes'),
    buscarTudo('ti_termos'),
    carregarPessoas(),
  ]);
  return {
    ativos, movimentacoes, termos, pessoas,
  };
}

function erroDeGravacao(error) {
  if (error.code === '23505') return 'Já existe um ativo com esse número de série.';
  if (error.code === '42501') return SEM_PERMISSAO;
  return `Não foi possível salvar: ${error.message}`;
}

export async function salvarAtivo(id, valores) {
  const tabela = supabase.from('ti_ativos');
  const consulta = id ? tabela.update(valores).eq('id', id) : tabela.insert(valores);
  const { data, error } = await consulta.select();
  if (error) throw new Error(erroDeGravacao(error));
  if (!data?.length) throw new Error(SEM_PERMISSAO);
  return data[0];
}

export async function excluirAtivo(id) {
  const { data, error } = await supabase.from('ti_ativos').delete().eq('id', id).select('id');
  if (error) throw new Error(`Não foi possível excluir: ${error.message}`);
  if (!data?.length) throw new Error('Sem permissão para excluir este ativo.');
}

/**
 * Movimenta vários ativos de uma vez: grava o histórico e atualiza cada ativo.
 * Novo responsável zera o termo (o termo antigo era de outra pessoa).
 */
export async function movimentar(ativos, {
  para, situacao, data, obs,
}) {
  const novoResp = para ? emailChave(para) : null;
  const historico = ativos.map((a) => ({
    ativo_id: a.id,
    numero_serie: a.numero_serie,
    data,
    de_responsavel: a.responsavel || null,
    para_responsavel: novoResp ?? a.responsavel ?? null,
    de_situacao: a.situacao || null,
    para_situacao: situacao || a.situacao || null,
    obs: obs || null,
  }));
  const { error: errHist } = await supabase.from('ti_movimentacoes').insert(historico);
  if (errHist) throw new Error(erroDeGravacao(errHist));

  const atualizados = [];
  for (const a of ativos) {
    const trocouPessoa = novoResp && emailChave(a.responsavel) !== novoResp;
    const patch = {
      ultima_movimentacao: data,
      ...(novoResp ? { responsavel: novoResp } : {}),
      ...(situacao ? { situacao } : {}),
      ...(trocouPessoa ? {
        situacao_termo: 'Sem termo', data_envio_termo: null, data_assinatura_termo: null, link_termo: null,
      } : {}),
    };
    atualizados.push(await salvarAtivo(a.id, patch));
  }
  return atualizados;
}

// ------------------------------------------------------------- termo (aceite)
/**
 * Dados da pessoa logada para montar o termo dela: modelo (pelo vínculo),
 * admissão e o que já se sabe de CPF / razão social / CNPJ.
 */
export async function carregarMeuTermo() {
  const { data, error } = await supabase.rpc('ti_meu_termo');
  if (error) {
    if (TABELA_AUSENTE.includes(error.code)) {
      throw new Error('O aceite do termo ainda não está no banco (falta aplicar supabase_migration_ti_termo_aceite.sql).');
    }
    throw new Error(`Não foi possível carregar o seu termo: ${error.message}`);
  }
  return data;
}

/**
 * Aceite eletrônico. O banco (ti_aceitar_termo) pega os equipamentos em uso
 * com a pessoa, guarda a cópia, a hora e o IP, e marca todos como assinados.
 */
export async function aceitarTermo({ cpf, identificacao, versao }) {
  const { data, error } = await supabase.rpc('ti_aceitar_termo', {
    p_cpf: cpf, p_ident: identificacao, p_versao: versao,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Último lembrete por e-mail de cada pessoa (só o time de TI lê). */
export async function carregarLembretes() {
  const { data, error } = await supabase.from('ti_termo_lembretes')
    .select('pessoa_email, dia').order('dia', { ascending: false }).limit(5000);
  if (error) return new Map();
  const ultimo = new Map();
  const qtd = new Map();
  for (const l of data) {
    const k = emailChave(l.pessoa_email);
    if (!ultimo.has(k)) ultimo.set(k, l.dia);
    qtd.set(k, (qtd.get(k) || 0) + 1);
  }
  return new Map([...ultimo].map(([k, dia]) => [k, { ultimo: dia, quantidade: qtd.get(k) }]));
}

// ------------------------------------------------------------------ anexos
const TIPOS_OK = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
};
const LIMITE_BYTES = 20 * 1024 * 1024;

export async function enviarAnexo(pasta, file) {
  const tipo = Object.values(TIPOS_OK).includes(file.type)
    ? file.type
    : TIPOS_OK[String(file.name).split('.').pop().toLowerCase()] || '';
  if (!tipo) throw new Error('Formato não aceito. Use PDF, JPG, PNG ou WEBP.');
  if (file.size > LIMITE_BYTES) throw new Error('Arquivo acima de 20 MB.');
  const nomeSeguro = String(file.name).normalize('NFD').replace(/[^\w.-]+/g, '_');
  const path = `${pasta}/${crypto.randomUUID()}-${nomeSeguro}`;
  const { error } = await supabase.storage.from(BUCKET_TI).upload(path, file, { contentType: tipo });
  if (error) throw new Error(`Falha ao enviar o arquivo: ${error.message}`);
  return {
    path, nome: file.name, tipo, enviado_em: new Date().toISOString(),
  };
}

export async function urlDoAnexo(path) {
  const { data, error } = await supabase.storage.from(BUCKET_TI).createSignedUrl(path, 120);
  if (error) throw new Error(`Não foi possível abrir o anexo: ${error.message}`);
  return data.signedUrl;
}

export async function removerAnexos(paths) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(BUCKET_TI).remove(paths);
  if (error) console.warn('TI: anexo não removido do bucket', error.message);
}
