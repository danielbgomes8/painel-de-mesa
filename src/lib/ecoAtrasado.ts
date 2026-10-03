/**
 * O tempo real nem sempre entrega os eventos na ordem em que o banco gravou: duas
 * escritas seguidas na mesma ficha (uma das moedas, outra do inventário) podem
 * chegar trocadas. Aplicado às cegas, o evento velho que chega por último apaga
 * da tela o que o novo já tinha mostrado — e a tela fica errada até alguém
 * recarregar (visto de verdade no robô, com o inventário de uma ficha).
 *
 * O banco carimba `updated_at` a cada alteração (trigger `tocar_updated_at`,
 * migration 0001), então um evento mais velho que a linha que a tela já tem é
 * descartado. Igual vale (reentrega do mesmo evento); sem carimbo legível nos
 * dois lados, não dá pra afirmar nada e o evento passa.
 */
export function ecoAtrasado(local: { updated_at?: unknown } | undefined, chegou: { updated_at?: unknown }): boolean {
  if (!local || typeof local.updated_at !== "string" || typeof chegou.updated_at !== "string") return false;
  const tLocal = Date.parse(local.updated_at);
  const tChegou = Date.parse(chegou.updated_at);
  if (!Number.isFinite(tLocal) || !Number.isFinite(tChegou)) return false;
  return tChegou < tLocal;
}
