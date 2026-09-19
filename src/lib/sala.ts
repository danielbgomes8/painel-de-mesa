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
 * app caía na sala padrão (Salamina) toda vez.
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

/** Evento disparado por `irParaSala` — `useCodigoSala` escuta ele e o
 *  `popstate` (voltar do Android/navegador volta pra campanha anterior). */
const EVENTO_TROCA_DE_SALA = "mesa-sala-mudou";

/** subscribe do external store do código da sala. */
export function assinarTrocaDeSala(aoMudar: () => void): () => void {
  window.addEventListener("popstate", aoMudar);
  window.addEventListener(EVENTO_TROCA_DE_SALA, aoMudar);
  return () => {
    window.removeEventListener("popstate", aoMudar);
    window.removeEventListener(EVENTO_TROCA_DE_SALA, aoMudar);
  };
}

/**
 * Troca de campanha sem recarregar: o endereço ganha o `?sala=` novo (então
 * recarregar e copiar o link continuam certos) e o Painel remonta a sala do
 * zero (`key={codigo}`). É o que o botão de trocar campanha usa — no app
 * instalado não há barra de endereço pra mexer em link.
 */
export function irParaSala(codigo: string): void {
  const url = new URL(window.location.href);
  url.search = ""; // leva só a sala: `?telao=1` é da aba do telão, não daqui
  url.searchParams.set("sala", codigo);
  window.history.pushState(null, "", url);
  window.dispatchEvent(new Event(EVENTO_TROCA_DE_SALA));
  window.scrollTo(0, 0);
}

/** Código digitado à mão ("Forgotten Realms", "cripta-de-ferro-7k2") → código
 *  de sala, ou `null` se não sobrou nada — aqui não cai no padrão, pra um
 *  campo vazio não levar ninguém pra Salamina sem querer. */
export function codigoDigitado(bruto: string): string | null {
  return aSlug(bruto) || null;
}

export type Campanha = {
  codigo: string;
  /** Nome com acento — o código não guarda acento. */
  nome: string;
  mestre?: string;
};

/**
 * Campanhas do grupo, que aparecem pra todo mundo no botão de trocar
 * campanha e na tela de entrada. Campanha nova do grupo entra aqui; uma que
 * não deve aparecer pra quem abre o app fica de fora e é aberta pelo código
 * (campo "outra campanha") — o código da sala é a única "senha" (ver
 * "Segurança" no README).
 */
export const CAMPANHAS: readonly Campanha[] = [
  // O código ficou `setimo-raio` (nome errado que o app teve no começo, vindo
  // da ficha do Tibério) e não muda: todos os dados da campanha e a escolha
  // de personagem salva em cada aparelho (`mesa-identidade:setimo-raio`)
  // estão presos a ele. Só o nome mostrado é Salamina.
  { codigo: "setimo-raio", nome: "Salamina", mestre: "Maeta" },
  { codigo: "forgotten-realms", nome: "Forgotten Realms", mestre: "Diogo" },
];

function campanhaDoCatalogo(codigo: string): Campanha | undefined {
  return CAMPANHAS.find((c) => c.codigo === codigo);
}

/** Rótulo curto pra mostrar no topo e na aba do navegador. */
export function rotuloDaSala(codigo: string): string {
  return (
    campanhaDoCatalogo(codigo)?.nome ??
    codigo
      .split("-")
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ")
  );
}

/** Nome de quem mestra a campanha, quando o catálogo sabe. */
export function mestreDaSala(codigo: string): string | undefined {
  return campanhaDoCatalogo(codigo)?.mestre;
}

/**
 * O que o seletor de campanha mostra: as campanhas do grupo, depois as salas
 * em que este aparelho já entrou (fora do catálogo — uma aberta por código),
 * e a sala aberta agora mesmo que não esteja em nenhuma das duas (chegou por
 * link e ainda não entrou), pra ela aparecer marcada.
 */
export function campanhasParaEscolher(salasDoAparelho: string[], atual: string): Campanha[] {
  const fora = new Set(
    [...salasDoAparelho, atual].filter((s) => s && !campanhaDoCatalogo(s)),
  );
  return [
    ...CAMPANHAS,
    ...[...fora].sort().map((codigo) => ({ codigo, nome: rotuloDaSala(codigo) })),
  ];
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
