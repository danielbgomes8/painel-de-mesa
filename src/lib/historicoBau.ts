/**
 * Histórico do baú — as regras puras. O baú não tem tabela de histórico: cada troca (guardar,
 * pegar, dividir o dinheiro, jogar fora) deixa uma linha no log do combate que começa com 🎒
 * (itens) ou 💰 (dinheiro). O histórico é só essas linhas, da mais nova pra mais velha, agrupadas
 * por dia. É a mesma fonte do recap da sessão (ver `recap.ts`), então as duas contam a mesma coisa.
 *
 * Só existe a partir do dia em que o baú passou a escrever no log (02/10/2026): o que se mexeu
 * antes disso não deixou rastro.
 */
import type { LinhaDoLog } from "./recap";

export const MARCA_DE_ITEM = "🎒";
export const MARCA_DE_DINHEIRO = "💰";
export const MARCAS_DO_BAU = [MARCA_DE_ITEM, MARCA_DE_DINHEIRO];

export type TipoDeEventoDoBau = "item" | "dinheiro";

export type EventoDoBau = {
  /** A frase como foi escrita no log ("🎒 Ana pegou 2× Poção do baú"). */
  texto: string;
  quando: string;
  tipo: TipoDeEventoDoBau;
};

export function ehLinhaDoBau(texto: string): boolean {
  const t = texto.trimStart();
  return MARCAS_DO_BAU.some((m) => t.startsWith(m));
}

/** As trocas do baú no log, da mais nova pra mais velha. Linha com hora ilegível fica de fora. */
export function eventosDoBau(log: LinhaDoLog[]): EventoDoBau[] {
  return log
    .filter((l) => ehLinhaDoBau(l.text) && Number.isFinite(Date.parse(l.created_at)))
    .map((l) => ({
      texto: l.text.trim(),
      quando: l.created_at,
      tipo: (l.text.trimStart().startsWith(MARCA_DE_DINHEIRO) ? "dinheiro" : "item") as TipoDeEventoDoBau,
    }))
    .sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando));
}

export type FiltroDoHistorico = "tudo" | TipoDeEventoDoBau;

export function filtrarEventos(eventos: EventoDoBau[], filtro: FiltroDoHistorico): EventoDoBau[] {
  return filtro === "tudo" ? eventos : eventos.filter((e) => e.tipo === filtro);
}

/** Chave do dia no fuso de quem olha (não em UTC: a sessão da noite não pode cair no "dia seguinte"). */
function chaveDoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Hoje", "Ontem" ou "qui., 01/10" — o que aparece em cima de cada grupo. */
export function rotuloDoDia(quando: string, agora: Date): string {
  const d = new Date(quando);
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  const k = chaveDoDia(d);
  if (k === chaveDoDia(agora)) return "Hoje";
  if (k === chaveDoDia(ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

/** Agrupa por dia, mantendo a ordem (do mais novo pro mais velho) dos grupos e dos eventos. */
export function agruparPorDia(eventos: EventoDoBau[], agora: Date): { rotulo: string; eventos: EventoDoBau[] }[] {
  const grupos: { chave: string; rotulo: string; eventos: EventoDoBau[] }[] = [];
  for (const e of eventos) {
    const chave = chaveDoDia(new Date(e.quando));
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.chave === chave) ultimo.eventos.push(e);
    else grupos.push({ chave, rotulo: rotuloDoDia(e.quando, agora), eventos: [e] });
  }
  return grupos.map(({ rotulo, eventos: es }) => ({ rotulo, eventos: es }));
}

export function horaDoEvento(quando: string): string {
  return new Date(quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
