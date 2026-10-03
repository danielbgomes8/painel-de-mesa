import { describe, expect, it } from "vitest";
import {
  DADO_DE_VIDA,
  ganhaAumentoDeAtributo,
  pvDoNivel,
  subirDeNivel,
  validarAumentos,
  type EstadoSubida,
  type PedidoSubida,
} from "./subirDeNivel";
import type { HabilidadeClasse } from "./classesSrd";
import { PREFIXO_ESPACO_MAGIA } from "./regras";
import type { Atributos, ClassePersonagem, Recurso } from "./tipos";

const ATR: Atributos = { for: 16, des: 12, con: 14, int: 10, sab: 10, car: 12 };
const classe = (c: ClassePersonagem["classe"], nivel: number, conjurador: ClassePersonagem["conjurador"] = "nenhum"): ClassePersonagem => ({
  classe: c,
  nivel,
  conjurador,
  atributo_conjuracao: conjurador === "nenhum" ? null : "car",
});
const espaco = (n: number, cur: number, max: number): Recurso => ({ name: `${PREFIXO_ESPACO_MAGIA}${n}`, max, cur, short_rest: false });

function estado(extra: Partial<EstadoSubida> = {}): EstadoSubida {
  return {
    name: "Ana",
    classes: [classe("paladino", 1)],
    atributos: ATR,
    hp: 12,
    hp_max: 12,
    hd_max: 1,
    hd_cur: 1,
    hd_die: "d8",
    resources: [],
    ficha_secoes: [],
    ...extra,
  };
}
const fixo: PedidoSubida = { indiceClasse: 0, pv: { tipo: "fixo" }, anotarHabilidades: false };
const ok = (r: ReturnType<typeof subirDeNivel>) => {
  if (!r.ok) throw new Error(r.motivo);
  return r;
};

describe("tabelas conferidas na fonte (SRD 5.2)", () => {
  it("dado de vida de cada classe", () => {
    expect(DADO_DE_VIDA).toEqual({
      barbaro: 12,
      bardo: 8,
      bruxo: 8,
      clerigo: 8,
      druida: 8,
      feiticeiro: 6,
      guerreiro: 10,
      ladino: 8,
      mago: 6,
      monge: 8,
      paladino: 10,
      patrulheiro: 10,
    });
  });

  it("aumento de atributo: 4, 8, 12 e 16 — e mais 6 e 14 pro Guerreiro, mais 10 pro Ladino", () => {
    const niveis = (c: Parameters<typeof ganhaAumentoDeAtributo>[0]) => Array.from({ length: 20 }, (_, i) => i + 1).filter((n) => ganhaAumentoDeAtributo(c, n));
    expect(niveis("mago")).toEqual([4, 8, 12, 16]);
    expect(niveis("guerreiro")).toEqual([4, 6, 8, 12, 14, 16]);
    expect(niveis("ladino")).toEqual([4, 8, 10, 12, 16]);
  });
});

describe("PV do nível", () => {
  it("valor fixo: metade do dado + 1, mais Constituição", () => {
    expect(pvDoNivel(10, { tipo: "fixo" }, 2)).toBe(8);
    expect(pvDoNivel(6, { tipo: "fixo" }, 0)).toBe(4);
  });

  it("nunca menos que 1, mesmo com Constituição ruim", () => {
    expect(pvDoNivel(6, { tipo: "fixo" }, -3)).toBe(1);
    expect(pvDoNivel(6, { tipo: "rolado", valor: 1 }, -4)).toBe(1);
  });

  it("rolado: soma o valor do dado; fora de 1 até as faces não vale", () => {
    expect(pvDoNivel(8, { tipo: "rolado", valor: 7 }, 1)).toBe(8);
    expect(pvDoNivel(8, { tipo: "rolado", valor: 9 }, 1)).toBeNull();
    expect(pvDoNivel(8, { tipo: "rolado", valor: 0 }, 1)).toBeNull();
    expect(pvDoNivel(8, { tipo: "rolado", valor: 2.5 }, 1)).toBeNull();
  });
});

