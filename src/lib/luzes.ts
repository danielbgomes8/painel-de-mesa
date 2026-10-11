/**
 * Luzes que acabam (tocha, lamparina, magia de luz...) — as regras puras.
 *
 * Uma luz mora no peão de quem a carrega: nome, alcance em METROS (claro + penumbra, que é até onde
 * se enxerga) e quantos MINUTOS ainda faltam. `minutos = null` é luz que não acaba (visão no escuro);
 * `0` é luz apagada. O Mestre passa o tempo em blocos (10 min, 1 h...) e a luz vai gastando.
 *
 * Num mapa ESCURO (`cena.escura`) a visão automática de cada jogador vai só até onde a luz dele
 * alcança — sem luz acesa, só o quadradinho ao redor. Fora de mapa escuro a luz só conta o tempo.
 * Inimigos enxergam como a cena manda (monstro costuma ter visão no escuro), então não entram aqui.
 *
 * Os números das luzes prontas vêm do SRD 5.2 (api.open5e.com, `srd-2024`), conferidos em 11/10/2026:
 * tocha 20 pés de luz clara + 20 de penumbra por 1 hora; vela 5 + 5 por 1 hora; lamparina 15 + 30;
 * lanterna coberta 30 + 30 (as duas queimam 6 horas por frasco de óleo); luz do dia 60 + 60 por 1 hora.
 * Em metros (1,5 m = 5 pés): 12, 3, 13,5, 18 e 36.
 */
import { alcanceEmPx } from "./visao";
import type { Cena } from "./cenas";

export type Luz = {
  nome: string;
  /** Até onde enxerga com ela, em metros (claro + penumbra). */
  alcance: number;
  /** Minutos que faltam; null = não acaba; 0 = apagada. */
  minutos: number | null;
};

export const ALCANCE_MAXIMO_M = 120;
/** 7 dias: mais que qualquer luz do jogo, e o banco também cobra. */
export const MINUTOS_MAXIMOS = 10080;
/** Sem luz num mapa escuro, o jogador enxerga só o quadradinho em volta (5 pés). */
export const RAIO_NO_ESCURO_M = 1.5;
export const NOME_MAXIMO = 30;

export type LuzPronta = { nome: string; alcance: number; minutos: number | null; dica: string };

export const LUZES_PRONTAS: readonly LuzPronta[] = [
  { nome: "Tocha", alcance: 12, minutos: 60, dica: "12 m · 1 hora" },
  { nome: "Vela", alcance: 3, minutos: 60, dica: "3 m · 1 hora" },
  { nome: "Lamparina", alcance: 13.5, minutos: 360, dica: "13,5 m · 6 horas" },
  { nome: "Lanterna coberta", alcance: 18, minutos: 360, dica: "18 m · 6 horas" },
  { nome: "Magia de luz", alcance: 12, minutos: 60, dica: "12 m · 1 hora" },
  { nome: "Luz do dia", alcance: 36, minutos: 60, dica: "36 m · 1 hora" },
  { nome: "Visão no escuro", alcance: 18, minutos: null, dica: "18 m · não acaba" },
];

/** O que o app aceita de alcance: número positivo até o máximo, uma casa decimal. */
export function alcanceValido(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > ALCANCE_MAXIMO_M) return null;
  const arredondado = Math.round(n * 10) / 10;
  return arredondado > 0 ? arredondado : null;
}

/** Minutos inteiros de 0 ao máximo; null (ou qualquer coisa que não seja número) = não acaba. */
export function minutosValidos(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(MINUTOS_MAXIMOS, Math.round(n)));
}

/** A luz de uma linha do banco (`luz_nome`, `luz_alcance`, `luz_minutos`); null = sem luz. */
export function lerLuz(linha: Record<string, unknown>): Luz | null {
  const alcance = alcanceValido(linha.luz_alcance);
  if (alcance === null) return null;
  const nome = typeof linha.luz_nome === "string" ? linha.luz_nome.trim().slice(0, NOME_MAXIMO) : "";
  return { nome: nome || "Luz", alcance, minutos: minutosValidos(linha.luz_minutos) };
}

