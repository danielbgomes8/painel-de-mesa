/**
 * Achar os vãos de porta entre paredes: onde duas paredes quase se encontram, na mesma linha, com uma abertura do
 * tamanho de uma passagem entre elas. Serve pro Mestre não desenhar à mão cada porta de um mapa importado de uma IA
 * (que acerta as paredes e quase nunca marca as portas). É sugestão: cada vão vira uma porta, que ele confere.
 *
 * Regras (todas por geometria, nada de chute de imagem):
 * - só pontas de PAREDE (porta já existente não conta, nem os vãos que já têm porta);
 * - as duas paredes têm de apontar uma pra outra (até `ANGULO_MAXIMO_GRAUS` de desvio), senão é canto ou parede torta;
 * - o vão mede de meio quadradinho a `QUADRADINHOS_MAXIMOS_DO_VAO` (sem grade: de 1,5% a 4% do lado maior do mapa);
 * - nenhuma outra parede cruza o vão, e cada ponta serve a um vão só (o mais curto ganha).
 */
import type { Cena, Ponto } from "./cenas";
import { gradeUsavel } from "./cenas";
import { passoBloqueado, type NovaParede, type Parede } from "./paredes";

export const ANGULO_MAXIMO_GRAUS = 20;
export const QUADRADINHOS_MAXIMOS_DO_VAO = 2;

type CenaDosVaos = Pick<Cena, "grade_ligada" | "grade_px" | "grade_dx" | "grade_dy" | "largura" | "altura">;
type Ponta = { p: Ponto; dir: Ponto; id: string };

function limitesDoVao(cena: CenaDosVaos): { min: number; max: number } {
  if (gradeUsavel(cena)) return { min: cena.grade_px * 0.5, max: cena.grade_px * QUADRADINHOS_MAXIMOS_DO_VAO };
  const lado = Math.max(cena.largura, cena.altura);
  return { min: lado * 0.015, max: lado * 0.04 };
}

function pontasDe(p: Parede): [Ponta, Ponta] | null {
  const dx = p.x2 - p.x1;
  const dy = p.y2 - p.y1;
  const c = Math.hypot(dx, dy);
  if (c === 0) return null;
  const u: Ponto = [dx / c, dy / c];
  return [
    { p: [p.x1, p.y1], dir: [-u[0], -u[1]], id: p.id },
    { p: [p.x2, p.y2], dir: u, id: p.id },
  ];
}

function apontaPara(dir: Ponto, de: Ponto, para: Ponto): boolean {
  const dx = para[0] - de[0];
  const dy = para[1] - de[1];
  const c = Math.hypot(dx, dy);
  if (c === 0) return false;
  const cos = (dir[0] * dx + dir[1] * dy) / c;
  return cos >= Math.cos((ANGULO_MAXIMO_GRAUS * Math.PI) / 180);
}

/** Os vãos entre paredes que parecem porta, prontos pra virar portas (abertas: nada muda na vista até o Mestre fechar). */
export function vaosDePorta(paredes: readonly Parede[], cena: CenaDosVaos): NovaParede[] {
  const { min, max } = limitesDoVao(cena);
  const muros = paredes.filter((p) => p.tipo === "parede");
  const portas = paredes.filter((p) => p.tipo === "porta");
  const pontas = muros.flatMap((p) => pontasDe(p) ?? []);

  type Candidato = { a: Ponta; b: Ponta; d: number };
  const candidatos: Candidato[] = [];
  for (let i = 0; i < pontas.length; i++) {
    for (let j = i + 1; j < pontas.length; j++) {
      const a = pontas[i];
      const b = pontas[j];
      if (a.id === b.id) continue;
      const d = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]);
      if (d < min || d > max) continue;
      if (!apontaPara(a.dir, a.p, b.p) || !apontaPara(b.dir, b.p, a.p)) continue;
      candidatos.push({ a, b, d });
    }
  }
  candidatos.sort((x, y) => x.d - y.d);

  const usadas = new Set<Ponta>();
  const saida: NovaParede[] = [];
  const jaTemPorta = (a: Ponto, b: Ponto) =>
    portas.some((q) => {
      const perto = (x: number, y: number, p: Ponto) => Math.hypot(x - p[0], y - p[1]) <= min;
      return (perto(q.x1, q.y1, a) && perto(q.x2, q.y2, b)) || (perto(q.x1, q.y1, b) && perto(q.x2, q.y2, a));
    });
  for (const c of candidatos) {
    if (usadas.has(c.a) || usadas.has(c.b)) continue;
    const outros = muros.filter((m) => m.id !== c.a.id && m.id !== c.b.id).map((m) => [m.x1, m.y1, m.x2, m.y2] as const);
    if (passoBloqueado(c.a.p, c.b.p, outros)) continue;
    if (jaTemPorta(c.a.p, c.b.p)) continue;
    usadas.add(c.a);
    usadas.add(c.b);
    saida.push({ tipo: "porta", x1: c.a.p[0], y1: c.a.p[1], x2: c.b.p[0], y2: c.b.p[1], aberta: true });
  }
  return saida;
}
