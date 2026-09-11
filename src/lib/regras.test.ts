import { describe, expect, it } from "vitest";
import {
  ajustarPV,
  alternarPips,
  descansoLongo,
  deslocamentoEfetivo,
  efeitoExaustao,
  faixaPV,
  formatarMetros,
  limitarExaustao,
  limitarPV,
  ordenarPorIniciativa,
  penalidadeD20,
  proximoTurno,
  reducaoDeslocamento,
  situacaoMorte,
  turnoAposRemover,
  turnoAposTrocar,
} from "./regras";

describe("PV", () => {
  it("trava entre 0 e o máximo", () => {
    expect(limitarPV(-5, 30)).toBe(0);
    expect(limitarPV(99, 30)).toBe(30);
    expect(limitarPV(12, 30)).toBe(12);
  });

  it("máximo negativo vira 0", () => {
    expect(limitarPV(10, -3)).toBe(0);
  });

  it("dano não deixa o PV negativo", () => {
    expect(ajustarPV({ hp: 4, hp_max: 20, dss: 0, dsf: 0 }, 4 - 10)).toEqual({ hp: 0 });
  });

  it("cura não passa do máximo", () => {
    expect(ajustarPV({ hp: 18, hp_max: 20, dss: 0, dsf: 0 }, 18 + 10)).toEqual({ hp: 20 });
  });

  it("recuperar PV acima de 0 zera os testes de morte", () => {
    expect(ajustarPV({ hp: 0, hp_max: 20, dss: 1, dsf: 2 }, 5)).toEqual({ hp: 5, dss: 0, dsf: 0 });
  });

  it("não mexe nos testes de morte se continuava acima de 0", () => {
    expect(ajustarPV({ hp: 10, hp_max: 20, dss: 0, dsf: 0 }, 15)).toEqual({ hp: 15 });
  });

  it("não zera testes de morte se o alvo continua a 0", () => {
    expect(ajustarPV({ hp: 0, hp_max: 20, dss: 1, dsf: 1 }, 0)).toEqual({ hp: 0 });
  });

  it("faixa da barra", () => {
    expect(faixaPV(20, 20)).toBe("cheio");
    expect(faixaPV(12, 20)).toBe("baixo");
    expect(faixaPV(6, 20)).toBe("critico");
    expect(faixaPV(0, 20)).toBe("critico");
  });
});

describe("exaustão 2024", () => {
  it("trilha 0–6", () => {
    expect(limitarExaustao(-2)).toBe(0);
    expect(limitarExaustao(9)).toBe(6);
  });

  it("-2 no D20 por nível", () => {
    expect(penalidadeD20(0)).toBe(0);
    expect(penalidadeD20(3)).toBe(6);
    expect(penalidadeD20(6)).toBe(12);
  });

  it("-1,5 m de deslocamento por nível", () => {
    expect(reducaoDeslocamento(2)).toBe(3);
    expect(deslocamentoEfetivo(9, 3)).toBe(4.5);
    expect(deslocamentoEfetivo(9, 6)).toBe(0);
  });

  it("descanso longo tira 1 nível, não zera", () => {
    expect(descansoLongo(5)).toBe(4);
    expect(descansoLongo(1)).toBe(0);
    expect(descansoLongo(0)).toBe(0);
  });

  it("formata metros com vírgula pt-BR", () => {
    expect(formatarMetros(4.5)).toBe("4,5 m");
    expect(formatarMetros(9)).toBe("9 m");
  });

  it("texto do efeito", () => {
    expect(efeitoExaustao(0)).toBe("Sem penalidade");
    expect(efeitoExaustao(2)).toContain("-4 em todos os testes de D20");
    expect(efeitoExaustao(2)).toContain("-3 m de deslocamento");
    expect(efeitoExaustao(6)).toContain("morte");
  });
});

describe("testes de morte", () => {
  it("3 sucessos = estável, 3 falhas = morto", () => {
    expect(situacaoMorte(0, 0)).toBe("em-jogo");
    expect(situacaoMorte(3, 0)).toBe("estavel");
    expect(situacaoMorte(1, 3)).toBe("morto");
  });
});

describe("pips", () => {
  it("clicar num vazio preenche até ele", () => {
    expect(alternarPips(2, 0)).toBe(3);
  });
  it("clicar no último preenchido esvazia até ele", () => {
    expect(alternarPips(2, 3)).toBe(2);
  });
});

describe("combate", () => {
  it("próximo turno dá a volta e incrementa a rodada", () => {
    expect(proximoTurno({ round: 1, turn: 0, order: [1, 2, 3] })).toEqual({ round: 1, turn: 1 });
    expect(proximoTurno({ round: 1, turn: 2, order: [1, 2, 3] })).toEqual({ round: 2, turn: 0 });
  });

  it("próximo turno sem ninguém na ordem não faz nada", () => {
    expect(proximoTurno({ round: 3, turn: 0, order: [] })).toEqual({ round: 3, turn: 0 });
  });

  it("ordena por iniciativa mantendo empates estáveis", () => {
    const r = ordenarPorIniciativa([
      { init: 10, name: "a" },
      { init: 15, name: "b" },
      { init: 10, name: "c" },
    ]);
    expect(r.map((x) => x.name)).toEqual(["b", "a", "c"]);
  });

  it("turno acompanha remoção", () => {
    expect(turnoAposRemover(2, 0, 3)).toBe(1);
    expect(turnoAposRemover(2, 3, 3)).toBe(2);
    expect(turnoAposRemover(3, 1, 3)).toBe(2);
  });

  it("turno acompanha troca de posição", () => {
    expect(turnoAposTrocar(1, 1, 0)).toBe(0);
    expect(turnoAposTrocar(0, 1, 0)).toBe(1);
    expect(turnoAposTrocar(4, 1, 0)).toBe(4);
  });
});
