import { supabaseBackoffice } from '../../../services/supabaseBackoffice';
import { distinctMonths, resolveDefaultMonth } from '../../../pages/Gestor/organograma/organogramaData';

/**
 * Iniciativas da Inovação — as soluções que a PHD JÁ TEM e onde elas estão
 * aplicadas.
 *
 * O dado mora no outro projeto Supabase (backoffice_phd), que é a fonte da
 * verdade: quem mantém isso é a tela Operação > Ferramentas, e copiar para o
 * portal criaria duas listas para divergirem.
 *
 * A leitura sai por duas VIEWS (`portal_inovacao_*`), não pelas tabelas: o
 * portal fala com aquele projeto pela chave anon e sem sessão — como já faz
 * com o organograma —, e a tabela de uso carrega custo, ganho e taxa/hora, que
 * não têm por que sair de lá. A view é o recorte do que pode.
 *
 * As duas consultas são separadas e casadas aqui porque a view de aplicações
 * não tem FK declarada para a de iniciativas — o PostgREST não faria o embed.
 */

/**
 * Tom da etiqueta por estágio. Mapa explícito, e não classe derivada do texto:
 * o estágio é digitado no backoffice, e um acento a mais viraria uma classe
 * que não existe — a etiqueta sumiria sem ninguém entender por quê.
 */
const TOM_ESTAGIO = {
  'IDEIA': 'tom-neutro',
  'DESENVOLVIMENTO': 'tom-andamento',
  'USO EM ATUAÇÃO': 'tom-ok',
  'FATURAMENTO': 'tom-destaque',
};

export const tomDoEstagio = (estagio) => TOM_ESTAGIO[(estagio || '').toUpperCase()] || 'tom-neutro';

/** Área do backoffice -> nome por extenso. Fora do mapa, mostra o código. */
const AREA_LABEL = {
  INO: 'Inovação',
  OPE: 'Operação',
  PAR: 'Parceria',
};

export const areaLabel = (sigla) => AREA_LABEL[sigla] || sigla || '—';

/** "AURA-CT03-BORB" — o código que a obra tem no organograma. */
const nomeDaObra = (a) => a.cod_phd || a.cod_ct || `Obra ${a.obra_id}`;

/**
 * Uma aplicação está ATIVA enquanto não tem fim, ou o fim ainda não chegou.
 * A view já descarta as excluídas; o encerramento é dado, não exclusão.
 */
const estaAtiva = (a) => !a.fim || a.fim >= new Date().toISOString().slice(0, 10);

export async function listarIniciativas() {
  const [iniciativas, aplicacoes] = await Promise.all([
    supabaseBackoffice
      .from('portal_inovacao_iniciativas')
      .select('id, titulo, subtitulo, area, estagio, responsavel, data_estagio, ordem'),
    supabaseBackoffice
      .from('portal_inovacao_aplicacoes')
      .select('id, iniciativa_id, tipo_local, obra_id, cod_phd, cod_ct, produto, gerente, obra_status, area_ga, inicio, fim'),
  ]);

  if (iniciativas.error) {
    throw new Error(`Não consegui ler as iniciativas da Inovação: ${iniciativas.error.message}`);
  }
  if (aplicacoes.error) {
    throw new Error(`Não consegui ler onde as iniciativas estão aplicadas: ${aplicacoes.error.message}`);
  }

  const porIniciativa = new Map();
  (aplicacoes.data || []).forEach((a) => {
    const lista = porIniciativa.get(a.iniciativa_id) || [];
    lista.push({
      ...a,
      // A obra vem do organograma; a área do backoffice vem escrita na própria
      // linha. Quem lê quer o lugar, não a coluna de onde ele saiu.
      onde: a.tipo_local === 'obra' ? nomeDaObra(a) : (a.area_ga || '—'),
      ativa: estaAtiva(a),
    });
    porIniciativa.set(a.iniciativa_id, lista);
  });

  return (iniciativas.data || [])
    .map((i) => {
      const aplicacoesDaLinha = (porIniciativa.get(i.id) || [])
        .sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.onde.localeCompare(b.onde, 'pt-BR'));
      return {
        ...i,
        aplicacoes: aplicacoesDaLinha,
        ativas: aplicacoesDaLinha.filter((a) => a.ativa).length,
      };
    })
    // Mais aplicada primeiro: a pergunta de quem chega é "o que já está
    // rodando", e a `ordem` do backoffice é da tela de lá, não desta.
    .sort((a, b) => b.ativas - a.ativas || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

/**
 * Obras (contratos) para escolher no pedido — o `obra_cod_phd` do organograma,
 * do mês vigente. Mesma fonte e mesma regra de mês do Cartão Virtual do
 * Financeiro: se cada tela escolher o mês do seu jeito, duas listas de obra
 * divergem no primeiro virar de mês.
 *
 * Lista ABERTA, não só as obras da pessoa: o organograma não guarda e-mail,
 * então casar o usuário do portal com a alocação sairia por nome — e um
 * homônimo escolheria a obra errada em silêncio.
 */
export async function listarObras() {
  const { data: meses, error: eMeses } = await supabaseBackoffice
    .from('organograma_meses').select('mes');
  if (eMeses) throw new Error(`Não consegui ler as obras: ${eMeses.message}`);

  const mes = resolveDefaultMonth(distinctMonths(meses), new Date());
  if (!mes) return [];

  const { data, error } = await supabaseBackoffice
    .from('organograma_alocacao').select('obra_cod_phd').eq('mes', mes);
  if (error) throw new Error(`Não consegui ler as obras: ${error.message}`);

  return [...new Set((data || []).map((r) => r.obra_cod_phd).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
