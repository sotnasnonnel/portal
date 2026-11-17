import { perfilEfetivoDp } from '../config/horasPapel';

/**
 * O `user` do AuthContext a partir da linha de colaboradores. Fica fora do
 * provider para servir aos DOIS casos: quem está logado e a pessoa escolhida no
 * "ver como" (config/verComo.js), que precisa do MESMO formato para as telas não
 * perceberem a diferença.
 */
export function montarUsuario(colab, { plrAcesso = null, authId = null } = {}) {
  const rhDp = colab.rh_dp === true;
  // Perfil efetivo no DP: RH que não é gestor/admin navega como 'rh' (perfil real fica no banco).
  const perfilEfetivo = perfilEfetivoDp(colab.perfil, rhDp);
  return {
    id: colab.id,
    nome: colab.nome,
    email: colab.email,
    perfil: perfilEfetivo,
    rhDp,
    // Leitura da Ausência Programada e do Humor da empresa (veAusenciaTodos).
    veAusenciaHumor: colab.ve_ausencia_humor === true,
    solicVistoEm: colab.solic_visto_em || null,
    // Última versão de "Novidades" que a pessoa já viu (config/novidades.js).
    novidadesVistoId: colab.novidades_visto_id || null,
    funcao: colab.funcao || null,
    dataAdmissao: colab.data_admissao || null,
    // Só para o destaque de aniversário da própria pessoa na Home.
    dataNascimento: colab.data_nascimento || null,
    horasGerenciaId: colab.horas_gerencia_id || null,  // gerência p/ ver projetos ao apontar
    horasRole: colab.horas_role || null,               // elevação só-do-Horas (ver horasRoleFromPerfil)
    financeiroRole: colab.financeiro_role || null,     // acesso ao módulo Financeiro
    administrativoRole: colab.administrativo_role || null, // time do Adm (atendente/admin)
    // Capacidade avulsa: trocar o responsável de um chamado do Adm. Não é
    // papel — quem a tem pode ser admin ou atendente. O banco também barra.
    admReatribui: colab.administrativo_reatribui === true,
    programasRole: colab.programas_role || null,           // time comercial dos Programas
    // Capacidade avulsa, como admReatribui: abre SÓ a Consulta do
    // Organograma para quem não tem perfil de DP (ver config/organograma.js).
    organogramaConsulta: colab.organograma_consulta === true,
    // Idem para a tela de Ajustes de Valores — só que esta abre ESCRITA, e
    // a mesma regra está na RLS de precos_itens (ver config/valores.js).
    valoresAjuste: colab.valores_ajuste === true,
    // Idem para Frota e Alojamentos (card "Administrativo"): libera entrar E
    // escrever. Nada a ver com administrativo_role, que é o Atendimento —
    // ver config/setorAdm.js e app_private.setor_adm_time().
    setorAdmAcesso: colab.setor_adm_acesso === true,
    // Idem para o módulo TI (config/ti.js e app_private.ti_time()).
    tiAcesso: colab.ti_acesso === true,
    // 'admin' | 'gestor' | 'usuario' | null (ver config/plr.js).
    plrAcesso,
    authId,
  };
}