describe("aumento de atributo", () => {
  it("+2 em um ou +1 em dois; ninguém passa de 20", () => {
    expect(validarAumentos(ATR, { for: 2 })).toMatchObject({ ok: true });
    expect(validarAumentos(ATR, { for: 1, des: 1 })).toMatchObject({ ok: true });
    expect(validarAumentos(ATR, { for: 3 })).toMatchObject({ ok: false });
    expect(validarAumentos(ATR, { for: 1 })).toMatchObject({ ok: false });
    expect(validarAumentos(ATR, { for: 1, des: 1, con: 1 })).toMatchObject({ ok: false });
    expect(validarAumentos(ATR, { for: -1, des: 3 })).toMatchObject({ ok: false });
    expect(validarAumentos({ ...ATR, for: 19 }, { for: 2 })).toMatchObject({ ok: false });
    expect(validarAumentos({ ...ATR, for: 19 }, { for: 1, des: 1 })).toMatchObject({ ok: true });
  });
});

describe("subir um nível", () => {
  it("Paladino 1→2: PV fixo d10 + CON +2, dado de vida e classe; nada mais muda", () => {
    const r = ok(subirDeNivel(estado(), fixo));
    expect(r.patch).toMatchObject({ hp_max: 20, hp: 20, hd_max: 2, hd_cur: 2, hd_die: "d10" });
    expect(r.patch.classes).toEqual([classe("paladino", 2)]);
    expect(r.patch.atributos).toBeUndefined();
    expect(r.patch.resources).toBeUndefined();
    expect(r.textoLog).toBe("Ana subiu para o nível 2 (Paladino 2)");
    expect(r.linhas[0]).toContain("Nível 2");
    expect(r.linhas.join("\n")).toContain("PV máximo +8");
  });

  it("PV atual sobe junto com o máximo, mas só quem está de pé", () => {
    expect(ok(subirDeNivel(estado({ hp: 5 }), fixo)).patch.hp).toBe(13);
    expect(ok(subirDeNivel(estado({ hp: 0 }), fixo)).patch.hp).toBe(0);
  });

  it("dado de vida gasto continua gasto", () => {
    const r = ok(subirDeNivel(estado({ hd_max: 2, hd_cur: 0, classes: [classe("paladino", 2)] }), fixo));
    expect(r.patch).toMatchObject({ hd_max: 3, hd_cur: 1 });
  });

  it("valor rolado inválido recusa, e diz o intervalo", () => {
    const r = subirDeNivel(estado(), { ...fixo, pv: { tipo: "rolado", valor: 11 } });
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.motivo).toContain("d10");
  });

  it("nível 20 no total trava, mesmo com várias classes", () => {
    expect(subirDeNivel(estado({ classes: [classe("paladino", 20)] }), fixo)).toMatchObject({ ok: false });
    const multi = estado({ classes: [classe("paladino", 12), classe("mago", 8, "completo")] });
    expect(subirDeNivel(multi, fixo)).toMatchObject({ ok: false });
  });

  it("classe que não existe na ficha", () => {
    expect(subirDeNivel(estado(), { ...fixo, indiceClasse: 3 })).toMatchObject({ ok: false });
  });

  it("proficiência sobe no nível 5 (e só nele) e a tela é avisada", () => {
    const no5 = ok(subirDeNivel(estado({ classes: [classe("paladino", 4)] }), { ...fixo, atributos: { tipo: "talento" } }));
    expect(no5.linhas.join("\n")).toContain("Bônus de proficiência: +3");
    expect(no5.avisos.join(" ")).toContain("proficiência");
    const no6 = ok(subirDeNivel(estado({ classes: [classe("paladino", 5)] }), fixo));
    expect(no6.linhas.join("\n")).not.toContain("Bônus de proficiência");
    expect(no6.avisos.join(" ")).not.toContain("proficiência");
  });

  it("multiclasse: o dado da ficha não troca (o PV usa o dado da classe que subiu)", () => {
    const multi = estado({ classes: [classe("paladino", 2), classe("mago", 1, "completo")], hd_die: "d10" });
    const r = ok(subirDeNivel(multi, { ...fixo, indiceClasse: 1 }));
    expect(r.patch.hd_die).toBeUndefined();
    expect(r.patch.hp_max).toBe(12 + (4 + 2)); // mago d6: 3 + 1 + CON 2
  });
});

