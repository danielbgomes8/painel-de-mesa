import { describe, expect, it } from "vitest";
import { rolarIniciativa } from "./dados";

const sequencia = (...valores: number[]) => {
  let i = 0;
  return () => valores[i++];
};

describe("rolagem de iniciativa", () => {
  it("normal: um d20 mais o modificador", () => {
    expect(rolarIniciativa(3, false, sequencia(12))).toEqual({ total: 15, dados: [12] });
    expect(rolarIniciativa(-1, false, sequencia(1))).toEqual({ total: 0, dados: [1] });
  });

  it("com desvantagem (surpreso, regra de 2024): dois d20, vale o menor", () => {
    expect(rolarIniciativa(3, true, sequencia(18, 7))).toEqual({ total: 10, dados: [18, 7] });
    expect(rolarIniciativa(3, true, sequencia(7, 18))).toEqual({ total: 10, dados: [7, 18] });
    expect(rolarIniciativa(0, true, sequencia(9, 9)).total).toBe(9);
  });

  it("só rola o segundo dado quando tem desvantagem", () => {
    let chamadas = 0;
    rolarIniciativa(0, false, () => ++chamadas);
    expect(chamadas).toBe(1);
    chamadas = 0;
    rolarIniciativa(0, true, () => ++chamadas);
    expect(chamadas).toBe(2);
  });
});
