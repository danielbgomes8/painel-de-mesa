/** Até esse tamanho o nome aparece inteiro no telão. */
const LIMITE_NOME_NO_TELAO = 14;

/**
 * Nome pra ler de longe no telão: "Thorgrim Martelo de Pedra" vira "Thorgrim". Nome curto fica como está, e o número
 * que separa inimigos iguais é mantido ("Goblin Batedor Chefe 2" → "Goblin 2"; sem ele, dois goblins ficariam iguais).
 * Só pra tela: o nome completo continua na ficha, no log e em todo o resto.
 */
export function nomeCurtoDoTelao(nome: string): string {
  const limpo = nome.trim().replace(/\s+/g, " ");
  if (limpo.length <= LIMITE_NOME_NO_TELAO) return limpo;
  const partes = limpo.split(" ");
  if (partes.length === 1) return limpo;
  const ultimo = partes[partes.length - 1];
  return /^\d+$/.test(ultimo) ? `${partes[0]} ${ultimo}` : partes[0];
}
