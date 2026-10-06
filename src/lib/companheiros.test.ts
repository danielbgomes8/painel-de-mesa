import { describe, expect, it } from "vitest";
import { companheirosDe, companheirosQueSaemJunto, comCompanheiros, ehDoJogador, linhaDeCompanheiro, nomeDoDono, npcsAdotaveis, type QuemTemDono } from "./companheiros";

const ana: QuemTemDono = { slug: "ana", name: "Ana", is_npc: false };
const beto: QuemTemDono = { slug: "beto", name: "Beto", is_npc: false };
const pip: QuemTemDono = { slug: "pip", name: "Pip", is_npc: true, dono: "ana" };
const lobo: QuemTemDono = { slug: "lobo", name: "Lobo", is_npc: true, dono: "ana" };
const goblin: QuemTemDono = { slug: "goblin", name: "Goblin", is_npc: true };
const todos = [ana, beto, pip, lobo, goblin];

describe("quem é companheiro de quem", () => {
  it("só NPC com o dono certo", () => {
    expect(companheirosDe(todos, "ana").map((x) => x.slug)).toEqual(["pip", "lobo"]);
    expect(companheirosDe(todos, "beto")).toEqual([]);
    expect(companheirosQueSaemJunto(todos, "ana")).toEqual(["pip", "lobo"]);
  });

  it("o jogador controla a si e aos companheiros dele, não aos dos outros", () => {
    expect(ehDoJogador(ana, "ana")).toBe(true);
    expect(ehDoJogador(pip, "ana")).toBe(true);
    expect(ehDoJogador(pip, "beto")).toBe(false);
    expect(ehDoJogador(goblin, "ana")).toBe(false);
    expect(ehDoJogador(pip, null)).toBe(false);
  });
});

describe("entrar na ordem junto com o dono", () => {
  it("os companheiros vêm logo depois do dono, com a mesma iniciativa", () => {
    const r = comCompanheiros([{ slug: "ana", name: "Ana", init: 14 }, { slug: "beto", name: "Beto", init: 9 }], todos, []);
    expect(r.itens).toEqual([
      { slug: "ana", name: "Ana", init: 14 },
      { slug: "pip", name: "Pip", init: 14 },
      { slug: "lobo", name: "Lobo", init: 14 },
      { slug: "beto", name: "Beto", init: 9 },
    ]);
    expect(r.acrescentados.map((a) => [a.item.slug, a.dono])).toEqual([["pip", "Ana"], ["lobo", "Ana"]]);
  });

  it("quem já está na ordem ou já vem na lista não se repete", () => {
    const r = comCompanheiros([{ slug: "ana", name: "Ana", init: 14 }], todos, [{ slug: "pip" }]);
    expect(r.itens.map((i) => i.slug)).toEqual(["ana", "lobo"]);
    const r2 = comCompanheiros([{ slug: "ana", name: "Ana", init: 14 }, { slug: "lobo", name: "Lobo", init: 3 }], todos, []);
    expect(r2.itens.map((i) => [i.slug, i.init])).toEqual([["ana", 14], ["pip", 14], ["lobo", 3]]);
  });

  it("NPC que entra não puxa companheiro, e dono sem companheiro entra sozinho", () => {
    expect(comCompanheiros([{ slug: "goblin", name: "Goblin", init: 5 }], todos, []).itens).toHaveLength(1);
    expect(comCompanheiros([{ slug: "beto", name: "Beto", init: 5 }], todos, []).acrescentados).toEqual([]);
  });

  it("a linha do log não usa 'entrou no combate' (o recap contaria como inimigo)", () => {
    expect(linhaDeCompanheiro("Pip", "Ana")).toBe("Pip acompanha Ana na iniciativa");
    expect(linhaDeCompanheiro("Pip", "Ana")).not.toMatch(/entrou no combate/);
  });
});

describe("dono e adoção", () => {
  it("o telão diz de quem é o companheiro", () => {
    expect(nomeDoDono(todos, pip)).toBe("Ana");
    expect(nomeDoDono(todos, goblin)).toBeNull();
    expect(nomeDoDono(todos, ana)).toBeNull();
    expect(nomeDoDono(todos, null)).toBeNull();
  });

  it("dono que não existe mais não vira nome", () => {
    expect(nomeDoDono([pip], pip)).toBeNull();
  });

  it("só NPC sem dono pode ser adotado", () => {
    expect(npcsAdotaveis(todos).map((x) => x.slug)).toEqual(["goblin"]);
  });
});
