import { describe, expect, it } from "vitest";
import { CURADOS_EN, TOTAL_SRD_2024, nomeEmPortugues, tamanhoReal } from "../../scripts/gerar-monstros-srd.mjs";
import { FAIXAS_ND, MONSTROS_CURADOS, MONSTROS_SRD, buscarMonstros, monstrosDaFaixa, ndTexto } from "./monstrosSrd";
import { MONSTROS_GERADOS } from "./monstrosSrdGerados";
import { DICAS_TATICA } from "./monstrosDicas";

/** Os três do SRD que não atacam (só se movem ou gritam). */
const SEM_ATAQUE = ["Mosca gigante", "Cavalo-marinho", "Fungo gritador"];

const nomes = (termo: string) => buscarMonstros(termo).map((m) => m.name);

describe("buscarMonstros", () => {
  it("acha sem acento, como se digita no celular", () => {
    expect(nomes("manticora")).toContain("Mantícora");
    expect(nomes("dragao")).toContain("Dragão azul jovem");
  });

  it("acha por tipo, não só por nome", () => {
    expect(nomes("morto-vivo")).toContain("Lich");
    expect(nomes("gigante")).toContain("Gigante do fogo");
  });

  it("ignora caixa e espaço em volta", () => {
    expect(nomes("  GOBLIN ")).toEqual(nomes("goblin"));
  });

  it("devolve vazio sem termo, pra não despejar o catálogo inteiro na tela", () => {
    expect(buscarMonstros("")).toEqual([]);
    expect(buscarMonstros("   ")).toEqual([]);
  });

  it("devolve vazio quando não existe (o Observador não está no SRD)", () => {
    expect(buscarMonstros("observador")).toEqual([]);
  });

  it("acha pelo nome em inglês, o do livro", () => {
    expect(nomes("owlbear")).toEqual(["Urso-coruja"]);
    expect(nomes("tarrasque")).toEqual(["Tarrasque"]);
    expect(nomes("adult red")).toEqual(["Dragão vermelho adulto"]);
  });

  it("'nd 1/4' e 'nd 5' devolvem só os daquele nível de desafio", () => {
    const quarto = buscarMonstros("nd 1/4");
    expect(quarto.map((m) => m.name)).toContain("Goblin");
    expect(quarto.every((m) => m.nd === 0.25)).toBe(true);
    const cinco = buscarMonstros("ND 5");
    expect(cinco.map((m) => m.name)).toEqual(expect.arrayContaining(["Troll", "Elemental do fogo"]));
    expect(cinco.every((m) => m.nd === 5)).toBe(true);
    expect(ndTexto(0.125)).toBe("1/8");
  });

  it("não tem nome repetido no catálogo (nome é a chave da lista)", () => {
    expect(new Set(MONSTROS_SRD.map((m) => m.name)).size).toBe(MONSTROS_SRD.length);
    expect(new Set(MONSTROS_SRD.map((m) => m.en)).size).toBe(MONSTROS_SRD.length);
  });

  it("todo monstro tem tipo e nota; ataque, todos menos os três que não atacam", () => {
    for (const m of MONSTROS_SRD) {
      expect(m.cls, m.name).not.toBe("");
      expect(m.notes, m.name).not.toBe("");
      if (!SEM_ATAQUE.includes(m.name)) expect(m.ataque, m.name).not.toBe("");
    }
  });

  it("tem o SRD 5.2 inteiro: curados + gerados, sem sobreposição", () => {
    expect(MONSTROS_SRD).toHaveLength(TOTAL_SRD_2024);
    expect(MONSTROS_CURADOS.map((m) => m.en).sort()).toEqual([...CURADOS_EN].sort());
    const curados = new Set(CURADOS_EN);
    expect(MONSTROS_GERADOS.filter((m) => curados.has(m.en))).toEqual([]);
  });

  it("o tipo segue 'Tipo tamanho' (a busca por tipo depende disso)", () => {
    const tipo =
      /^(Aberração|Fera|Celestial|Constructo|Dragão|Elemental|Fada|Corruptor|Gigante|Humanoide|Monstruosidade|Limo|Planta|Morto-vivo) /;
    const tamanho = / (miúd[oa]|pequen[oa]|médi[oa]|médio ou pequeno|média ou pequena|grande|enorme|imens[oa])$/;
    for (const m of MONSTROS_SRD) {
      expect(m.cls, m.name).toMatch(tipo);
      expect(m.cls, m.name).toMatch(tamanho);
    }
  });

  it("faixas de ND cobrem o catálogo inteiro, cada monstro uma vez", () => {
    const somados = FAIXAS_ND.reduce((soma, f) => soma + monstrosDaFaixa(f).length, 0);
    expect(somados).toBe(MONSTROS_SRD.length);
    expect(monstrosDaFaixa(FAIXAS_ND[0]).every((m) => m.nd === 0)).toBe(true);
    // nenhuma faixa vira lista de metros no celular
    for (const f of FAIXAS_ND) expect(monstrosDaFaixa(f).length, f.rotulo).toBeLessThanOrEqual(60);
  });

  // Guarda de edição: o catálogo já esteve com números de 2014 num app que joga
  // 2024. Estes três valores mudaram entre as edições — se alguém voltar a
  // copiar de fonte antiga, o teste quebra em vez de passar despercebido.
  it("os números são da edição 2024, não da anterior", () => {
    const pega = (nome: string) => MONSTROS_SRD.find((m) => m.name === nome)!;
    expect(pega("Goblin").hp_max, "Goblin tinha 7 PV em 2014, tem 10 em 2024").toBe(10);
    expect(pega("Zumbi").hp_max, "Zumbi tinha 22 PV em 2014, tem 15 em 2024").toBe(15);
    expect(pega("Lich").init_mod, "em 2024 a iniciativa é bônus próprio, não o mod de Destreza").toBe(17);
    expect(pega("Águia gigante").cls, "virou Celestial em 2024 — era Fera em 2014").toBe("Celestial grande");
    expect(pega("Assassino").hp_max, "Assassino tinha 78 PV em 2014, tem 97 em 2024").toBe(97);
  });

  it("acha os elementais e o mago/sacerdote/cavaleiro/guarda/assassino novos", () => {
    expect(nomes("elemental")).toEqual(
      expect.arrayContaining(["Elemental do fogo", "Elemental do ar", "Elemental da terra", "Elemental da água"]),
    );
    expect(nomes("humanoide")).toEqual(
      expect.arrayContaining(["Guarda", "Cavaleiro", "Mago", "Sacerdote", "Assassino"]),
    );
  });

  it("toda linha de ataque tem bônus de acerto e dano", () => {
    for (const m of MONSTROS_SRD) {
      if (SEM_ATAQUE.includes(m.name)) continue;
      expect(m.ataque, `${m.name} sem bônus de acerto`).toMatch(/[+-]\d+/);
      expect(m.ataque, `${m.name} sem dano`).toMatch(/\d+d\d+|[+-]\d+, \d+ /);
    }
  });
});

