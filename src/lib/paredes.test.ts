import { describe, expect, it } from "vitest";
import {
  PAREDES_MAXIMAS,
  PAREDE_MINIMA_PX,
  TRECHOS_MAXIMOS_DO_TRACO,
  acharParedeNoPonto,
  andarComParedes,
  cabemParedes,
  normalizarParede,
  paredeEntre,
  paredesDoComodo,
  paredesDoTraco,
  pontaDeParedePerto,
  passoBloqueado,
  pontoParaParede,
  pousoLivre,
  segmentosQueBloqueiam,
  ultimaParede,
  ultimoDesenho,
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

describe("andar: parede e porta fechada seguram o peão", () => {
  // Uma parede de cima a baixo em x = 450, com uma porta entre y = 250 e 350.
  const paredeDeCima = parede({ x1: 450, y1: 0, x2: 450, y2: 250 });
  const porta = parede({ tipo: "porta", x1: 450, y1: 250, x2: 450, y2: 350, aberta: false });
  const paredeDeBaixo = parede({ x1: 450, y1: 350, x2: 450, y2: 600 });
  const fechado = segmentosQueBloqueiam([paredeDeCima, porta, paredeDeBaixo]);
  const aberto = segmentosQueBloqueiam([paredeDeCima, { ...porta, aberta: true }, paredeDeBaixo]);

  it("atravessar a parede não pode; andar do mesmo lado pode", () => {
    expect(passoBloqueado([400, 100], [500, 100], fechado)).toBe(true);
    expect(passoBloqueado([500, 100], [400, 100], fechado)).toBe(true);
    expect(passoBloqueado([400, 100], [420, 500], fechado)).toBe(false);
    expect(passoBloqueado([400, 100], [400, 100], fechado)).toBe(false);
  });

  it("porta fechada segura; aberta deixa passar — e só por ela", () => {
    expect(passoBloqueado([400, 300], [500, 300], fechado)).toBe(true);
    expect(passoBloqueado([400, 300], [500, 300], aberto)).toBe(false);
    expect(passoBloqueado([400, 100], [500, 100], aberto)).toBe(true);
  });

  it("não dá pra passar pelo canto onde duas paredes se encontram, nem por uma fresta de fração de pixel", () => {
    const canto = segmentosQueBloqueiam([parede({ x1: 0, y1: 300, x2: 450, y2: 300 }), parede({ x1: 450, y1: 300, x2: 450, y2: 600 })]);
    // Na diagonal, exatamente pelo canto (450, 300).
    expect(passoBloqueado([400, 350], [500, 250], canto)).toBe(true);
    const comFresta = segmentosQueBloqueiam([parede({ x1: 450, y1: 0, x2: 450, y2: 299.8 }), parede({ x1: 450, y1: 300, x2: 450, y2: 600 })]);
    expect(passoBloqueado([400, 299.9], [500, 299.9], comFresta)).toBe(true);
  });

  it("não atravessa em dois passos: parar em cima da parede também é barrado, e andar por cima dela idem", () => {
    expect(passoBloqueado([400, 100], [450, 100], fechado)).toBe(true);
    expect(passoBloqueado([450, 50], [450, 150], fechado)).toBe(true);
  });

  it("quem já está em cima da linha (peão 2×2 no cruzamento da grade) consegue sair", () => {
    expect(passoBloqueado([450, 100], [400, 100], fechado)).toBe(false);
    expect(passoBloqueado([450, 100], [500, 100], fechado)).toBe(false);
  });

  it("um salto grande do dedo não pula a sala: vale o caminho reto inteiro", () => {
    const comodo = segmentosQueBloqueiam(paredesDoComodo([300, 200], [600, 400])!.map((p) => parede(p)));
    expect(passoBloqueado([100, 300], [800, 300], comodo)).toBe(true); // atravessa o cômodo de lado a lado
    expect(passoBloqueado([100, 300], [450, 300], comodo)).toBe(true); // entra nele
    expect(passoBloqueado([100, 100], [800, 100], comodo)).toBe(false); // passa por fora
  });

  it("batendo na parede, o peão desliza ao longo dela em vez de travar", () => {
    // O dedo foi pra direita e pra baixo, atravessando: o peão desce (y) e fica do lado dele.
    expect(andarComParedes([400, 100], [500, 180], fechado)).toEqual([400, 180]);
    // Só pra direita, de frente pra parede: fica onde está.
    expect(andarComParedes([400, 100], [500, 100], fechado)).toEqual([400, 100]);
    // Caminho livre: vai aonde o dedo foi.
    expect(andarComParedes([400, 100], [300, 250], fechado)).toEqual([300, 250]);
    // Sem parede nenhuma na cena, nada muda.
    expect(andarComParedes([400, 100], [500, 100], [])).toEqual([500, 100]);
  });

  it("ao soltar, pousa no quadradinho mais perto a que dá pra chegar; sem nenhum, volta (null)", () => {
    // Parede fora da grade, em x = 440, cortando o quadradinho de centro 435: o
    // peão em 445 não pode pousar em 435 (do outro lado), então vai pro vizinho 465.
    const torta = segmentosQueBloqueiam([parede({ x1: 440, y1: 0, x2: 440, y2: 600 })]);
    expect(pousoLivre([445, 105], [[435, 105], [465, 105], [405, 105]], torta)).toEqual([465, 105]);
    // Caso comum (parede na linha da grade): o do próprio quadradinho.
    expect(pousoLivre([445, 105], [[435, 105], [465, 105]], fechado)).toEqual([435, 105]);
    // Cercado: nenhum serve.
    const cela = segmentosQueBloqueiam(paredesDoComodo([440, 100], [450, 110])!.map((p) => parede(p)));
    expect(pousoLivre([445, 105], [[435, 105], [465, 105]], cela)).toBeNull();
  });

  it("deslizando rente à parede o peão nunca chega do outro lado, por mais que o dedo insista", () => {
    let pos: [number, number] = [400, 100];
    for (let i = 0; i < 200; i++) {
      const alvo: [number, number] = [pos[0] + 37, pos[1] + (i % 2 ? 11 : -9)];
      const [x, y] = andarComParedes(pos, alvo, fechado);
      pos = [x, y];
      expect(pos[0]).toBeLessThan(450);
    }
  });
});

describe("parede em curva (traço livre)", () => {
  /** Um arco de círculo com muitos pontos, como o dedo deixa. */
  const arco = (cx: number, cy: number, r: number, de: number, ate: number, n = 120): [number, number][] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = de + ((ate - de) * i) / n;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    });
  const distanciaAoTraco = (p: readonly [number, number], novas: { x1: number; y1: number; x2: number; y2: number }[]) =>
    Math.min(
      ...novas.map((w) => {
        const [sx, sy] = [w.x2 - w.x1, w.y2 - w.y1];
        const k = Math.max(0, Math.min(1, ((p[0] - w.x1) * sx + (p[1] - w.y1) * sy) / (sx * sx + sy * sy)));
        return Math.hypot(p[0] - (w.x1 + k * sx), p[1] - (w.y1 + k * sy));
      }),
    );

  it("a curva vira poucos trechos retos que acompanham o traço de perto", () => {
    const pontos = arco(500, 500, 200, 0, Math.PI);
    const novas = paredesDoTraco(pontos, 3);
    expect(novas.length).toBeGreaterThan(4);
    expect(novas.length).toBeLessThanOrEqual(TRECHOS_MAXIMOS_DO_TRACO);
    for (const p of pontos) expect(distanciaAoTraco(p, novas)).toBeLessThanOrEqual(3.01);
    expect(novas.every((w) => w.tipo === "parede")).toBe(true);
  });

  it("os trechos se emendam ponta com ponta, sem fresta, e começam e acabam onde o dedo começou e acabou", () => {
    const pontos = arco(500, 500, 200, 0.3, 2.9);
    const novas = paredesDoTraco(pontos, 3);
    for (let i = 1; i < novas.length; i++) expect([novas[i].x1, novas[i].y1]).toEqual([novas[i - 1].x2, novas[i - 1].y2]);
    expect([novas[0].x1, novas[0].y1]).toEqual(pontos[0]);
    expect([novas[novas.length - 1].x2, novas[novas.length - 1].y2]).toEqual(pontos[pontos.length - 1]);
  });

  it("curva fechada e apertada (raio de um quadradinho) também sai — é o caso que a grade não deixava", () => {
    const novas = paredesDoTraco(arco(300, 300, 30, 0, Math.PI * 1.5), 2);
    expect(novas.length).toBeGreaterThanOrEqual(5);
    for (const w of novas) expect(Math.hypot(w.x2 - w.x1, w.y2 - w.y1)).toBeGreaterThanOrEqual(PAREDE_MINIMA_PX);
  });

  it("traço reto vira uma parede só; toque parado não vira nada", () => {
    const reta: [number, number][] = Array.from({ length: 50 }, (_, i) => [100 + i * 4, 200 + (i % 2) * 0.4]);
    expect(paredesDoTraco(reta, 3)).toHaveLength(1);
    expect(paredesDoTraco([[100, 100], [101, 100], [102, 101]], 3)).toEqual([]);
    expect(paredesDoTraco([[100, 100]], 3)).toEqual([]);
  });

  it("traço enorme e cheio de curvas afrouxa até caber no máximo de trechos", () => {
    // Uma parede de caverna de ponta a ponta do mapa, ondulando: com a folga
    // pedida (1 px) daria mais de cem trechos.
    const caverna: [number, number][] = Array.from({ length: 2000 }, (_, i) => [i * 2, 300 + Math.sin(i / 40) * 80]);
    const novas = paredesDoTraco(caverna, 1);
    expect(novas.length).toBeLessThanOrEqual(TRECHOS_MAXIMOS_DO_TRACO);
    expect(novas.length).toBeGreaterThan(20);
    // E continua parecida com o traço (longe de virar uma reta).
    for (const p of caverna) expect(distanciaAoTraco(p, novas)).toBeLessThan(15);
  });

  it("voltando perto do começo, fecha a volta (pilar, sala redonda) sem deixar fresta", () => {
    const quase = arco(500, 500, 100, 0, Math.PI * 2 - 0.08);
    const aberta = paredesDoTraco(quase, 2);
    expect([aberta[aberta.length - 1].x2, aberta[aberta.length - 1].y2]).not.toEqual(quase[0]);
    const fechada = paredesDoTraco(quase, 2, 14);
    expect([fechada[fechada.length - 1].x2, fechada[fechada.length - 1].y2]).toEqual(quase[0]);
    // Um risquinho curto perto do começo não é uma volta: fica aberto.
    const risco = paredesDoTraco([[100, 100], [112, 100], [108, 104]], 1, 14);
    expect([risco[risco.length - 1].x2, risco[risco.length - 1].y2]).toEqual([108, 104]);
  });

  it("a curva segura o peão como qualquer parede", () => {
    const bloqueios = segmentosQueBloqueiam(paredesDoTraco(arco(500, 500, 200, 0, Math.PI * 2 - 0.05), 2, 14).map((p) => parede(p)));
    expect(passoBloqueado([500, 500], [800, 500], bloqueios)).toBe(true);
    expect(passoBloqueado([500, 500], [500, 100], bloqueios)).toBe(true);
    expect(passoBloqueado([500, 500], [560, 440], bloqueios)).toBe(false);
  });

  it("a ponta gruda na ponta de outra parede que esteja perto (e só nela: nada de grade)", () => {
    const outras = [parede({ x1: 0, y1: 0, x2: 100, y2: 0 })];
    expect(pontaDeParedePerto(outras, [104, 3], 1)).toEqual([100, 0]);
    expect(pontaDeParedePerto(outras, [140, 3], 1)).toBeNull();
    expect(pontaDeParedePerto(outras, [140, 3], 0.25)).toEqual([100, 0]);
  });

  it("desfazer tira o último desenho inteiro (a curva toda, o cômodo todo), não um trecho", () => {
    const antigas = [parede({ id: "a", created_at: "2026-10-01T10:00:00Z" })];
    const curva = ["c1", "c2", "c3"].map((id) => parede({ id, created_at: "2026-10-01T11:00:00Z" }));
    expect(ultimoDesenho([...antigas, ...curva]).map((p) => p.id)).toEqual(["c1", "c2", "c3"]);
    // Ainda não confirmadas pelo banco (hora vazia): são as mais novas.
    const pendentes = [parede({ id: "n1", created_at: "" }), parede({ id: "n2", created_at: "" })];
    expect(ultimoDesenho([...antigas, ...curva, ...pendentes]).map((p) => p.id)).toEqual(["n1", "n2"]);
    expect(ultimoDesenho([])).toEqual([]);
  });
});
