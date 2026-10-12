/**
 * Relógios de tensão — um círculo dividido em fatias que o Mestre enche aos poucos ("o ritual termina", "a guarda
 * chega", "a masmorra desmorona"). A mesa vê o relógio encher; quando fecha, acontece o que o Mestre anotou.
 *
 * Só o Mestre cria e mexe. Cada relógio pode ficar só pra ele (`visivel = false`, preparo de sessão) ou aparecer pra
 * mesa. A **consequência** é segredo até o relógio fechar: só então a mesa a lê. Esconde NA TELA, como o resto
 * (o banco é aberto, ver README "Segurança").
 */

export type Relogio = {
  id: string;
  room_code: string;
  nome: string;
  /** Quantas fatias tem (4, 6, 8, 10 ou 12). */
  fatias: number;
  /** Quantas já estão cheias, de 0 a `fatias`. */
  cheias: number;
  /** Falso = só o Mestre vê. */
  visivel: boolean;
  /** O que acontece quando fecha; a mesa só lê depois que fecha. */
  consequencia: string;
  created_at: string;
};

export const FATIAS_VALIDAS = [4, 6, 8, 10, 12] as const;
export const RELOGIOS_MAXIMOS = 20;
export const NOME_MAXIMO = 60;
export const CONSEQUENCIA_MAXIMA = 140;

function inteiro(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
}

/** O número de fatias que o app aceita; qualquer outro valor vira 6 (o do meio). */
export function fatiasValidas(v: unknown): number {
  const n = inteiro(v);
  return n !== null && (FATIAS_VALIDAS as readonly number[]).includes(n) ? n : 6;
}

export function normalizarRelogio(linha: unknown): Relogio | null {
  if (!linha || typeof linha !== "object") return null;
  const o = linha as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id) return null;
  const fatias = fatiasValidas(o.fatias);
  const cheias = Math.max(0, Math.min(fatias, inteiro(o.cheias) ?? 0));
  return {
    id: o.id,
    room_code: typeof o.room_code === "string" ? o.room_code : "",
    nome: typeof o.nome === "string" ? o.nome.slice(0, NOME_MAXIMO) : "",
    fatias,
    cheias,
    visivel: o.visivel !== false,
    consequencia: typeof o.consequencia === "string" ? o.consequencia.slice(0, CONSEQUENCIA_MAXIMA) : "",
    created_at: typeof o.created_at === "string" ? o.created_at : "",
  };
}

export function estaCheio(r: Pick<Relogio, "fatias" | "cheias">): boolean {
  return r.cheias >= r.fatias;
}

/** Nome pra mostrar: vazio vira "Relógio". */
export function nomeDoRelogio(r: Pick<Relogio, "nome">): string {
  return r.nome.trim() || "Relógio";
}

/** O relógio com `delta` fatias a mais (ou a menos), sempre entre 0 e o total. */
export function avancar(r: Relogio, delta: number): Relogio {
  return { ...r, cheias: Math.max(0, Math.min(r.fatias, r.cheias + Math.round(delta))) };
}

/** O que cada um enxerga: a mesa só os liberados; o Mestre, todos. Mais antigos primeiro. */
export function relogiosVisiveis(lista: readonly Relogio[], mestre: boolean): Relogio[] {
  return (mestre ? [...lista] : lista.filter((r) => r.visivel)).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** A consequência só vai pra mesa quando o relógio fecha; o Mestre a lê sempre. */
export function consequenciaVisivel(r: Relogio, mestre: boolean): string {
  return mestre || estaCheio(r) ? r.consequencia.trim() : "";
}

/** "Ritual: 3 de 6". */
export function rotuloDoRelogio(r: Relogio): string {
  return `${nomeDoRelogio(r)}: ${r.cheias} de ${r.fatias}`;
}

/** Linha do log quando o Mestre mexe: avançar, voltar e (de propósito destacado) fechar. */
export function linhaDeRelogio(antes: Relogio, depois: Relogio): string | null {
  if (antes.cheias === depois.cheias) return null;
  if (estaCheio(depois) && !estaCheio(antes)) {
    const c = depois.consequencia.trim();
    return `⏰ ${nomeDoRelogio(depois)} fechou (${depois.fatias} de ${depois.fatias})!${c ? ` ${c}` : ""}`;
  }
  return `⏳ ${nomeDoRelogio(depois)}: ${depois.cheias} de ${depois.fatias}`;
}

/**
 * As fatias do círculo pra desenhar em SVG: cada uma é um setor com o `d` do caminho, de cima, no sentido horário.
 * `raio` e o centro `(cx, cy)` em unidades do desenho; `folga` abre uma frestinha entre as fatias.
 */
export function fatiasParaDesenho(total: number, cheias: number, cx: number, cy: number, raio: number, folga = 1.5): { d: string; cheia: boolean }[] {
  const saida: { d: string; cheia: boolean }[] = [];
  const passo = (Math.PI * 2) / total;
  const ponto = (ang: number, r: number): [number, number] => [cx + Math.sin(ang) * r, cy - Math.cos(ang) * r];
  const folgaAng = total === 1 ? 0 : (folga / raio) * 0.5;
  for (let i = 0; i < total; i++) {
    const a0 = i * passo + folgaAng;
    const a1 = (i + 1) * passo - folgaAng;
    const [x0, y0] = ponto(a0, raio);
    const [x1, y1] = ponto(a1, raio);
    const grande = a1 - a0 > Math.PI ? 1 : 0;
    saida.push({ d: `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${raio} ${raio} 0 ${grande} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`, cheia: i < cheias });
  }
  return saida;
}