describe("aumento de atributo no nível certo", () => {
  const no3 = estado({ classes: [classe("mago", 3, "completo")] });

  it("no nível 4 a escolha é obrigatória", () => {
    expect(subirDeNivel(no3, fixo)).toMatchObject({ ok: false });
  });

  it("aumenta os atributos escolhidos e grava", () => {
    const r = ok(subirDeNivel(no3, { ...fixo, atributos: { tipo: "atributos", aumentos: { int: 2 } } }));
    expect(r.patch.atributos).toEqual({ ...ATR, int: 12 });
    expect(r.linhas.join("\n")).toContain("INT +2 (10 → 12)");
  });

  it("talento: não mexe nos atributos e avisa pra anotar", () => {
    const r = ok(subirDeNivel(no3, { ...fixo, atributos: { tipo: "talento" } }));
    expect(r.patch.atributos).toBeUndefined();
    expect(r.avisos.join(" ")).toContain("talento");
  });

  it("escolha inválida de atributo recusa", () => {
    expect(subirDeNivel(no3, { ...fixo, atributos: { tipo: "atributos", aumentos: { int: 1 } } })).toMatchObject({ ok: false });
  });

  it("fora desses níveis, escolha de atributo é ignorada", () => {
    const r = ok(subirDeNivel(estado({ classes: [classe("mago", 1, "completo")] }), { ...fixo, atributos: { tipo: "atributos", aumentos: { int: 2 } } }));
    expect(r.patch.atributos).toBeUndefined();
  });

  it("Constituição que sobe de modificador dá PV retroativo de todos os níveis de antes", () => {
    // CON 15 (+2) → 16 (+3) no 4º nível de um Mago (d6): do nível 4+3=7... fixo 4 + 3 = 7; retroativo 1 × 3 níveis
    const r = ok(
      subirDeNivel(estado({ classes: [classe("mago", 3, "completo")], atributos: { ...ATR, con: 15 }, hp: 20, hp_max: 20 }), {
        ...fixo,
        atributos: { tipo: "atributos", aumentos: { con: 1, int: 1 } },
      }),
    );
    expect(r.patch.hp_max).toBe(20 + 7 + 3);
    expect(r.linhas.join("\n")).toContain("mais 3 dos níveis anteriores");
  });

  it("Constituição que sobe mas não muda de modificador não dá retroativo", () => {
    const r = ok(
      subirDeNivel(estado({ classes: [classe("mago", 3, "completo")] }), { ...fixo, atributos: { tipo: "atributos", aumentos: { con: 1, int: 1 } } }),
    );
    expect(r.patch.hp_max).toBe(12 + 4 + 2); // CON 14→15: modificador continua +2
  });

  it("nível 19 avisa da Dádiva Épica", () => {
    const r = ok(subirDeNivel(estado({ classes: [classe("mago", 18, "completo")] }), fixo));
    expect(r.avisos.join(" ")).toContain("Dádiva Épica");
  });
});

