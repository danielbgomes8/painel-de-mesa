/**
 * Percepção passiva — quem repara numa armadilha escondida ou numa porta secreta só de passar por perto.
 *
 * O Mestre dá a cada armadilha escondida e a cada porta secreta uma **CD pra achar** (opcional). Quando um jogador cuja
 * Percepção passiva (a da ficha) é **igual ou maior** que a CD chega a até 4,5 m (três quadradinhos) do alvo, o Mestre
 * recebe o aviso "Ana percebe algo" e decide o que contar. Só o Mestre é avisado: o app nunca revela sozinho.
 *
 * Tudo puro. O vigia (`hooks/usePisadas`) chama `avaliarPercepcao` a cada mudança de peão, de armadilha ou de porta.
 */
import { ladoDeReferencia, type Cena } from "./cenas";
import { raioDaZonaPx, type Armadilha } from "./armadilhas";
import type { Parede } from "./paredes";
import { distanciaAoSegmento } from "./visao";

/** Até onde o jogador repara, em metros, contado da borda da zona da armadilha ou do traço da porta. */
export const ALCANCE_DE_ACHAR_M = 4.5;
export const CD_DE_ACHAR_MAXIMA = 40;

/** A CD que o app aceita: inteiro de 1 a 40; qualquer outra coisa = sem percepção passiva (nulo). */
export function cdDeAcharValida(v: unknown): number | null {
  const n = typeof v === "string" ? (v.trim() === "" ? NaN : Number(v)) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i >= 1 && i <= CD_DE_ACHAR_MAXIMA ? i : null;
}

export type PecaQueRepara = { id: string; x: number; y: number; espacoPx: number; nome: string; /** Percepção passiva da ficha; null = não é jogador. */ pp?: number | null };

export type AlvoAchado = "armadilha" | "porta";
export type Achado = { pecaId: string; peca: string; alvo: AlvoAchado; alvoId: string; pp: number; cd: number };

/** Lembrado entre uma conferência e outra: quem já estava reparando em quê, e que alvos já conhecia. */
export type EstadoDePercepcao = { reparando: Map<string, Set<string>>; conhecidos: Set<string> };

type Alvo = { chave: string; alvo: AlvoAchado; id: string; cd: number; distancia: (x: number, y: number) => number };

function alvosDaCena(cena: Pick<Cena, "grade_px" | "metros">, armadilhas: readonly Armadilha[], paredes: readonly Parede[]): Alvo[] {
  const lista: Alvo[] = [];
  for (const a of armadilhas) {
    // Só a armadilha ainda ESCONDIDA e comum: perigo é à vista e revelada já foi achada.
    if (a.tipo !== "armadilha" || a.estado !== "armada" || a.cd_achar === null) continue;
    const zona = raioDaZonaPx(cena, a.raio);
    lista.push({ chave: `armadilha:${a.id}`, alvo: "armadilha", id: a.id, cd: a.cd_achar, distancia: (x, y) => Math.max(0, Math.hypot(x - a.x, y - a.y) - zona) });
  }
  for (const w of paredes) {
    if (w.tipo !== "porta" || !w.secreta || w.cd_achar === null) continue;
    lista.push({ chave: `porta:${w.id}`, alvo: "porta", id: w.id, cd: w.cd_achar, distancia: (x, y) => distanciaAoSegmento(x, y, [w.x1, w.y1, w.x2, w.y2]) });
  }
  return lista;
}

/**
 * Compara quem está reparando em quê AGORA com a conferência anterior e devolve quem acabou de COMEÇAR a reparar.
 * **Só começar conta**, como pisar numa armadilha: a primeira conferência só aprende o terreno, alvo novo (que o
 * Mestre acabou de pôr) e peão novo (acabou de entrar no mapa) não avisam, e quem continua perto não avisa de novo.
 * Sai e volta: avisa outra vez.
 */
export function avaliarPercepcao(
  anterior: EstadoDePercepcao | null,
  entrada: {
    cena: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura" | "metros">;
    armadilhas: readonly Armadilha[];
    paredes: readonly Parede[];
    pecas: readonly PecaQueRepara[];
  },
): { estado: EstadoDePercepcao; achados: Achado[] } {
  const { cena, armadilhas, paredes, pecas } = entrada;
  const alvos = alvosDaCena(cena, armadilhas, paredes);
  const alcance = (ALCANCE_DE_ACHAR_M * cena.grade_px) / cena.metros;
  const lado = ladoDeReferencia(cena);
  const reparando = new Map<string, Set<string>>();
  const achados: Achado[] = [];
  for (const p of pecas) {
    const agora = new Set<string>();
    if (typeof p.pp === "number") {
      // Criatura grande repara com a borda do espaço dela, não só com o centro.
      const extra = Math.max(0, p.espacoPx - lado / 2);
      for (const a of alvos) {
        if (p.pp < a.cd || a.distancia(p.x, p.y) > alcance + extra + 0.5) continue;
        agora.add(a.chave);
        const antes = anterior?.reparando.get(p.id);
        if (anterior && antes && anterior.conhecidos.has(a.chave) && !antes.has(a.chave)) {
          achados.push({ pecaId: p.id, peca: p.nome, alvo: a.alvo, alvoId: a.id, pp: p.pp, cd: a.cd });
        }
      }
    }
    reparando.set(p.id, agora);
  }
  return { estado: { reparando, conhecidos: new Set(alvos.map((a) => a.chave)) }, achados };
}

/** Linha do log quando o Mestre conta à mesa o que foi achado (sem revelar a CD). */
export function linhaDeAchado(quem: string, alvo: AlvoAchado, nome: string): string {
  return alvo === "porta" ? `🕵️ ${quem} percebe uma porta secreta.` : `👁️ ${quem} percebe ${nome ? `"${nome}"` : "uma armadilha"}.`;
}