describe("gerador do catálogo (scripts/gerar-monstros-srd.mjs)", () => {
  it("a fonte marca Miúdo e 'Médio ou Pequeno' como Small: o dado de vida desempata", () => {
    const pequeno = (hit_dice: string) => tamanhoReal({ size: { name: "Small" }, hit_dice });
    expect(pequeno("1d4")).toBe("Tiny");
    expect(pequeno("3d6")).toBe("Small");
    expect(pequeno("2d8 + 2")).toBe("MediumOrSmall");
    expect(tamanhoReal({ size: { name: "Large" }, hit_dice: "8d10" })).toBe("Large");
    const pega = (nome: string) => MONSTROS_SRD.find((m) => m.name === nome)!;
    expect(pega("Gato").cls).toBe("Fera miúda");
    expect(pega("Diabrete").cls).toBe("Corruptor miúdo");
    expect(pega("Plebeu").cls).toBe("Humanoide médio ou pequeno");
    expect(pega("Chefe goblin").cls).toBe("Fada pequena");
  });

  it("dragão de cor e idade vira nome em português", () => {
    expect(nomeEmPortugues("Ancient Gold Dragon")).toBe("Dragão de ouro ancião");
    expect(nomeEmPortugues("Black Dragon Wyrmling")).toBe("Dragão preto filhote");
    expect(nomeEmPortugues("Dragon Turtle")).toBe("Tartaruga-dragão");
    expect(nomeEmPortugues("Monstro inventado")).toBeNull();
  });
});

describe("dicas de tática dos gerados (monstrosDicas.ts)", () => {
  it("cada dica é de um monstro gerado que existe (a chave é o nome em inglês)", () => {
    const gerados = new Set(MONSTROS_GERADOS.map((m) => m.en));
    for (const en of Object.keys(DICAS_TATICA)) expect(gerados.has(en), en).toBe(true);
  });

  it("a dica vai na frente da nota automática, sem apagar ela", () => {
    const chefe = MONSTROS_SRD.find((m) => m.en === "Goblin Boss")!;
    expect(chefe.notes.startsWith(DICAS_TATICA["Goblin Boss"])).toBe(true);
    expect(chefe.notes).toContain("ND 1 (200 XP)");
  });

  it("dica é frase curta e acabada, sem pé no lugar de metro", () => {
    for (const [en, dica] of Object.entries(DICAS_TATICA)) {
      expect(dica.length, en).toBeLessThanOrEqual(400);
      expect(dica, en).toMatch(/[.)]$/);
      expect(dica, en).not.toMatch(/\d+\s*(pés|ft)/);
    }
  });
});