describe("espaços de magia", () => {
  const mago = (n: number) => estado({ classes: [classe("mago", n, "completo")], atributos: { ...ATR, int: 16 } });

  it("sobe o máximo e mantém o que já foi gasto", () => {
    // Mago 4 tem 4/3 espaços (1º e 2º 3? 4,3); no 5: 4,3,2
    const r = ok(
      subirDeNivel({ ...mago(4), resources: [espaco(1, 1, 4), espaco(2, 0, 3)] }, { ...fixo, atributos: { tipo: "talento" } }),
    );
    // nível 4→5 não é de atributo (8 é), então não precisa da escolha, só ignora
    const res = r.patch.resources!;
    expect(res.map((x) => [x.name, x.cur, x.max])).toEqual([
      [`${PREFIXO_ESPACO_MAGIA}1`, 1, 4],
      [`${PREFIXO_ESPACO_MAGIA}2`, 0, 3],
      [`${PREFIXO_ESPACO_MAGIA}3`, 2, 2],
    ]);
    expect(r.linhas.join("\n")).toContain("Espaços de magia: 1º 4 · 2º 3 · 3º 2");
  });

  it("máximo que sobe traz o uso novo junto (2 → 3 espaços: o terceiro vem cheio)", () => {
    const r = ok(subirDeNivel({ ...estado({ classes: [classe("mago", 2, "completo")] }), resources: [espaco(1, 1, 3)] }, fixo));
    const n1 = r.patch.resources!.find((x) => x.name.endsWith("1"))!;
    expect(n1.max).toBe(4);
    expect(n1.cur).toBe(2); // tinha 1 gasto de 3; o 4º chega cheio
  });

  it("não toca em recursos que não são espaço de magia", () => {
    const furia: Recurso = { name: "Fúria", max: 3, cur: 1, short_rest: false };
    const r = ok(subirDeNivel({ ...mago(1), resources: [furia, espaco(1, 2, 2)] }, fixo));
    expect(r.patch.resources![0]).toEqual(furia);
  });

  it("sem espaços gerados na ficha: não inventa, avisa", () => {
    const r = ok(subirDeNivel(mago(1), fixo));
    expect(r.patch.resources).toBeUndefined();
    expect(r.avisos.join(" ")).toContain("Gere os espaços");
  });

  it("subir uma classe que não conjura não mexe nos espaços", () => {
    const e = estado({ classes: [classe("guerreiro", 1)], resources: [espaco(1, 1, 2)] });
    expect(ok(subirDeNivel(e, fixo)).patch.resources).toBeUndefined();
  });

  it("duas classes conjuradoras: deixa pra pessoa e avisa", () => {
    const e = estado({ classes: [classe("mago", 1, "completo"), classe("clerigo", 1, "completo")], resources: [espaco(1, 2, 2)] });
    const r = ok(subirDeNivel(e, fixo));
    expect(r.patch.resources).toBeUndefined();
    expect(r.avisos.join(" ")).toContain("Mais de uma classe conjuradora");
  });

  it("Bruxo (pacto): o nível do espaço sobe e o antigo some", () => {
    const bruxo = estado({ classes: [classe("bruxo", 2, "pacto")], resources: [{ name: `${PREFIXO_ESPACO_MAGIA}1`, max: 2, cur: 0, short_rest: true }] });
    const r = ok(subirDeNivel(bruxo, fixo)); // nível 3: 2 espaços de 2º
    expect(r.patch.resources).toEqual([{ name: `${PREFIXO_ESPACO_MAGIA}2`, max: 2, cur: 2, short_rest: true }]);
  });
});

describe("habilidades novas", () => {
  const h = (nome: string): HabilidadeClasse => ({ classe: "paladino", nivel: 2, nome, descricao: `${nome}: texto` });

  it("anota na ficha completa numa seção da classe, uma vez só", () => {
    const novas = [h("Punição Divina"), h("Estilo de Luta")];
    const um = ok(subirDeNivel(estado(), { ...fixo, anotarHabilidades: true }, novas));
    const secao = um.patch.ficha_secoes![0];
    expect(secao).toMatchObject({ titulo: "Habilidades de Paladino", tipo: "lista" });
    expect(secao.itens).toEqual([
      { titulo: "Punição Divina", tag: "Nv. 2", descricao: "Punição Divina: texto" },
      { titulo: "Estilo de Luta", tag: "Nv. 2", descricao: "Estilo de Luta: texto" },
    ]);
    // O mesmo nível anotado de novo (desfez e refez) não duplica.
    const dois = ok(subirDeNivel(estado({ ficha_secoes: um.patch.ficha_secoes }), { ...fixo, anotarHabilidades: true }, novas));
    expect(dois.patch.ficha_secoes![0].itens).toHaveLength(2);
  });

  it("sem marcar a opção, só lista no resumo e não mexe na ficha completa", () => {
    const r = ok(subirDeNivel(estado(), fixo, [h("Punição Divina")]));
    expect(r.patch.ficha_secoes).toBeUndefined();
    expect(r.linhas.join("\n")).toContain("Habilidades novas: Punição Divina");
  });

  it("acrescenta numa seção que já existe, sem apagar o que o jogador escreveu", () => {
    const existente = [{ titulo: "Habilidades de Paladino", tipo: "lista" as const, itens: [{ titulo: "Minha anotação", descricao: "x" }] }];
    const r = ok(subirDeNivel(estado({ ficha_secoes: existente }), { ...fixo, anotarHabilidades: true }, [h("Punição Divina")]));
    expect(r.patch.ficha_secoes![0].itens!.map((i) => i.titulo)).toEqual(["Minha anotação", "Punição Divina"]);
  });

  it("não mexe em outras seções da ficha", () => {
    const outra = { titulo: "História", tipo: "texto" as const, texto: "Era uma vez" };
    const r = ok(subirDeNivel(estado({ ficha_secoes: [outra] }), { ...fixo, anotarHabilidades: true }, [h("Punição Divina")]));
    expect(r.patch.ficha_secoes![0]).toEqual(outra);
    expect(r.patch.ficha_secoes).toHaveLength(2);
  });
});
