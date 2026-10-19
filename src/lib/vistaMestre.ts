/**
 * Vista Mestre: o Mestre conduz a câmera dos jogadores ao vivo, como um
 * controle remoto. Ele não transmite a PRÓPRIA tela de edição (pintar névoa
 * num canto não entrega nada pra mesa): abre "controlar a vista da mesa", que
 * mostra o mapa como os jogadores veem, e o zoom e o arrasto dele dali vão por
 * um canal de transmissão (`useVistaMestre`). Quem estiver com "Vista Mestre"
 * ligada — telão ou celular — segue; desligada, cada aparelho olha onde quiser.
 *
 * A vista viaja como o pedaço do mapa em px da imagem, nunca em px de tela:
 * cada aparelho enquadra no próprio tamanho (TV deitada, celular em pé).
 */

import type { Regiao } from "@/lib/cenas";

export type VistaMestre = {
  /** O pedaço do mapa que o Mestre está mostrando, em px da imagem. */
  regiao: Regiao;
  /** O peão que o Mestre focou (abre o cartão dele no telão), ou null. */
  foco: string | null;
};

/** Freio do envio enquanto o Mestre arrasta: ~12 por segundo é liso e leve. */
export const VISTA_INTERVALO_MS = 80;

/** O controle repete a última vista de tempos em tempos: quem abriu a tela
 *  agora (ou reconectou) alcança sem esperar o Mestre mexer. */
export const VISTA_LEMBRETE_MS = 3000;

function numero(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Confere o que chegou pelo canal (aberto: qualquer aparelho poderia mandar
 * lixo). Precisa ser um pedaço com tamanho, que encoste no mapa e não seja
 * absurdamente maior que ele; o foco é um id curto ou null.
 */
export function validarVista(bruto: unknown, mapa: { largura: number; altura: number }): VistaMestre | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;
  const { x, y, w, h } = o;
  if (!numero(x) || !numero(y) || !numero(w) || !numero(h)) return null;
  if (w <= 0 || h <= 0) return null;
  if (w > mapa.largura * 4 || h > mapa.altura * 4) return null;
  if (x + w < 0 || y + h < 0 || x > mapa.largura || y > mapa.altura) return null;
  const foco = typeof o.foco === "string" && o.foco.length > 0 && o.foco.length <= 64 ? o.foco : null;
  return { regiao: { x, y, w, h }, foco };
}

/** O que vai pelo canal (achatado, pra o validador não depender de aninhamento). */
export function pacoteDaVista(v: VistaMestre): { x: number; y: number; w: number; h: number; foco: string | null } {
  return { ...v.regiao, foco: v.foco };
}

/**
 * Vista Mestre ligada ao abrir? O link manda (`?vista=mestre` liga,
 * `?vista=jogador` desliga) — é o jeito de deixar o telão de uma TV sem
 * teclado já seguindo o Mestre. Sem isso, a última escolha deste aparelho; e, sem escolha nenhuma, o `padrao`
 * (o telão abre seguindo o Mestre: é um aparelho de mesa que ninguém fica tocando pra ligar).
 */
export function vistaMestreAoAbrir(busca: string, lembrada: string | null, padrao = false): boolean {
  const daUrl = new URLSearchParams(busca).get("vista");
  if (daUrl === "mestre") return true;
  if (daUrl === "jogador") return false;
  if (lembrada === "1") return true;
  if (lembrada === "0") return false;
  return padrao;
}
