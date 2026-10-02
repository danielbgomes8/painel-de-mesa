import { describe, expect, it } from "vitest";
import {
  acharMarcaNoPonto,
  linhaReta,
  marcasVisiveis,
  normalizarMarca,
  notasNumeradas,
  simplificarDesenho,
  textoDaNota,
  type Marca,
} from "./marcas";

function traco(id: string, pontos: [number, number][], extra: Partial<Marca> = {}): Marca {
  return { id, cena_id: "c", room_code: "s", tipo: "traco", cor: "#f0c24b", pontos, x: 0, y: 0, texto: "", visivel: true, created_at: id, ...extra };
}
function nota(id: string, x: number, y: number, extra: Partial<Marca> = {}): Marca {
  return { id, cena_id: "c", room_code: "s", tipo: "nota", cor: "#f0c24b", pontos: [], x, y, texto: "oi", visivel: true, created_at: id, ...extra };
}

describe("normalizarMarca", () => {
  it("lê um traço do banco (números podem vir como texto)", () => {
    const m = normalizarMarca({ id: "a", cena_id: "c", tipo: "traco", pontos: [[0, 0], ["10", "5"]], cor: "#112233", visivel: true });
    expect(m?.pontos).toEqual([[0, 0], [10, 5]]);
    expect(m?.cor).toBe("#112233");
  });
  it("lê uma nota e corta o texto em 140", () => {
    const m = normalizarMarca({ id: "a", cena_id: "c", tipo: "nota", x: "3", y: 4, texto: "x".repeat(200) });
    expect(m).toMatchObject({ x: 3, y: 4 });
    expect(m?.texto).toHaveLength(140);
  });
  it("recusa o que não desenha nada: traço de um ponto, nota sem lugar, tipo estranho", () => {
    expect(normalizarMarca({ id: "a", cena_id: "c", tipo: "traco", pontos: [[1, 1]] })).toBeNull();
    expect(normalizarMarca({ id: "a", cena_id: "c", tipo: "nota", texto: "sem lugar" })).toBeNull();
    expect(normalizarMarca({ id: "a", cena_id: "c", tipo: "círculo", pontos: [] })).toBeNull();
    expect(normalizarMarca({ id: "a", cena_id: "c", tipo: "traco", pontos: [[1, "x"], [2, 2]] })).toBeNull();
    expect(normalizarMarca(null)).toBeNull();
  });
  it("cor inválida cai na padrão e visivel só é falso quando é falso de verdade", () => {
    expect(normalizarMarca({ id: "a", cena_id: "c", tipo: "nota", x: 0, y: 0, cor: "vermelho" })?.cor).toBe("#f0c24b");
    expect(normalizarMarca({ id: "a", cena_id: "c", tipo: "nota", x: 0, y: 0, visivel: false })?.visivel).toBe(false);
    expect(normalizarMarca({ id: "a", cena_id: "c", tipo: "nota", x: 0, y: 0 })?.visivel).toBe(true);
  });
});

describe("marcasVisiveis", () => {
  const todas = [traco("1", [[0, 0], [1, 1]]), nota("2", 5, 5, { visivel: false })];
  it("o Mestre vê tudo; a mesa só o que foi liberado", () => {
    expect(marcasVisiveis(todas, true)).toHaveLength(2);
    expect(marcasVisiveis(todas, false).map((m) => m.id)).toEqual(["1"]);
  });
});

describe("simplificarDesenho", () => {
  it("uma reta cheia de pontos vira dois", () => {
    const reta: [number, number][] = Array.from({ length: 50 }, (_, i) => [i * 2, i * 2]);
    expect(simplificarDesenho(reta, 1)).toEqual([[0, 0], [98, 98]]);
  });
  it("guarda a curva: um 'L' mantém o canto", () => {
    const l: [number, number][] = [...Array.from({ length: 20 }, (_, i): [number, number] => [i * 5, 0]), ...Array.from({ length: 20 }, (_, i): [number, number] => [95, i * 5])];
    const s = simplificarDesenho(l, 1)!;
    expect(s).toContainEqual([95, 0]);
    expect(s.length).toBeLessThan(5);
  });
  it("ignora pontos repetidos e não faz traço de um ponto só", () => {
    expect(simplificarDesenho([[3, 3], [3, 3], [3, 3]], 1)).toBeNull();
    expect(simplificarDesenho([], 1)).toBeNull();
  });
  it("nunca passa do limite do banco, mesmo com um rabisco enorme", () => {
    const rabisco: [number, number][] = Array.from({ length: 3000 }, (_, i) => [i, Math.sin(i / 3) * 50 + (i % 7)]);
    const s = simplificarDesenho(rabisco, 1, 400)!;
    expect(s.length).toBeLessThanOrEqual(400);
    expect(s[0]).toEqual(rabisco[0]);
  });
  it("com zoom a tolerância encolhe: guarda mais detalhe", () => {
    const zig: [number, number][] = Array.from({ length: 40 }, (_, i) => [i * 3, i % 2 === 0 ? 0 : 1.5]);
    const longe = simplificarDesenho(zig, 1)!;
    const perto = simplificarDesenho(zig, 8)!;
    expect(perto.length).toBeGreaterThan(longe.length);
  });
});

describe("linhaReta", () => {
  it("dois pontos distintos viram a linha; um toque não", () => {
    expect(linhaReta([0, 0], [10, 0])).toEqual([[0, 0], [10, 0]]);
    expect(linhaReta([4, 4], [4, 4])).toBeNull();
  });
});

describe("acharMarcaNoPonto (borracha)", () => {
  const marcas = [traco("t", [[0, 0], [100, 0]]), nota("n", 50, 40)];
  it("acha o traço perto e a nota perto", () => {
    expect(acharMarcaNoPonto(marcas, [50, 3], 8)?.id).toBe("t");
    expect(acharMarcaNoPonto(marcas, [52, 38], 8)?.id).toBe("n");
  });
  it("não acha nada longe de tudo", () => {
    expect(acharMarcaNoPonto(marcas, [50, 200], 8)).toBeNull();
  });
  it("no empate, a mais nova ganha", () => {
    const duas = [traco("a", [[0, 0], [100, 0]]), traco("b", [[0, 0], [100, 0]])];
    expect(acharMarcaNoPonto(duas, [50, 0], 8)?.id).toBe("b");
  });
});

describe("notasNumeradas", () => {
  it("numera pela ordem de criação, só as notas, sem buraco pra quem não vê as ocultas", () => {
    const todas = [nota("3", 0, 0), traco("2", [[0, 0], [1, 1]]), nota("1", 0, 0, { visivel: false }), nota("4", 0, 0)];
    expect(notasNumeradas(todas).map((n) => [n.numero, n.marca.id])).toEqual([[1, "1"], [2, "3"], [3, "4"]]);
    expect(notasNumeradas(marcasVisiveis(todas, false)).map((n) => [n.numero, n.marca.id])).toEqual([[1, "3"], [2, "4"]]);
  });
});

describe("textoDaNota", () => {
  it("tira espaço das pontas e corta em 140", () => {
    expect(textoDaNota("  oi  ")).toBe("oi");
    expect(textoDaNota("y".repeat(300))).toHaveLength(140);
  });
});
