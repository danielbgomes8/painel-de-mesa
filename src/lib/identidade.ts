/** Quem é a pessoa nesta sessão. Sem login: fica só no navegador dela,
 *  separado por sala (o mesmo aparelho pode acompanhar mais de uma mesa).
 *
 *  Exposto como "external store" (subscribe + getSnapshot) pra ser lido com
 *  useSyncExternalStore, sem setState em efeito e sem susto de hidratação. */

export type Identidade = { tipo: "mestre" } | { tipo: "jogador"; slug: string };

function chave(sala: string): string {
  return `mesa-identidade:${sala}`;
}

function ler(sala: string): Identidade | null {
  try {
    const cru = localStorage.getItem(chave(sala));
    if (!cru) return null;
    const v = JSON.parse(cru) as Identidade;
    if (v && (v.tipo === "mestre" || (v.tipo === "jogador" && typeof v.slug === "string"))) {
      return v;
    }
    return null;
  } catch {
    return null;
  }
}

// Cache do snapshot: useSyncExternalStore exige que getSnapshot devolva o MESMO
// objeto enquanto nada muda (JSON.parse criaria um novo a cada render).
let cacheSala: string | null = null;
let cacheCru: string | null = null;
let cacheValor: Identidade | null = null;
// Flag separada de invalidação: `cacheCru` por si só não dá pra usar como
// sentinela de "precisa recalcular", porque `null` também é um valor CRU
// legítimo (é o que `localStorage.getItem` devolve depois de um `trocar` —
// ou seja, depois de limparIdentidade). Sem essa flag, invalidar setando só
// `cacheCru = null` batia com esse `null` legítimo e devolvia o valor velho
// do cache — o botão "trocar" parecia não fazer nada.
let cacheValido = false;

function snapshot(sala: string): Identidade | null {
  let cru: string | null = null;
  try {
    cru = localStorage.getItem(chave(sala));
  } catch {
    cru = null;
  }
  if (cacheValido && sala === cacheSala && cru === cacheCru) return cacheValor;
  cacheSala = sala;
  cacheCru = cru;
  cacheValor = ler(sala);
  cacheValido = true;
  return cacheValor;
}

const ouvintes = new Set<() => void>();

function avisar() {
  cacheValido = false; // força recomputar no próximo getSnapshot
  for (const fn of ouvintes) fn();
}

/** subscribe do external store. */
export function assinarIdentidade(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar);
  window.addEventListener("storage", aoMudar);
  return () => {
    ouvintes.delete(aoMudar);
    window.removeEventListener("storage", aoMudar);
  };
}

/** getSnapshot do external store (por sala). */
export function lerIdentidade(sala: string): Identidade | null {
  return snapshot(sala);
}

export function salvarIdentidade(sala: string, identidade: Identidade): void {
  try {
    localStorage.setItem(chave(sala), JSON.stringify(identidade));
  } catch {
    /* aba privada / storage bloqueado — segue sem lembrar */
  }
  avisar();
}

export function limparIdentidade(sala: string): void {
  try {
    localStorage.removeItem(chave(sala));
  } catch {
    /* idem */
  }
  avisar();
}
