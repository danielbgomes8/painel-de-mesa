/** PIN do Mestre: regras puras (sem banco), testadas em `pinMestre.test.ts`.
 *
 *  É uma trava contra o toque sem querer no "Sou o Mestre", não contra ataque:
 *  o banco é aberto de propósito. Por isso o PIN é curto (4 a 6 dígitos) e o
 *  banco guarda só o SHA-256 dele, misturado com o código da sala (o mesmo PIN
 *  em duas campanhas não dá o mesmo valor guardado). */

/** 4 a 6 dígitos, só números. */
export function pinValido(texto: string): boolean {
  return /^\d{4,6}$/.test(texto);
}

/** Deixa só os dígitos (o campo aceita colar "12 34"), no máximo 6. */
export function limparPin(bruto: string): string {
  return bruto.replace(/\D/g, "").slice(0, 6);
}

/** SHA-256 em hexadecimal de `sala:pin`. */
export async function hashDoPin(codigoSala: string, pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${codigoSala}:${pin}`);
  const resumo = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(resumo), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** O PIN digitado bate com o guardado? Sem nada guardado, ninguém precisa de PIN. */
export async function pinConfere(codigoSala: string, pin: string, guardado: string | null): Promise<boolean> {
  if (!guardado) return true;
  return (await hashDoPin(codigoSala, pin)) === guardado;
}