/** As colunas que gravam a luz (ou limpam, se for null). */
export function colunasDaLuz(luz: Luz | null): { luz_nome: string | null; luz_alcance: number | null; luz_minutos: number | null } {
  if (!luz) return { luz_nome: null, luz_alcance: null, luz_minutos: null };
  return { luz_nome: luz.nome.trim().slice(0, NOME_MAXIMO) || "Luz", luz_alcance: luz.alcance, luz_minutos: luz.minutos };
}

export function luzDaPronta(p: LuzPronta): Luz {
  return { nome: p.nome, alcance: p.alcance, minutos: p.minutos };
}

export function luzAcesa(luz: Luz | null): boolean {
  return luz !== null && (luz.minutos === null || luz.minutos > 0);
}

/** A luz depois de `minutos` de tempo; a que não acaba fica como está. Nunca passa de 0 pra baixo. */
export function gastarLuz(luz: Luz, minutos: number): Luz {
  if (luz.minutos === null) return luz;
  return { ...luz, minutos: Math.max(0, Math.min(MINUTOS_MAXIMOS, luz.minutos - Math.round(minutos))) };
}

/** Passar o tempo pra trás (desfazer) devolve minutos: só pra luz que gasta. */
export function devolverLuz(luz: Luz, minutos: number): Luz {
  return gastarLuz(luz, -minutos);
}

/** Apagou NESTA passagem de tempo: estava acesa e agora não está. */
export function apagouAgora(antes: Luz | null, depois: Luz | null): boolean {
  return luzAcesa(antes) && !luzAcesa(depois) && antes !== null && antes.minutos !== null;
}

/** "45 min", "1 h", "1 h 30", "apagada", "não acaba". */
export function rotuloDoTempo(luz: Luz): string {
  if (luz.minutos === null) return "não acaba";
  if (luz.minutos <= 0) return "apagada";
  const h = Math.floor(luz.minutos / 60);
  const m = luz.minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** "12 m" / "13,5 m". */
export function rotuloDoAlcance(metros: number): string {
  return `${Number.isInteger(metros) ? metros : String(metros).replace(".", ",")} m`;
}

/** Aviso quando falta pouco: 10 minutos ou menos (e ainda acesa). */
export function acabandoLogo(luz: Luz | null): boolean {
  return luz !== null && luz.minutos !== null && luz.minutos > 0 && luz.minutos <= 10;
}

/**
 * Até onde este jogador enxerga, em px da imagem, ou null = "como a cena manda" (mapa claro, ou quem
 * não é jogador). Em mapa escuro: com luz acesa, o alcance dela; sem, o quadradinho em volta.
 */
export function visaoDoPortadorPx(
  cena: Pick<Cena, "escura" | "grade_px" | "metros" | "largura" | "altura" | "visao_alcance">,
  luz: Luz | null,
  ehJogador: boolean,
): number | null {
  if (!cena.escura || !ehJogador) return null;
  const metros = luzAcesa(luz) && luz ? luz.alcance : RAIO_NO_ESCURO_M;
  return alcanceEmPx({ ...cena, visao_alcance: metros });
}

/** Resumo pro painel e pro telão: quem carrega, a luz e o que falta. */
export function linhaDaLuz(quem: string, luz: Luz): string {
  const tempo = rotuloDoTempo(luz);
  return `${luz.nome} de ${quem} — ${tempo === "apagada" ? "apagada" : tempo === "não acaba" ? "não acaba" : `faltam ${tempo}`}`;
}

/** Texto do log quando a luz apaga. */
export function linhaDeLuzApagada(quem: string, luz: Luz): string {
  return `🔥 ${luz.nome} de ${quem} apagou.`;
}

/** Texto do log quando o Mestre passa o tempo. */
export function linhaDeTempoPassado(minutos: number): string {
  return `⏳ Passaram ${rotuloDeMinutos(minutos)} na escuridão.`;
}

/** "10 min", "1 h", "1 h 30 min" — um tempo solto (o das luzes usa `rotuloDoTempo`). */
export function rotuloDeMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
