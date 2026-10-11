import { describe, expect, it } from "vitest";
import type { Cena, Ponto } from "./cenas";
import {
  LADO_MINIMO_MEMORIA,
  alcanceEmPx,
  codificarMascara,
  contarCelulas,
  criarMascara,
  decodificarMascara,
  distanciaAoSegmento,
  juntarMascaras,
  ladoDaMemoria,
  marcarVistos,
  marcarVistosPorLuz,
  poligonoDeVisao,
  pontoNoPoligono,
  type Segmento,
} from "./visao";

const veEm = (poli: readonly Ponto[], x: number, y: number) => pontoNoPoligono(x, y, poli);

describe("o polígono de visão", () => {
  it("sem nenhuma parede, o peão vê um círculo do tamanho do alcance", () => {
    const poli = poligonoDeVisao([500, 500], [], 200);
    for (const [x, y] of poli) expect(Math.hypot(x - 500, y - 500)).toBeCloseTo(200, 6);
    expect(veEm(poli, 500, 500)).toBe(true);
    expect(veEm(poli, 650, 500)).toBe(true);
    expect(veEm(poli, 720, 500)).toBe(false);
  });

  it("uma parede na frente tapa o que está atrás dela, mas não o que está ao lado", () => {
    // Parede vertical em x = 100, de y = -100 a 100; o peão está na origem.
    const parede: Segmento = [100, -100, 100, 100];
    const poli = poligonoDeVisao([0, 0], [parede], 500);
    expect(veEm(poli, 60, 0)).toBe(true); // antes da parede
    expect(veEm(poli, 200, 0)).toBe(false); // atrás
    expect(veEm(poli, 200, 60)).toBe(false); // atrás, ainda dentro da sombra
    expect(veEm(poli, 200, 400)).toBe(true); // passou da ponta de cima da parede: a vista contorna
    expect(veEm(poli, 150, 160)).toBe(true); // logo depois do canto
    expect(veEm(poli, 150, 100)).toBe(false); // ainda na sombra do canto
  });

  it("o canto da parede é exato: a sombra começa na linha que passa pela ponta", () => {
    const parede: Segmento = [100, -100, 100, 100];
    const poli = poligonoDeVisao([0, 0], [parede], 500);
    // A reta de (0,0) pela ponta (100,100) é a diagonal: abaixo dela (y < x) tá na sombra.
    expect(veEm(poli, 300, 290)).toBe(false);
    expect(veEm(poli, 300, 310)).toBe(true);
  });

  it("o alcance corta a vista mesmo sem parede", () => {
    const poli = poligonoDeVisao([0, 0], [[1000, -1000, 1000, 1000]], 300);
    expect(veEm(poli, 250, 0)).toBe(true);
    expect(veEm(poli, 350, 0)).toBe(false);
  });

  it("fechado num cômodo, o peão só vê o cômodo", () => {
    const sala: Segmento[] = [
      [0, 0, 400, 0],
      [400, 0, 400, 400],
      [400, 400, 0, 400],
      [0, 400, 0, 0],
    ];
    const poli = poligonoDeVisao([200, 200], sala, 5000);
    expect(veEm(poli, 50, 50)).toBe(true);
    expect(veEm(poli, 390, 390)).toBe(true);
    expect(veEm(poli, 450, 200)).toBe(false);
    expect(veEm(poli, 200, -50)).toBe(false);
  });

  it("peão e parede muito afastados não entram na conta (alcance curto)", () => {
    const longe: Segmento = [5000, 0, 5000, 100];
    expect(poligonoDeVisao([0, 0], [longe], 200)).toEqual(poligonoDeVisao([0, 0], [], 200));
  });

  it("parede paralela ao raio não quebra a conta", () => {
    const poli = poligonoDeVisao([0, 0], [[50, 0, 300, 0]], 400);
    expect(poli.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });
});

describe("distância até a parede", () => {
  it("é a mais curta, até o ponto mais perto do segmento", () => {
    expect(distanciaAoSegmento(5, 3, [0, 0, 10, 0])).toBe(3);
    expect(distanciaAoSegmento(-4, 3, [0, 0, 10, 0])).toBe(5); // além da ponta: até a ponta
    expect(distanciaAoSegmento(2, 2, [1, 1, 1, 1])).toBeCloseTo(Math.SQRT2, 6); // segmento de um ponto só
  });
});

describe("alcance em pixels", () => {
  const cena = { grade_px: 100, metros: 1.5, largura: 3000, altura: 2000, visao_alcance: 9 };
  it("converte os metros pela grade da cena", () => {
    expect(alcanceEmPx(cena)).toBeCloseTo(600, 6);
  });
  it("sem alcance, vai até onde as paredes deixarem (a diagonal do mapa)", () => {
    expect(alcanceEmPx({ ...cena, visao_alcance: null })).toBeCloseTo(Math.hypot(3000, 2000), 6);
  });
  it("nunca passa da diagonal", () => {
    expect(alcanceEmPx({ ...cena, visao_alcance: 100000 })).toBeCloseTo(Math.hypot(3000, 2000), 6);
  });
});

describe("a memória do que já foi visto", () => {
  const cena: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura"> = { grade_ligada: true, grade_px: 100, largura: 1000, altura: 600 };

  it("tem uma célula por quadradinho, com piso pra grade pequena", () => {
    const m = criarMascara(cena);
    expect([m.cols, m.rows, m.lado]).toEqual([10, 6, 100]);
    expect(ladoDaMemoria({ ...cena, grade_px: 10 })).toBe(LADO_MINIMO_MEMORIA);
    // sem grade, um pedaço de ~1/30 do mapa
    expect(ladoDaMemoria({ ...cena, grade_ligada: false })).toBeCloseTo(1000 / 30, 6);
  });

  it("marca as células cujo centro está no que foi visto, e só elas", () => {
    const m = criarMascara(cena);
    const novas = marcarVistos(m, [poligonoDeVisao([100, 100], [], 140)]);
    expect(novas).toBeGreaterThan(0);
    expect(m.celulas[0]).toBe(1); // centro (50,50)
    expect(m.celulas[1]).toBe(1); // centro (150,50)
    expect(m.celulas[m.cols * 5 + 9]).toBe(0); // canto oposto
    // Marcar de novo o mesmo não conta como novo.
    expect(marcarVistos(m, [poligonoDeVisao([100, 100], [], 140)])).toBe(0);
  });

  it("guarda em texto e lê de volta igualzinho", () => {
    const m = criarMascara(cena);
    marcarVistos(m, [poligonoDeVisao([500, 300], [], 250)]);
    const texto = codificarMascara(m);
    expect(texto).toMatch(/^10x6x100:/);
    const volta = decodificarMascara(texto, cena);
    expect(volta).not.toBeNull();
    expect(Array.from(volta!.celulas)).toEqual(Array.from(m.celulas));
    expect(contarCelulas(volta!)).toBe(contarCelulas(m));
  });

  it("nada visto é texto vazio, e texto vazio é 'sem memória'", () => {
    expect(codificarMascara(criarMascara(cena))).toBe("");
    expect(decodificarMascara("", cena)).toBeNull();
  });

  it("memória de outra escala (a grade mudou) ou torta não vale", () => {
    const m = criarMascara(cena);
    marcarVistos(m, [poligonoDeVisao([500, 300], [], 250)]);
    const texto = codificarMascara(m);
    expect(decodificarMascara(texto, { ...cena, grade_px: 50 })).toBeNull();
    expect(decodificarMascara(texto, { ...cena, largura: 2000 })).toBeNull();
    expect(decodificarMascara("lixo", cena)).toBeNull();
    expect(decodificarMascara("10x6x100:!!!", cena)).toBeNull();
    expect(decodificarMascara("10x6x100:AAAA", cena)).toBeNull();
  });

  it("junta o que dois aparelhos viram, sem perder nada", () => {
    const a = criarMascara(cena);
    const b = criarMascara(cena);
    marcarVistos(a, [poligonoDeVisao([100, 100], [], 120)]);
    marcarVistos(b, [poligonoDeVisao([900, 500], [], 120)]);
    const antes = contarCelulas(a);
    const novas = juntarMascaras(a, b);
    expect(novas).toBe(contarCelulas(b));
    expect(contarCelulas(a)).toBe(antes + novas);
    expect(juntarMascaras(a, b)).toBe(0);
    // Tamanhos diferentes não se misturam.
    expect(juntarMascaras(a, criarMascara({ ...cena, grade_px: 50 }))).toBe(0);
  });
});

describe("o mapa escuro: o que está à vista E iluminado", () => {
  const cenaEscura = { grade_ligada: true, grade_px: 50, largura: 1000, altura: 1000 };

  it("a luz de um ilumina o que OUTRO jogador vê (vê-se o que está à vista e iluminado)", () => {
    const m = criarMascara(cenaEscura);
    // Quem olha está em (100, 500) sem luz; a tocha está em (300, 500) e ilumina 150 px em volta.
    const los = poligonoDeVisao([100, 500], [], 2000);
    const luz = poligonoDeVisao([300, 500], [], 150);
    const novas = marcarVistosPorLuz(m, los, [luz]);
    expect(novas).toBeGreaterThan(20);
    // Uma célula no meio da luz está vista; uma longe da luz (mesmo à vista) não.
    const seen = (x: number, y: number) => m.celulas[Math.floor(y / m.lado) * m.cols + Math.floor(x / m.lado)] === 1;
    expect(seen(300, 500)).toBe(true);
    expect(seen(700, 500)).toBe(false);
  });

  it("a luz não atravessa o que a vista não alcança: atrás de uma parede, escuro mesmo iluminado", () => {
    const m = criarMascara(cenaEscura);
    const parede: Segmento = [200, 300, 200, 700];
    const los = poligonoDeVisao([100, 500], [parede], 2000);
    const luz = poligonoDeVisao([300, 500], [parede], 150); // a tocha está do outro lado da parede (e a parede segura a luz também)
    marcarVistosPorLuz(m, los, [luz]);
    expect(contarCelulas(m)).toBe(0);
  });

  it("sem luz ou sem linha de visão, nada é marcado", () => {
    const m = criarMascara(cenaEscura);
    expect(marcarVistosPorLuz(m, poligonoDeVisao([100, 500], [], 2000), [])).toBe(0);
    expect(marcarVistosPorLuz(m, [], [poligonoDeVisao([300, 500], [], 150)])).toBe(0);
  });

  it("duas luzes somam, e rodar de novo não conta duas vezes", () => {
    const m = criarMascara(cenaEscura);
    const los = poligonoDeVisao([100, 500], [], 2000);
    const a = poligonoDeVisao([300, 500], [], 100);
    const b = poligonoDeVisao([600, 500], [], 100);
    const um = marcarVistosPorLuz(m, los, [a]);
    const dois = marcarVistosPorLuz(m, los, [a, b]);
    expect(dois).toBeGreaterThan(0);
    expect(marcarVistosPorLuz(m, los, [a, b])).toBe(0);
    expect(contarCelulas(m)).toBe(um + dois);
  });
});
