/** Resolução do código da sala (campanha). Uma sala por mesa; o mesmo deploy
 *  serve várias sem uma interferir na outra. */

export const SALA_PADRAO = process.env.NEXT_PUBLIC_SALA_PADRAO || "setimo-raio";

/** Minúsculo, sem acento, só letra/número/hífen. Devolve "" quando não sobra nada. */
function aSlug(bruto: string): string {
  return bruto
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

/** Deixa um texto livre num código de sala válido (cai no padrão se ficar vazio). */
export function normalizarCodigoSala(bruto: string): string {
  return aSlug(bruto) || SALA_PADRAO;
}

/** Código da sala desta aba: `?sala=...` na URL, ou o padrão. Só no navegador. */
export function codigoDaSala(): string {
  if (typeof window === "undefined") return SALA_PADRAO;
  const bruto = new URLSearchParams(window.location.search).get("sala");
  return bruto ? normalizarCodigoSala(bruto) : SALA_PADRAO;
}

/** Rótulo curto pra mostrar no topo. */
export function rotuloDaSala(codigo: string): string {
  return codigo
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/** slug a partir de um nome; garante que não colide com os `existentes`. */
export function slugUnico(nome: string, existentes: Iterable<string>): string {
  const base = aSlug(nome) || "pj";
  const usados = new Set(existentes);
  if (!usados.has(base)) return base;
  let i = 2;
  while (usados.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}
