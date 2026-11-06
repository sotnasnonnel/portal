import { supabase } from '../../../services/supabase';
import { DEFAULT_CFG } from './regras';

export const BUCKET_FROTA = 'frota-anexos';

/** Coleção da tela -> tabela. */
export const TABELAS = {
  veiculos: 'frota_veiculos',
  mensal: 'frota_mensal',
  ocorrencias: 'frota_ocorrencias',
  condutores: 'frota_condutores',
  manutencoes: 'frota_manutencoes',
  faturas: 'frota_faturas',
};

/**
 * Coleções que podem ainda não existir no banco: a tabela chega numa migração
 * à parte (supabase_migration_frota_faturas.sql). Sem ela, o resto da Frota abre
 * e só a tela de Faturas avisa.
 */
const OPCIONAIS = ['faturas'];
// PGRST205: tabela fora do cache do PostgREST; 42P01: tabela inexistente.
const TABELA_AUSENTE = ['PGRST205', '42P01'];

// O PostgREST corta em 1.000 linhas e não avisa. Só o controle mensal já passa
// disso em dois anos (cerca de 66 veículos x 12 meses), e os totais do painel
// sairiam errados sem erro nenhum.
const PAGINA = 1000;

async function buscarTudo(tabela, opcional = false) {
  const linhas = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase.from(tabela).select('*').order('id').range(de, de + PAGINA - 1);
    if (error && opcional && TABELA_AUSENTE.includes(error.code)) return null;
    if (error) throw new Error(`Não foi possível carregar ${tabela}: ${error.message}`);
    linhas.push(...data);
    if (data.length < PAGINA) return linhas;
  }
}

/** Lista da coleção; `null` quando a tabela opcional ainda não existe. */
export async function carregarColecao(col) {
  return buscarTudo(TABELAS[col], OPCIONAIS.includes(col));
}

/** Tudo de uma vez. `ausentes` lista as coleções opcionais sem tabela. */
export async function carregarTudo() {
  const cols = Object.keys(TABELAS);
  const listas = await Promise.all(cols.map(carregarColecao));
  return {
    dados: Object.fromEntries(cols.map((c, i) => [c, listas[i] || []])),
    ausentes: cols.filter((c, i) => listas[i] === null),
  };
}

export async function carregarConfig() {
  const { data, error } = await supabase.from('frota_config').select('*').maybeSingle();
  if (error) throw new Error(`Não foi possível carregar os parâmetros: ${error.message}`);
  return data ? { ...DEFAULT_CFG, ...data } : { ...DEFAULT_CFG };
}

/** Linha vazia aqui é a RLS barrando: UPDATE e DELETE barrados não geram erro. */
const SEM_PERMISSAO = 'Sem permissão para alterar. Peça acesso ao responsável pela frota.';

function mensagemDeErro(error) {
  if (error.code === '23505') return 'Já existe um registro com essa chave. Abra o existente para editar.';
  if (error.code === '42501') return SEM_PERMISSAO;
  return `Não foi possível salvar: ${error.message}`;
}

export async function salvarRegistro(col, id, valores) {
  const tabela = supabase.from(TABELAS[col]);
  const consulta = id ? tabela.update(valores).eq('id', id) : tabela.insert(valores);
  const { data, error } = await consulta.select();
  if (error) throw new Error(mensagemDeErro(error));
  if (!data?.length) throw new Error(SEM_PERMISSAO);
  return data[0];
}

/** Grava vários de uma vez (Gerar competência). Tudo entra ou nada entra. */
export async function inserirVarios(col, linhas) {
  if (!linhas.length) return;
  const { data, error } = await supabase.from(TABELAS[col]).insert(linhas).select('id');
  if (error) throw new Error(mensagemDeErro(error));
  if ((data?.length || 0) !== linhas.length) throw new Error(SEM_PERMISSAO);
}

export async function excluirRegistro(col, id) {
  const { data, error } = await supabase.from(TABELAS[col]).delete().eq('id', id).select('id');
  if (error) throw new Error(`Não foi possível excluir: ${error.message}`);
  if (!data?.length) throw new Error('Sem permissão para excluir este registro.');
}

export async function salvarConfig(cfg) {
  const { intervalo_revisao_km, margem_revisao_km, validade_termo_meses, alerta_dias, margem_revisao_dias } = cfg;
  const { data, error } = await supabase.from('frota_config')
    .update({ intervalo_revisao_km, margem_revisao_km, validade_termo_meses, alerta_dias, margem_revisao_dias })
    .eq('id', true)
    .select();
  if (error) throw new Error(`Não foi possível salvar: ${error.message}`);
  if (!data?.length) throw new Error('Sem permissão para alterar os parâmetros.');
  return { ...DEFAULT_CFG, ...data[0] };
}

// ------------------------------------------------------------------ anexos
const TIPOS_OK = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
};
const LIMITE_BYTES = 20 * 1024 * 1024;

function tipoDoArquivo(file) {
  if (Object.values(TIPOS_OK).includes(file.type)) return file.type;
  return TIPOS_OK[String(file.name).split('.').pop().toLowerCase()] || '';
}

/** Sobe um arquivo e devolve o que vai para o jsonb do registro. */
export async function enviarAnexo(col, file, tipoDoc) {
  const tipo = tipoDoArquivo(file);
  if (!tipo) throw new Error('Formato não aceito. Use PDF, JPG, PNG ou WEBP.');
  if (file.size > LIMITE_BYTES) throw new Error('Arquivo acima de 20 MB.');
  const nomeSeguro = String(file.name).normalize('NFD').replace(/[^\w.-]+/g, '_');
  const path = `${col}/${crypto.randomUUID()}-${nomeSeguro}`;
  const { error } = await supabase.storage.from(BUCKET_FROTA).upload(path, file, { contentType: tipo });
  if (error) throw new Error(`Falha ao enviar o arquivo: ${error.message}`);
  return {
    path, nome: file.name, tipo, enviado_em: new Date().toISOString(), ...(tipoDoc ? { tipo_doc: tipoDoc } : {}),
  };
}

/** Bucket privado: o arquivo só abre por URL assinada. */
export async function urlDoAnexo(path, opcoes) {
  const { data, error } = await supabase.storage.from(BUCKET_FROTA).createSignedUrl(path, 120, opcoes);
  if (error) throw new Error(`Não foi possível abrir o anexo: ${error.message}`);
  return data.signedUrl;
}

/** Não bloqueia a tela: o registro já foi gravado, sobra só um arquivo órfão. */
export async function removerAnexos(paths) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(BUCKET_FROTA).remove(paths);
  if (error) console.warn('Frota: anexo não removido do bucket', error.message);
}
