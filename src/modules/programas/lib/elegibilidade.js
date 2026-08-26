import { supabase } from '../../../services/supabase';
import { supabaseBackoffice } from '../../../services/supabaseBackoffice';

/**
 * Elegibilidade da indicação da Alavanca — a checagem automática que a planilha
 * pede ("o sistema deve fazer uma consulta no banco de dados de empresa e
 * contato do módulo comercial").
 *
 * A base comercial vive no projeto backoffice_phd (accounts / contacts), que o
 * Portal já lê para o Organograma. Não consultamos as tabelas direto: o cliente
 * do backoffice usa a chave ANON sem sessão, e abrir leitura anon na carteira
 * de clientes exporia tudo no bundle. Em vez disso chamamos a RPC
 * alavanca_checar_base, que recebe o que a pessoa digitou e devolve só o
 * veredito (ver supabase_migration_programas_backoffice.sql).
 *
 * TRÊS resultados, e não dois, porque as regras do programa não são binárias:
 *   elegivel      -> empresa fora da base. Regra: "empresa fora da base deve ser
 *                    automaticamente elegível".
 *   nao_elegivel  -> empresa E contato já cadastrados (o cliente já foi
 *                    contatado), ou empresa já indicada antes por outra pessoa
 *                    (vale quem indicou primeiro).
 *   em_analise    -> empresa na base, mas o contato é novo. É a regra da "nova
 *                    oportunidade em cliente já existente": vale se o comercial
 *                    ainda não tinha mapeado — e só o comercial sabe disso.
 *                    Chutar "elegível" aqui prometeria prêmio que pode não sair.
 */

const RESULTADO_VAZIO = {
  elegibilidade: 'pendente',
  motivo: 'Não foi possível consultar a base comercial agora. O time comercial vai avaliar manualmente.',
};

/** Indicação anterior da mesma empresa (regra 4: vale quem indicou primeiro). */
async function indicacaoAnterior(empresa) {
  const { data, error } = await supabase.rpc('alavanca_indicacao_anterior', { p_empresa: empresa });
  if (error) return null;
  return Array.isArray(data) ? data[0] || null : data || null;
}

/** Consulta a base comercial. Devolve null quando a RPC não está disponível. */
async function checarBaseComercial({ empresa, contato, email }) {
  const { data, error } = await supabaseBackoffice.rpc('alavanca_checar_base', {
    p_empresa: empresa,
    p_contato: contato,
    p_email: email,
  });
  if (error) {
    console.warn('[alavanca] checagem da base comercial falhou:', error.message);
    return null;
  }
  return data || null;
}

/**
 * Veredito da indicação. Nunca lança: uma falha de rede na base comercial não
 * pode impedir alguém de indicar — cai em 'pendente' e o comercial resolve.
 */
export async function avaliarElegibilidade({ empresa, contato, email }) {
  const nomeEmpresa = (empresa || '').trim();
  if (!nomeEmpresa) return RESULTADO_VAZIO;

  // A duplicidade interna vem primeiro: mesmo que a empresa seja nova para o
  // comercial, se outro colaborador já indicou, a premiação é dele.
  const anterior = await indicacaoAnterior(nomeEmpresa);
  if (anterior) {
    const quando = anterior.criado_em
      ? new Date(anterior.criado_em).toLocaleDateString('pt-BR')
      : '';
    return {
      elegibilidade: 'nao_elegivel',
      motivo: `Esta empresa já foi indicada por ${anterior.nome}${quando ? ` em ${quando}` : ''}. `
        + 'Pelas regras do programa, a premiação fica com quem indicou primeiro.',
    };
  }

  const base = await checarBaseComercial({ empresa: nomeEmpresa, contato, email });
  if (!base) return RESULTADO_VAZIO;

  const empresaCadastrada = base.empresa_cadastrada || nomeEmpresa;

  if (!base.empresa_na_base) {
    return {
      elegibilidade: 'elegivel',
      motivo: 'A empresa indicada não está na base do comercial — indicação elegível pelas regras do programa.',
    };
  }

  if (base.contato_na_base) {
    return {
      elegibilidade: 'nao_elegivel',
      motivo: `A empresa "${empresaCadastrada}" e o contato indicado já constam na base do comercial, `
        + 'ou seja, o cliente já foi contatado previamente.',
    };
  }

  return {
    elegibilidade: 'em_analise',
    motivo: `A empresa "${empresaCadastrada}" já está na base do comercial, mas o contato indicado é novo. `
      + 'A premiação vale se a oportunidade ainda não tiver sido mapeada — o time comercial vai confirmar.',
  };
}

/** Frase que aparece para quem indicou, logo depois do envio. */
export const MENSAGEM_ELEGIBILIDADE = {
  elegivel: 'Sua indicação é elegível 🎉',
  em_analise: 'Sua indicação depende de confirmação do comercial',
  nao_elegivel: 'Sua indicação não é elegível',
  pendente: 'Sua indicação foi registrada',
};
