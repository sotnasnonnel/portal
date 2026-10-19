// Casamento por nome entre o cadastro do portal e o do backoffice (hub).
// Não há chave comum: o portal guarda o nome completo do DP ("IASMIN APARECIDA
// TEIXEIRA DOS SANTOS") e o hub o nome curto ("Iasmin Santos").
//
// Regra: o nome do hub casa com uma pessoa do portal quando o primeiro nome é
// o mesmo e todos os outros pedaços aparecem no nome completo. Só vale par
// único dos dois lados: foto de outra pessoa é pior que iniciais.
//
// Sem dependência de Deno: casar.test.ts roda no `node --test`.

const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

export function partes(nome: string): string[] {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // acentos do NFD, em escape: o arquivo fica ASCII
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((p) => p && !PARTICULAS.has(p));
}

function cabe(curto: string[], completo: string[]): boolean {
  if (curto.length < 2 || curto[0] !== completo[0]) return false;
  const set = new Set(completo);
  return curto.every((p) => set.has(p));
}

type Portal = { id: string; nome: string };
type Hub = { full_name: string; foto_path: string };

/** Map id do portal -> foto_path do hub, só dos pares únicos. */
export function casarFotos(portal: Portal[], hub: Hub[]): Map<string, string> {
  const pp = portal.map((p) => ({ id: p.id, partes: partes(p.nome) }));
  const porPortal = new Map<string, Hub[]>();
  const porHub = new Map<Hub, string[]>();

  for (const h of hub) {
    const curto = partes(h.full_name);
    for (const p of pp) {
      if (!cabe(curto, p.partes)) continue;
      porPortal.set(p.id, [...(porPortal.get(p.id) || []), h]);
      porHub.set(h, [...(porHub.get(h) || []), p.id]);
    }
  }

  const fotos = new Map<string, string>();
  for (const [id, hs] of porPortal) {
    if (hs.length === 1 && porHub.get(hs[0])!.length === 1) fotos.set(id, hs[0].foto_path);
  }
  return fotos;
}
