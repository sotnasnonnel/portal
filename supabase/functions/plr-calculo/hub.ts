// deno-lint-ignore-file no-explicit-any

// O que as contas do PLR leem do HUB. Fica aqui porque plr-calculo (a tela do
// portal) e plr-total-colaboradores (a tela do HUB) precisam chegar no mesmo número.

const CHAVES_HUB = ["painel", "setores", "premissas", "variavel", "automaticos"];

export async function carregarHub(backoffice: any, ano: number) {
  const [{ data: parametros, error: ePar }, { data: pessoasHub, error: ePes }] = await Promise.all([
    backoffice.from("plr_parametro").select("chave, valor, atualizado_em").eq("ano", ano).in("chave", CHAVES_HUB),
    backoffice.from("plr_pessoa")
      .select("id, chave, nome, cargo, salario, mult_plr, mult_bonus, setores, setor, ind_setor, metas, bonus, over_mc, sup, variavel, ordem")
      .eq("ano", ano),
  ]);
  const erro = ePar ?? ePes;
  if (erro) return { erro: `backoffice: ${erro.message}` };
  const tem = (chave: string) => (parametros ?? []).some((p: any) => p.chave === chave);
  if (!tem("painel") || !tem("setores")) return { erro: "hub_sem_dados" };
  return { parametros: parametros ?? [], pessoasHub: pessoasHub ?? [] };
}
