import { describe, expect, it } from "vitest";
import {
  PAREDES_MAXIMAS,
  PAREDE_MINIMA_PX,
  acharParedeNoPonto,
  cabemParedes,
  normalizarParede,
  paredeEntre,
  paredesDoComodo,
  pontoParaParede,
  segmentosQueBloqueiam,
  ultimaParede,
  type Parede,
} from "./paredes";

const cena = { grade_ligada: true, grade_px: 100, grade_dx: 0, grade_dy: 0, metros: 1.5, largura: 3000, altura: 2000 };

function parede(extra: Partial<Parede> = {}): Parede {
  return { id: "p", cena_id: "c", room_code: "s", tipo: "parede", x1: 0, y1: 0, x2: 100, y2: 0, aberta: false, created_at: "", ...extra };
}

describe("o que vem do banco", () => {
  it("lê uma linha de parede (números em texto também)", () => {
    const p = normalizarParede({ id: "a", cena_id: "c", room_code: "s", tipo: "porta", x1: "10.5", y1: 20, x2: 30, y2: 40, aberta: true });
    expect(p).toMatchObject({ id: "a", tipo: "porta", x1: 10.5, y1: 20, x2: 30, y2: 40, aberta: true });
  });

  it("ignora linha torta em vez de derrubar a tela", () => {
    expect(normalizarParede(null)).toBeNull();
    expect(normalizarParede({ id: "a", cena_id: "c", tipo: "muro", x1: 0, y1: 0, x2: 1, y2: 1 })).toBeNull();
    expect(normalizarParede({ id: "a", cena_id: "c", tipo: "parede", x1: "x", y1: 0, x2: 1, y2: 1 })).toBeNull();
    expect(normalizarParede({ cena_id: "c", tipo: "parede", x1: 0, y1: 0, x2: 1, y2: 1 })).toBeNull();
  });
});

describe("o que bloqueia a vista", () => {
  it("toda parede e toda porta fechada; porta aberta deixa passar", () => {
    const lista = [
      parede({ id: "a" }),
      parede({ id: "b", tipo: "porta", aberta: false, x1: 5 }),
      parede({ id: "c", tipo: "porta", aberta: true, x1: 7 }),
      parede({ id: "d", aberta: true, x1: 9 }), // parede com "aberta" não significa nada
    ];
    expect(segmentosQueBloqueiam(lista).map((s) => s[0])).toEqual([0, 5, 9]);
  });
});

describe("onde a ponta da parede cai", () => {
  it("encaixa na ponta de outra parede que esteja perto, pra o canto fechar sem fresta", () => {
    const existente = parede({ x1: 100, y1: 100, x2: 400, y2: 100 });
    expect(pontoParaParede(cena, [existente], [405, 108], 1)).toEqual([400, 100]);
  });

  it("com o mapa afastado (zoom pequeno), a tolerância em px do mapa cresce", () => {
    // A ponta está fora da grade de propósito (420,110): senão o encaixe da grade daria o mesmo resultado.
    const existente = parede({ x1: 100, y1: 100, x2: 420, y2: 110 });
    // zoom 0,25: 14 px de tela = 56 px do mapa; o dedo está a ~28 da ponta.
    expect(pontoParaParede(cena, [existente], [440, 130], 0.25)).toEqual([420, 110]);
    // zoom 1: 14 px do mapa — longe demais, cai no cruzamento da grade.
    expect(pontoParaParede(cena, [existente], [440, 130], 1)).toEqual([400, 100]);
  });

  it("sem ponta perto, vai pro cruzamento da grade; sem grade, fica onde está", () => {
    expect(pontoParaParede(cena, [], [149, 251], 1)).toEqual([100, 300]);
    expect(pontoParaParede({ ...cena, grade_ligada: false }, [], [149, 251], 1)).toEqual([149, 251]);
  });

  it("nunca sai do mapa", () => {
    expect(pontoParaParede({ ...cena, grade_ligada: false }, [], [-20, 2500], 1)).toEqual([0, 2000]);
  });
});

describe("desenhar", () => {
  it("um toque (curto demais) não vira parede", () => {
    expect(paredeEntre("parede", [10, 10], [10 + PAREDE_MINIMA_PX - 1, 10])).toBeNull();
    expect(paredeEntre("parede", [10, 10], [200, 10])).toEqual({ tipo: "parede", x1: 10, y1: 10, x2: 200, y2: 10 });
  });

  it("porta nasce fechada", () => {
    expect(paredeEntre("porta", [0, 0], [100, 0])).toMatchObject({ tipo: "porta", aberta: false });
  });

  it("um cômodo são quatro paredes que fecham o retângulo, em qualquer ordem dos cantos", () => {
    const a = paredesDoComodo([300, 200], [100, 50]);
    expect(a).toHaveLength(4);
    expect(a!.every((w) => w.tipo === "parede")).toBe(true);
    // Cada ponta aparece duas vezes: sem fresta nos cantos.
    const pontas = a!.flatMap((w) => [`${w.x1},${w.y1}`, `${w.x2},${w.y2}`]);
    expect(new Set(pontas)).toEqual(new Set(["100,50", "300,50", "300,200", "100,200"]));
    for (const p of new Set(pontas)) expect(pontas.filter((q) => q === p)).toHaveLength(2);
    expect(paredesDoComodo([300, 200], [100, 200])).toBeNull(); // sem altura
  });
});

describe("tocar numa parede", () => {
  const lista = [parede({ id: "a", x1: 0, y1: 0, x2: 100, y2: 0 }), parede({ id: "b", tipo: "porta", x1: 0, y1: 50, x2: 100, y2: 50 })];

  it("acha a mais perto dentro da tolerância e ignora o resto", () => {
    expect(acharParedeNoPonto(lista, [50, 6], 10)?.id).toBe("a");
    expect(acharParedeNoPonto(lista, [50, 44], 10)?.id).toBe("b");
    expect(acharParedeNoPonto(lista, [50, 25], 10)).toBeNull();
  });

  it("pode procurar só portas (a parede sob o dedo não conta)", () => {
    expect(acharParedeNoPonto(lista, [50, 2], 10, "porta")).toBeNull();
    expect(acharParedeNoPonto(lista, [50, 48], 10, "porta")?.id).toBe("b");
  });
});

describe("limites", () => {
  it("não deixa a cena passar do máximo de paredes", () => {
    expect(cabemParedes(PAREDES_MAXIMAS - 4, 4)).toBe(true);
    expect(cabemParedes(PAREDES_MAXIMAS - 3, 4)).toBe(false);
  });

  it("a última parede é a mais recente", () => {
    const l = [parede({ id: "x", created_at: "2026-10-01T10:00:00Z" }), parede({ id: "y", created_at: "2026-10-01T12:00:00Z" }), parede({ id: "z", created_at: "2026-10-01T11:00:00Z" })];
    expect(ultimaParede(l)?.id).toBe("y");
    expect(ultimaParede([])).toBeNull();
  });
});
