import { describe, expect, it } from "vitest";
import {
  chaveDoNome,
  inimigosDerrotados,
  jogadoresCaidos,
  jogadoresDoCombate,
  lerXpDigitado,
  linhaDeFimDoCombate,
  partilharXp,
  semCondicoesComPrazo,
  xpDoInimigo,
  type QuemNaOrdem,
} from "./fimDoCombate";

const p = (slug: string, hp: number, is_npc: boolean, name = slug): QuemNaOrdem => ({ slug, hp, is_npc, name });
const catalogo = [
  { name: "Goblin", en: "Goblin Warrior", xp: 50 },
  { name: "Esqueleto", en: "Skeleton", xp: 50 },
  { name: "Dragão Vermelho Adulto", en: "Adult Red Dragon", xp: 10000 },
];

describe("achar o XP do inimigo pelo nome", () => {
  it("a chave ignora acento, caixa e o número de cópia no fim", () => {
    expect(chaveDoNome("Goblin 2")).toBe("goblin");
    expect(chaveDoNome("goblin #3")).toBe("goblin");
    expect(chaveDoNome("Goblin nº 4")).toBe("goblin");
    expect(chaveDoNome("  Dragão Vermelho Adulto ")).toBe("dragao vermelho adulto");
    expect(chaveDoNome("Goblin Chefe")).toBe("goblin chefe");
  });

  it("acha pelo nome em português ou em inglês, e cópia numerada vale o mesmo", () => {
    expect(xpDoInimigo("Goblin", catalogo)).toBe(50);
    expect(xpDoInimigo("Goblin 3", catalogo)).toBe(50);
    expect(xpDoInimigo("skeleton", catalogo)).toBe(50);
    expect(xpDoInimigo("Dragao vermelho adulto", catalogo)).toBe(10000);
  });

  it("nome que não bate não chuta XP", () => {
    expect(xpDoInimigo("Goblin Chefe", catalogo)).toBeNull();
    expect(xpDoInimigo("Bandido Fulano", catalogo)).toBeNull();
    expect(xpDoInimigo("", catalogo)).toBeNull();
    expect(xpDoInimigo("123", catalogo)).toBeNull();
  });
});

describe("quem foi derrotado e quem estava no combate", () => {
  const todos = [p("ana", 0, false), p("beto", 12, false), p("gob1", 0, true), p("gob2", 5, true), p("gob3", -3, true), p("fora", 0, true), p("ciro", 20, false)];
  const ordem = [{ slug: "ana" }, { slug: "beto" }, { slug: "gob1" }, { slug: "gob2" }, { slug: "gob3" }];

  it("derrotado é inimigo na ordem com 0 PV ou menos; jogador caído não conta", () => {
    expect(inimigosDerrotados(ordem, todos).map((x) => x.slug)).toEqual(["gob1", "gob3"]);
  });

  it("jogadores do combate são os que estão na ordem; os caídos aparecem à parte", () => {
    expect(jogadoresDoCombate(ordem, todos).map((x) => x.slug)).toEqual(["ana", "beto"]);
    expect(jogadoresCaidos(ordem, todos).map((x) => x.slug)).toEqual(["ana"]);
  });
});

describe("partilha do XP", () => {
  it("soma e divide, dizendo a sobra", () => {
    expect(partilharXp([50, 50, 100], 4)).toEqual({ total: 200, cada: 50, sobra: 0 });
    expect(partilharXp([50, 50, 100], 3)).toEqual({ total: 200, cada: 66, sobra: 2 });
  });

  it("sem ninguém pra receber, nada sai", () => {
    expect(partilharXp([100], 0)).toEqual({ total: 100, cada: 0, sobra: 100 });
  });

  it("ignora valor negativo e lê o que foi digitado", () => {
    expect(partilharXp([50, -20], 1).total).toBe(50);
    expect(lerXpDigitado("75")).toBe(75);
    expect(lerXpDigitado("")).toBe(0);
    expect(lerXpDigitado("abc")).toBe(0);
    expect(lerXpDigitado("-5")).toBe(0);
  });
});

describe("condições com prazo", () => {
  it("tira só as que têm prazo e zera os prazos", () => {
    const r = semCondicoesComPrazo({ Atordoado: true, Envenenado: true, Caído: false }, { Atordoado: 2, Caído: 1 });
    expect(r.cond).toEqual({ Envenenado: true });
    expect(r.cond_prazo).toEqual({});
    expect(r.tiradas).toEqual(["Atordoado"]);
  });

  it("sem prazo nenhum, não mexe em nada", () => {
    const r = semCondicoesComPrazo({ Envenenado: true }, {});
    expect(r.cond).toEqual({ Envenenado: true });
    expect(r.tiradas).toEqual([]);
  });
});

describe("linha do log", () => {
  it("rodadas, derrotados e XP", () => {
    expect(linhaDeFimDoCombate(4, 3, { total: 900, cada: 225, sobra: 0 }, 4)).toBe(
      "🏁 Combate encerrado: 4 rodadas, 3 inimigos derrotados, 900 XP (225 pra cada um)",
    );
    expect(linhaDeFimDoCombate(1, 1, { total: 50, cada: 50, sobra: 0 }, 1)).toBe(
      "🏁 Combate encerrado: 1 rodada, 1 inimigo derrotado, 50 XP (50 pra o jogador)",
    );
    expect(linhaDeFimDoCombate(2, 0, { total: 0, cada: 0, sobra: 0 }, 3)).toBe("🏁 Combate encerrado: 2 rodadas");
  });
});
