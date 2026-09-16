import { describe, expect, it } from "vitest";
import { HABILIDADES_CLASSE, habilidadesAte, habilidadesMulticlasse } from "./classesSrd";
import type { ClasseBase } from "./tipos";

const TODAS_AS_CLASSES: ClasseBase[] = [
  "barbaro",
  "bardo",
  "bruxo",
  "clerigo",
  "druida",
  "feiticeiro",
  "guerreiro",
  "ladino",
  "mago",
  "monge",
  "paladino",
  "patrulheiro",
];

describe("habilidadesAte", () => {
  it("devolve só as habilidades até o nível dado, em ordem", () => {
    const ate3 = habilidadesAte("feiticeiro", 3);
    expect(ate3.map((h) => h.nome)).toEqual([
      "Conjuração",
      "Feitiçaria Inata",
      "Fonte de Magia",
      "Metamagia",
      "Subclasse de Feiticeiro",
    ]);
    expect(ate3.every((h) => h.nivel <= 3)).toBe(true);
  });

  it("Feiticeiro nível 7 inclui Feitiçaria Encarnada, mas não Dádiva Épica (19)", () => {
    const nomes = habilidadesAte("feiticeiro", 7).map((h) => h.nome);
    expect(nomes).toContain("Feitiçaria Encarnada");
    expect(nomes).not.toContain("Dádiva Épica");
  });

  it("classe sem catálogo (hipotética) devolve lista vazia, não quebra", () => {
    expect(habilidadesAte("nenhuma-classe-assim" as ClasseBase, 10)).toEqual([]);
  });

  it("as 12 classes base têm catálogo, cada uma escolhendo subclasse no nível 3", () => {
    for (const classe of TODAS_AS_CLASSES) {
      const nivel1 = habilidadesAte(classe, 1);
      expect(nivel1.length, `${classe} sem nenhuma habilidade de nível 1`).toBeGreaterThan(0);
      const ate3 = habilidadesAte(classe, 3).map((h) => h.nome);
      expect(
        ate3.some((n) => n.toLowerCase().startsWith("subclasse")),
        `${classe} deveria escolher subclasse até o nível 3`,
      ).toBe(true);
    }
  });

  // Mesma pegadinha de "nível vazio" da open5e que já pegou o Monge (ver
  // comentário no topo de classesSrd.ts) — "Bard Subclass" veio sem nível.
  // Conferido contra aidedd.org: nível 3, igual a todas as outras classes.
  it("Bardo nível 2 não tem Subclasse ainda; nível 3 tem", () => {
    expect(habilidadesAte("bardo", 2).map((h) => h.nome)).not.toContain("Subclasse de Bardo");
    expect(habilidadesAte("bardo", 3).map((h) => h.nome)).toContain("Subclasse de Bardo");
  });

  it("não tem habilidade duplicada (mesma classe+nível+nome) no catálogo", () => {
    const chaves = HABILIDADES_CLASSE.map((h) => `${h.classe}:${h.nivel}:${h.nome}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("Guerreiro nível 2 tem Surto de Ação e Mente Tática, mas não Subclasse (3)", () => {
    const nomes = habilidadesAte("guerreiro", 2).map((h) => h.nome);
    expect(nomes).toContain("Surto de Ação");
    expect(nomes).toContain("Mente Tática");
    expect(nomes).not.toContain("Subclasse de Guerreiro");
  });

  it("Guerreiro nível 9 tem Indomável e Mestre Tático", () => {
    expect(habilidadesAte("guerreiro", 9).map((h) => h.nome)).toContain("Indomável");
    expect(habilidadesAte("guerreiro", 9).map((h) => h.nome)).toContain("Mestre Tático");
  });

  // Pegadinha da open5e (ver comentário no topo de classesSrd.ts): Desviar
  // Ataques veio sem nível, Golpe Atordoante veio marcado em dois níveis (3 e
  // 5) — conferido contra aidedd.org/Roll20, é nível 3 e 5 respectivamente.
  it("Monge nível 3 tem Desviar Ataques, mas não Golpe Atordoante (5)", () => {
    const nomes = habilidadesAte("monge", 3).map((h) => h.nome);
    expect(nomes).toContain("Desviar Ataques");
    expect(nomes).not.toContain("Golpe Atordoante");
  });

  it("Monge nível 5 já tem Golpe Atordoante", () => {
    expect(habilidadesAte("monge", 5).map((h) => h.nome)).toContain("Golpe Atordoante");
  });

  it("multiclasse: concatena as habilidades de cada classe, marcadas com o índice de origem", () => {
    const r = habilidadesMulticlasse([
      { classe: "feiticeiro", nivel: 3 },
      { classe: "barbaro", nivel: 2 },
    ]);
    expect(r.filter((h) => h.classeIndice === 0).map((h) => h.nome)).toEqual([
      "Conjuração",
      "Feitiçaria Inata",
      "Fonte de Magia",
      "Metamagia",
      "Subclasse de Feiticeiro",
    ]);
    expect(r.filter((h) => h.classeIndice === 1).map((h) => h.nome)).toEqual([
      "Fúria",
      "Defesa sem Armadura",
      "Maestria em Armas",
      "Sentido de Perigo",
      "Ataque Imprudente",
    ]);
  });

  it("Bárbaro nível 7 inclui Bote Instintivo e Instinto Selvagem, mas não Golpe Brutal (9)", () => {
    const nomes = habilidadesAte("barbaro", 7).map((h) => h.nome);
    expect(nomes).toContain("Bote Instintivo");
    expect(nomes).toContain("Instinto Selvagem");
    expect(nomes).not.toContain("Golpe Brutal");
  });

  it("Bárbaro nível 1 tem Fúria, Defesa sem Armadura e Maestria em Armas", () => {
    expect(habilidadesAte("barbaro", 1).map((h) => h.nome)).toEqual([
      "Fúria",
      "Defesa sem Armadura",
      "Maestria em Armas",
    ]);
  });
});
