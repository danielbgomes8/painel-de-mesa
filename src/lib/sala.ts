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

/**
 * Qual sala abrir: o `?sala=` do link manda; sem ele, a última sala em que
 * este aparelho entrou; sem nenhuma das duas, o padrão.
 *
 * A "última sala" existe por causa do app instalado na tela de início: ele
 * abre sempre em `/` (o endereço fica gravado na instalação) e não tem barra
 * de endereço pra trocar. Sem isso, quem joga em outra campanha e instalou o
 * app caía na Sétimo Raio toda vez.
 */
export function escolherSala(daUrl: string | null, ultima: string | null): string {
  if (daUrl) return normalizarCodigoSala(daUrl);
  const lembrada = ultima ? aSlug(ultima) : "";
  return lembrada || SALA_PADRAO;
}

const CHAVE_ULTIMA_SALA = "mesa-ultima-sala";

function lerUltimaSala(): string | null {
  try {
    return localStorage.getItem(CHAVE_ULTIMA_SALA);
  } catch {
    return null;
  }
}

/** Grava a sala em que a pessoa entrou, pra próxima abertura sem `?sala=`. */
export function lembrarSala(codigo: string): void {
  try {
    localStorage.setItem(CHAVE_ULTIMA_SALA, codigo);
  } catch {
    /* aba privada / storage bloqueado — segue sem lembrar */
  }
}

/** Código da sala desta aba (ver `escolherSala`). Só no navegador. */
export function codigoDaSala(): string {
  if (typeof window === "undefined") return SALA_PADRAO;
  return escolherSala(new URLSearchParams(window.location.search).get("sala"), lerUltimaSala());
}

/** Nome com acento das salas que já existem — o código não guarda acento. */
const NOMES_DAS_SALAS: Record<string, string> = { "setimo-raio": "Sétimo Raio" };

/** Rótulo curto pra mostrar no topo e na aba do navegador. */
export function rotuloDaSala(codigo: string): string {
  return (
    NOMES_DAS_SALAS[codigo] ??
    codigo
      .split("-")
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ")
  );
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
