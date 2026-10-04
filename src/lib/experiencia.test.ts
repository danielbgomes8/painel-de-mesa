import { describe, expect, it } from "vitest";
import {
  XP_MAXIMO,
  XP_MINIMO_DO_NIVEL,
  dividirXp,
  ehLinhaDeXp,
  formatarXp,
  linhaDeXp,
  nivelPorXp,
  normalizarXp,
  progressoDeXp,
} from "./experiencia";

describe("tabela de XP por nível", () => {
  it("tem 20 níveis, crescente, e bate com os pontos conferidos no SRD 5.2", () => {
    expect(XP_MINIMO_DO_NIVEL).toHaveLength(20);
    for (let i = 1; i < 20; i++) expect(XP_MINIMO_DO_NIVEL[i]).toBeGreaterThan(XP_MINIMO_DO_NIVEL[i - 1]);
    expect(XP_MINIMO_DO_NIVEL[0]).toBe(0);
    expect(XP_MINIMO_DO_NIVEL[9]).toBe(64000); // nível 10: "se o Mestre começa você no 10, você tem 64.000 XP"
    expect(XP_MINIMO_DO_NIVEL[19]).toBe(355000);
  });

  it("nível por XP, nas bordas", () => {
    expect(nivelPorXp(0)).toBe(1);
    expect(nivelPorXp(299)).toBe(1);
    expect(nivelPorXp(300)).toBe(2);
    expect(nivelPorXp(63999)).toBe(9);
    expect(nivelPorXp(64000)).toBe(10);
    expect(nivelPorXp(10_000_000)).toBe(20);
  });
});

describe("progresso até o próximo nível", () => {
  it("quanto falta e o quanto andou", () => {
    // nível 3 (900) -> 4 (2700): 1800 de distância; com 1800 de XP andou metade
    expect(progressoDeXp(1800, 3)).toEqual({ xp: 1800, maximo: false, ate: 2700, faltam: 900, fracao: 0.5, podeSubir: false });
  });

  it("já tem XP pro próximo: pode subir, falta zero, a barra enche", () => {
    expect(progressoDeXp(3000, 3)).toMatchObject({ faltam: 0, fracao: 1, podeSubir: true });
  });

  it("campanha por marco (XP 0 num personagem de nível alto) não quebra: barra vazia, falta tudo", () => {
    expect(progressoDeXp(0, 5)).toMatchObject({ ate: 14000, faltam: 14000, fracao: 0, podeSubir: false });
  });

  it("nível 20 não tem próximo; sem nível não mostra nada", () => {
    expect(progressoDeXp(400000, 20)).toMatchObject({ maximo: true, ate: null, podeSubir: false });
    expect(progressoDeXp(100, 0)).toBeNull();
    expect(progressoDeXp(100, Number.NaN)).toBeNull();
  });
});

describe("dividir o prêmio", () => {
  it("divide por igual e diz a sobra", () => {
    expect(dividirXp(1000, 4)).toEqual({ cada: 250, sobra: 0 });
    expect(dividirXp(1000, 3)).toEqual({ cada: 333, sobra: 1 });
    expect(dividirXp(5, 8)).toEqual({ cada: 0, sobra: 5 });
    expect(dividirXp(100, 0)).toEqual({ cada: 0, sobra: 100 });
  });
});

describe("normalizar, formatar e log", () => {
  it("normaliza o que vem do banco", () => {
    expect(normalizarXp(undefined)).toBe(0);
    expect(normalizarXp(-5)).toBe(0);
    expect(normalizarXp(1250.4)).toBe(1250);
    expect(normalizarXp(1e12)).toBe(XP_MAXIMO);
    expect(normalizarXp("300")).toBe(0);
  });

  it("milhar com ponto", () => {
    expect(formatarXp(0)).toBe("0");
    expect(formatarXp(999)).toBe("999");
    expect(formatarXp(1250)).toBe("1.250");
    expect(formatarXp(355000)).toBe("355.000");
    expect(formatarXp(1234567)).toBe("1.234.567");
  });

  it("linha do log: ganhou ou perdeu, e a marca é reconhecida", () => {
    expect(linhaDeXp("Ana", 300, 1250)).toBe("🏅 Ana ganhou 300 XP (total 1.250)");
    expect(linhaDeXp("Ana", -300, 950)).toBe("🏅 Ana perdeu 300 XP (total 950)");
    expect(ehLinhaDeXp("🏅 Ana ganhou 300 XP (total 1.250)")).toBe(true);
    expect(ehLinhaDeXp("Rodada 2 começou")).toBe(false);
  });
});
