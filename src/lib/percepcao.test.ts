import { describe, expect, it } from "vitest";
import { ALCANCE_DE_ACHAR_M, avaliarPercepcao, cdDeAcharValida, linhaDeAchado, type EstadoDePercepcao, type PecaQueRepara } from "./percepcao";
import type { Armadilha } from "./armadilhas";
import { normalizarParede, type Parede } from "./paredes";

// Grade de 70 px, 1,5 m por quadradinho: 4,5 m = 210 px. O quadradinho (col 5, lin 5) tem centro em (385, 385).
const cena = { grade_ligada: true, grade_px: 70, largura: 2000, altura: 2000, metros: 1.5 };
const armadilha: Armadilha = {
  id: "a1",
  cena_id: "c1",
  room_code: "s",
  nome: "Poço escondido",
  x: 385,
  y: 385,
  raio: 0.75,
  salvaguarda: "DES",
  cd: 12,
  dano: "2d6",
  nota: "",
  estado: "armada",
  tipo: "armadilha",
  cd_achar: 13,
  created_at: "",
};
const porta: Parede = {
  id: "w1",
  cena_id: "c1",
  room_code: "s",
  tipo: "porta",
  x1: 700,
  y1: 300,
  x2: 700,
  y2: 440,
  aberta: false,
  trancada: false,
  secreta: true,
  cd: null,
  cd_achar: 15,
  created_at: "",
};
const jogador = (id: string, x: number, y: number, pp: number | null, nome = "Ana"): PecaQueRepara => ({ id, x, y, espacoPx: 35, nome, pp });
const longe = { x: 1500, y: 1500 };

function aprender(armadilhas: Armadilha[], paredes: Parede[], pecas: PecaQueRepara[]): EstadoDePercepcao {
  return avaliarPercepcao(null, { cena, armadilhas, paredes, pecas }).estado;
}

describe("a CD de achar", () => {
  it("aceita de 1 a 40 inteiro; o resto é 'ninguém repara'", () => {
    expect(cdDeAcharValida("13")).toBe(13);
    expect(cdDeAcharValida(13.4)).toBe(13);
    expect(cdDeAcharValida(0)).toBeNull();
    expect(cdDeAcharValida(41)).toBeNull();
    expect(cdDeAcharValida("")).toBeNull();
    expect(cdDeAcharValida("abc")).toBeNull();
    expect(cdDeAcharValida(null)).toBeNull();
  });

  it("o alcance de reparar é 4,5 m (três quadradinhos)", () => {
    expect(ALCANCE_DE_ACHAR_M).toBe(4.5);
  });
});

describe("armadilha escondida", () => {
  it("quem tem Percepção passiva >= CD e chega perto é percebido uma vez", () => {
    const e0 = aprender([armadilha], [], [jogador("p", longe.x, longe.y, 15)]);
    const r1 = avaliarPercepcao(e0, { cena, armadilhas: [armadilha], paredes: [], pecas: [jogador("p", 385 + 140, 385, 15)] });
    expect(r1.achados).toEqual([{ pecaId: "p", peca: "Ana", alvo: "armadilha", alvoId: "a1", pp: 15, cd: 13 }]);
    // Continua perto: sem aviso repetido.
    const r2 = avaliarPercepcao(r1.estado, { cena, armadilhas: [armadilha], paredes: [], pecas: [jogador("p", 385 + 100, 385, 15)] });
    expect(r2.achados).toEqual([]);
  });

  it("a CD é inclusiva: PP igual à CD percebe; um a menos, não", () => {
    for (const [pp, vai] of [[13, true], [12, false]] as const) {
      const e0 = aprender([armadilha], [], [jogador("p", longe.x, longe.y, pp)]);
      const r = avaliarPercepcao(e0, { cena, armadilhas: [armadilha], paredes: [], pecas: [jogador("p", 385, 385 + 70, pp)] });
      expect(r.achados.length).toBe(vai ? 1 : 0);
    }
  });

  it("longe demais não percebe (a conta é da borda da zona: 4,5 m além dela)", () => {
    const e0 = aprender([armadilha], [], [jogador("p", longe.x, longe.y, 20)]);
    // zona de 0,75 m = 35 px; alcance 210 px: até 245 px do centro.
    expect(avaliarPercepcao(e0, { cena, armadilhas: [armadilha], paredes: [], pecas: [jogador("p", 385 + 240, 385, 20)] }).achados).toHaveLength(1);
    expect(avaliarPercepcao(e0, { cena, armadilhas: [armadilha], paredes: [], pecas: [jogador("p", 385 + 260, 385, 20)] }).achados).toHaveLength(0);
  });

  it("sem CD de achar, ou já revelada, disparada, desarmada ou sendo perigo: ninguém repara", () => {
    const casos: Armadilha[] = [
      { ...armadilha, cd_achar: null },
      { ...armadilha, estado: "revelada" },
      { ...armadilha, estado: "disparada" },
      { ...armadilha, estado: "desarmada" },
      { ...armadilha, tipo: "perigo" },
    ];
    for (const a of casos) {
      const e0 = aprender([a], [], [jogador("p", longe.x, longe.y, 30)]);
      expect(avaliarPercepcao(e0, { cena, armadilhas: [a], paredes: [], pecas: [jogador("p", 385, 385, 30)] }).achados).toEqual([]);
    }
  });

  it("a primeira conferência só aprende; alvo novo e peão novo não avisam de quem já estava perto", () => {
    expect(avaliarPercepcao(null, { cena, armadilhas: [armadilha], paredes: [], pecas: [jogador("p", 385, 385, 30)] }).achados).toEqual([]);
    const semAlvo = aprender([], [], [jogador("p", 385, 385, 30)]);
    expect(avaliarPercepcao(semAlvo, { cena, armadilhas: [armadilha], paredes: [], pecas: [jogador("p", 385, 385, 30)] }).achados).toEqual([]);
    const semPeao = aprender([armadilha], [], [jogador("q", longe.x, longe.y, 30, "Beto")]);
    expect(avaliarPercepcao(semPeao, { cena, armadilhas: [armadilha], paredes: [], pecas: [jogador("q", longe.x, longe.y, 30, "Beto"), jogador("p", 385, 385, 30)] }).achados).toEqual([]);
  });

  it("sair e voltar avisa de novo; criatura que não é jogador (sem PP) nunca percebe", () => {
    const e0 = aprender([armadilha], [], [jogador("p", longe.x, longe.y, 20), jogador("m", longe.x, longe.y, null, "Goblin")]);
    const dentro = avaliarPercepcao(e0, { cena, armadilhas: [armadilha], paredes: [], pecas: [jogador("p", 385, 385, 20), jogador("m", 385, 385, null, "Goblin")] });
    expect(dentro.achados.map((a) => a.peca)).toEqual(["Ana"]);
    const fora = avaliarPercepcao(dentro.estado, { cena, armadilhas: [armadilha], paredes: [], pecas: [jogador("p", longe.x, longe.y, 20), jogador("m", longe.x, longe.y, null, "Goblin")] });
    const volta = avaliarPercepcao(fora.estado, { cena, armadilhas: [armadilha], paredes: [], pecas: [jogador("p", 385, 385, 20), jogador("m", 385, 385, null, "Goblin")] });
    expect(volta.achados).toHaveLength(1);
  });
});

