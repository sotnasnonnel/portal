// Tipo do lançamento. "Adiantamento" reaproveita todo o fluxo de reembolso,
// só não tem NF (foto/importação). A diferença visual/rotas vem deste mapa.
export const KIND = { REEMBOLSO: "reembolso", ADIANTAMENTO: "adiantamento" };

const META = {
  reembolso: {
    kind: "reembolso",
    base: "/reembolsos",
    plural: "Reembolsos",
    singular: "reembolso",
    novo: "Novo reembolso",
    allowNf: true,
  },
  adiantamento: {
    kind: "adiantamento",
    base: "/adiantamentos",
    plural: "Adiantamentos",
    singular: "adiantamento",
    novo: "Novo adiantamento",
    allowNf: false,
  },
};

// Sempre cai em 'reembolso' por padrão (compatível com registros sem kind).
export function kindMeta(kind) {
  return META[kind] ?? META.reembolso;
}
