import { describe, expect, it } from "vitest";
import {
  NOME_ACOES_LENDARIAS,
  NOME_COVIL,
  NOME_RESISTENCIA_LENDARIA,
  acharRecurso,
  comAcoesLendarias,
  comCovil,
  comResistenciaLendaria,
  devolverAcaoLendaria,
  ehChefe,
  gastarAcoesLendarias,
  horaDoCovil,
  linhaDeAcaoLendaria,
  linhaDeResistenciaLendaria,
  posicaoDoCovil,
  recuperarAcoesLendarias,
  semChefe,
  usarResistenciaLendaria,
} from "./lendarias";
import type { Recurso } from "./tipos";

const furia: Recurso = { name: "Fúria", max: 3, cur: 1, short_rest: false };

describe("montar o chefe sem estragar os outros recursos", () => {
  it("acrescenta as ações lendárias, a resistência e o covil", () => {
    let r = comAcoesLendarias([furia]);
    r = comResistenciaLendaria(r);
    r = comCovil(r);
    expect(r.map((x) => x.name)).toEqual(["Fúria", NOME_ACOES_LENDARIAS, NOME_RESISTENCIA_LENDARIA, NOME_COVIL]);
    expect(acharRecurso(r, NOME_ACOES_LENDARIAS)).toMatchObject({ max: 3, cur: 3, short_rest: false });
    expect(acharRecurso(r, NOME_COVIL)).toMatchObject({ max: 1, cur: 1 });
    expect(acharRecurso(r, "Fúria")).toEqual(furia);
    expect(ehChefe(r)).toBe(true);
    expect(ehChefe([furia])).toBe(false);
  });

  it("repetir não duplica e mudar o máximo respeita o que já tinha gasto", () => {
    const gasto = gastarAcoesLendarias(comAcoesLendarias([], 3), 2)!.recursos; // 1/3
    const r = comAcoesLendarias(gasto, 5);
    expect(r.filter((x) => x.name === NOME_ACOES_LENDARIAS)).toHaveLength(1);
    expect(acharRecurso(r, NOME_ACOES_LENDARIAS)).toMatchObject({ max: 5, cur: 1 });
    expect(acharRecurso(comAcoesLendarias(r, 2), NOME_ACOES_LENDARIAS)).toMatchObject({ max: 2, cur: 1 });
  });

  it("máximo fora da faixa é corrigido", () => {
    expect(acharRecurso(comAcoesLendarias([], 0), NOME_ACOES_LENDARIAS)?.max).toBe(1);
    expect(acharRecurso(comAcoesLendarias([], 99), NOME_ACOES_LENDARIAS)?.max).toBe(9);
  });

  it("tirar o chefe deixa o resto", () => {
    const r = comCovil(comResistenciaLendaria(comAcoesLendarias([furia])));
    expect(semChefe(r)).toEqual([furia]);
  });
});

describe("gastar e recuperar", () => {
  const chefe = comAcoesLendarias([furia], 3);

  it("gasta 1 a 3 e diz quanto resta", () => {
    const a = gastarAcoesLendarias(chefe, 2)!;
    expect(a.restam).toBe(1);
    expect(a.max).toBe(3);
    expect(acharRecurso(a.recursos, NOME_ACOES_LENDARIAS)?.cur).toBe(1);
    expect(acharRecurso(a.recursos, "Fúria")).toEqual(furia);
  });

  it("não gasta mais do que tem, nem custo inválido, nem sem o recurso", () => {
    const a = gastarAcoesLendarias(chefe, 2)!.recursos; // sobra 1
    expect(gastarAcoesLendarias(a, 2)).toBeNull();
    expect(gastarAcoesLendarias(chefe, 0)).toBeNull();
    expect(gastarAcoesLendarias([furia], 1)).toBeNull();
  });

  it("volta ao máximo no início do turno, e não grava nada se já estava cheio", () => {
    const gasto = gastarAcoesLendarias(chefe, 3)!.recursos; // 0/3
    const r = recuperarAcoesLendarias(gasto)!;
    expect(acharRecurso(r, NOME_ACOES_LENDARIAS)?.cur).toBe(3);
    expect(recuperarAcoesLendarias(chefe)).toBeNull();
    expect(recuperarAcoesLendarias([furia])).toBeNull();
  });

  it("devolver uma por uma, sem passar do máximo", () => {
    const gasto = gastarAcoesLendarias(chefe, 2)!.recursos;
    const um = devolverAcaoLendaria(gasto)!;
    expect(acharRecurso(um, NOME_ACOES_LENDARIAS)?.cur).toBe(2);
    expect(devolverAcaoLendaria(chefe)).toBeNull();
  });

  it("resistência lendária: usa até acabar e não volta sozinha", () => {
    let r = comResistenciaLendaria([], 2);
    const a = usarResistenciaLendaria(r)!;
    expect(a.restam).toBe(1);
    r = a.recursos;
    r = usarResistenciaLendaria(r)!.recursos;
    expect(usarResistenciaLendaria(r)).toBeNull();
    expect(recuperarAcoesLendarias(r)).toBeNull();
  });
});

describe("ações de covil na contagem 20", () => {
  const o = (...inits: number[]) => inits.map((init) => ({ init }));

  it("caem antes do primeiro com menos de 20 (quem empata em 20 age antes do covil)", () => {
    expect(posicaoDoCovil(o(25, 20, 18, 7))).toBe(2);
    expect(posicaoDoCovil(o(20, 20, 19))).toBe(2);
    expect(posicaoDoCovil(o(19, 10))).toBe(0);
  });

  it("se todo mundo tem 20 ou mais, o aviso vem no primeiro da rodada", () => {
    expect(posicaoDoCovil(o(30, 22, 20))).toBe(0);
  });

  it("é a hora quando o turno atual é essa posição", () => {
    const ordem = o(25, 20, 18, 7);
    expect([0, 1, 2, 3].map((t) => horaDoCovil(ordem, t))).toEqual([false, false, true, false]);
    expect(horaDoCovil([], 0)).toBe(false);
  });
});

describe("linhas do log", () => {
  it("ação lendária e resistência", () => {
    expect(linhaDeAcaoLendaria("Dragão", 1, 2, 3)).toBe("👑 Dragão usou uma ação lendária (restam 2/3)");
    expect(linhaDeAcaoLendaria("Dragão", 2, 1, 3)).toBe("👑 Dragão usou 2 ações lendárias (restam 1/3)");
    expect(linhaDeResistenciaLendaria("Um inimigo", 2, 3)).toBe("👑 Um inimigo usou uma resistência lendária (restam 2/3)");
  });
});