describe("porta secreta", () => {
  it("quem chega perto do traço da porta com PP >= CD percebe a porta", () => {
    const e0 = aprender([], [porta], [jogador("p", 100, 100, 16)]);
    const r = avaliarPercepcao(e0, { cena, armadilhas: [], paredes: [porta], pecas: [jogador("p", 700 - 150, 370, 16)] });
    expect(r.achados).toEqual([{ pecaId: "p", peca: "Ana", alvo: "porta", alvoId: "w1", pp: 16, cd: 15 }]);
  });

  it("PP abaixo da CD, ou longe do traço, não percebe", () => {
    const e0 = aprender([], [porta], [jogador("p", 100, 100, 14)]);
    expect(avaliarPercepcao(e0, { cena, armadilhas: [], paredes: [porta], pecas: [jogador("p", 650, 370, 14)] }).achados).toEqual([]);
    const e1 = aprender([], [porta], [jogador("p", 100, 100, 18)]);
    expect(avaliarPercepcao(e1, { cena, armadilhas: [], paredes: [porta], pecas: [jogador("p", 100, 100, 18)] }).achados).toEqual([]);
  });

  it("só vale pra PORTA secreta com CD: parede, porta comum e porta já achada ficam quietas", () => {
    const outras: Parede[] = [
      { ...porta, tipo: "parede" },
      { ...porta, secreta: false },
      { ...porta, cd_achar: null },
    ];
    for (const w of outras) {
      const e0 = aprender([], [w], [jogador("p", 100, 100, 30)]);
      expect(avaliarPercepcao(e0, { cena, armadilhas: [], paredes: [w], pecas: [jogador("p", 690, 370, 30)] }).achados).toEqual([]);
    }
  });
});

describe("a porta vinda do banco", () => {
  it("lê os campos novos; parede comum nunca é trancada nem secreta", () => {
    const linha = { id: "w", cena_id: "c", tipo: "porta", x1: 0, y1: 0, x2: 10, y2: 0, aberta: false, trancada: true, secreta: true, cd: "14", cd_achar: 16 };
    expect(normalizarParede(linha)).toMatchObject({ trancada: true, secreta: true, cd: 14, cd_achar: 16 });
    expect(normalizarParede({ ...linha, tipo: "parede" })).toMatchObject({ trancada: false, secreta: false, cd: null, cd_achar: null });
  });

  it("linha de antes da migration (sem as colunas) vira porta comum", () => {
    expect(normalizarParede({ id: "w", cena_id: "c", tipo: "porta", x1: 0, y1: 0, x2: 10, y2: 0, aberta: true })).toMatchObject({ trancada: false, secreta: false, cd: null, cd_achar: null });
  });

  it("CD fora de 1 a 40 vira 'não definida'", () => {
    expect(normalizarParede({ id: "w", cena_id: "c", tipo: "porta", x1: 0, y1: 0, x2: 1, y2: 0, cd: 99, cd_achar: 0 })).toMatchObject({ cd: null, cd_achar: null });
  });
});

describe("o log", () => {
  it("conta à mesa sem entregar a CD", () => {
    expect(linhaDeAchado("Ana", "porta", "")).toBe("🕵️ Ana percebe uma porta secreta.");
    expect(linhaDeAchado("Ana", "armadilha", "Poço escondido")).toBe('👁️ Ana percebe "Poço escondido".');
    expect(linhaDeAchado("Ana", "armadilha", "")).toBe("👁️ Ana percebe uma armadilha.");
  });
});
