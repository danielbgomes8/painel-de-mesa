import { describe, expect, it } from "vitest";
import {
  RAIO_DO_NO,
  chaveDoMapa,
  desenharLinhas,
  foiToque,
  posicionarNos,
  separarConectados,
  tamanhoDoMapa,
} from "./grafo";

const ids = (...x: string[]) => x.map((id) => ({ id }));
const liga = (id: string, de: string, para: string) => ({ id, de, para });

describe("posicionarNos", () => {
  const nos = ids("a", "b", "c", "d", "e", "f");
  const arestas = [liga("1", "a", "b"), liga("2", "b", "c"), liga("3", "c", "d"), liga("4", "e", "f")];

  it("é determinístico e não depende da ordem de entrada", () => {
    const um = posicionarNos(nos, arestas);
    const dois = posicionarNos([...nos].reverse(), [...arestas].reverse());
    expect([...um.entries()]).toEqual([...dois.entries()]);
  });
  it("mantém todos dentro do desenho, com a margem do círculo", () => {
    const { largura, altura } = tamanhoDoMapa(nos.length);
    for (const p of posicionarNos(nos, arestas).values()) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(RAIO_DO_NO);
      expect(p.x).toBeLessThanOrEqual(largura - RAIO_DO_NO);
      expect(p.y).toBeGreaterThanOrEqual(RAIO_DO_NO);
      expect(p.y).toBeLessThanOrEqual(altura - RAIO_DO_NO);
    }
  });
  it("nenhum círculo cobre outro", () => {
    const p = [...posicionarNos(nos, arestas).values()];
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++) expect(Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y)).toBeGreaterThanOrEqual(2 * RAIO_DO_NO);
  });
  it("quem está ligado fica mais perto do que quem não está", () => {
    const p = posicionarNos(nos, arestas);
    const d = (a: string, b: string) => Math.hypot(p.get(a)!.x - p.get(b)!.x, p.get(a)!.y - p.get(b)!.y);
    expect(d("e", "f")).toBeLessThan(d("a", "f"));
  });
  it("casos pequenos: nada, um e dois cartões", () => {
    expect(posicionarNos([], []).size).toBe(0);
    expect(posicionarNos(ids("a"), []).size).toBe(1);
    const dois = posicionarNos(ids("a", "b"), [liga("1", "a", "b")]);
    const [p, q] = [...dois.values()];
    expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(2 * RAIO_DO_NO);
  });
  it("ignora ligação com cartão que não existe e com ele mesmo", () => {
    expect(posicionarNos(ids("a", "b"), [liga("1", "a", "zzz"), liga("2", "a", "a")]).size).toBe(2);
  });
  it("aguenta bastante cartão sem demorar", () => {
    const muitos = ids(...Array.from({ length: 80 }, (_, i) => `c${String(i).padStart(2, "0")}`));
    const comoLigam = muitos.slice(1).map((n, i) => liga(`l${i}`, muitos[i].id, n.id));
    const inicio = Date.now();
    expect(posicionarNos(muitos, comoLigam).size).toBe(80);
    expect(Date.now() - inicio).toBeLessThan(1500);
  });
});

describe("desenharLinhas", () => {
  const pos = new Map([
    ["a", { x: 100, y: 100 }],
    ["b", { x: 300, y: 100 }],
  ]);
  it("a linha começa e termina na borda dos círculos, não no centro", () => {
    const [l] = desenharLinhas([liga("1", "a", "b")], pos);
    expect(l.x1).toBeGreaterThan(100 + RAIO_DO_NO - 1);
    expect(l.x2).toBeLessThan(300 - RAIO_DO_NO + 1);
  });
  it("ligações opostas entre o mesmo par não ficam uma sobre a outra", () => {
    const linhas = desenharLinhas([liga("1", "a", "b"), liga("2", "b", "a")], pos);
    expect(linhas).toHaveLength(2);
    expect(Math.abs(linhas[0].ry - linhas[1].ry)).toBeGreaterThan(20);
  });
  it("uma ligação sozinha é reta (rótulo no meio)", () => {
    const [l] = desenharLinhas([liga("1", "a", "b")], pos);
    expect(l.rx).toBeCloseTo(200);
    expect(l.ry).toBeCloseTo(100);
  });
  it("pula ligação de cartão sem posição", () => {
    expect(desenharLinhas([liga("1", "a", "x")], pos)).toEqual([]);
  });
});

describe("separarConectados, chave e toque", () => {
  it("separa quem tem ligação de quem não tem", () => {
    const { conectados, soltos } = separarConectados(ids("a", "b", "c"), [{ de: "a", para: "b" }]);
    expect(conectados.map((n) => n.id)).toEqual(["a", "b"]);
    expect(soltos.map((n) => n.id)).toEqual(["c"]);
  });
  it("a chave muda quando entra cartão ou ligação, e não com a ordem", () => {
    const base = chaveDoMapa(ids("a", "b"), [liga("1", "a", "b")]);
    expect(chaveDoMapa(ids("b", "a"), [liga("9", "a", "b")])).toBe(base);
    expect(chaveDoMapa(ids("a", "b", "c"), [liga("1", "a", "b")])).not.toBe(base);
    expect(chaveDoMapa(ids("a", "b"), [liga("1", "a", "b"), liga("2", "b", "a")])).not.toBe(base);
  });
  it("toque é o dedo que quase não andou", () => {
    expect(foiToque({ x: 10, y: 10 }, { x: 13, y: 12 })).toBe(true);
    expect(foiToque({ x: 10, y: 10 }, { x: 30, y: 10 })).toBe(false);
  });
});
