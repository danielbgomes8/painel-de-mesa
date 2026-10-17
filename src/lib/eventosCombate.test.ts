import { describe, expect, it } from "vitest";
import {
  disparou,
  eventosAoTirarGrupo,
  eventosParaOCombate,
  linhaPublicaDoEvento,
  normalizarEvento,
  normalizarPreparados,
  pendentes,
  rotuloDoGatilho,
  testeDeConcentracao,
  validarNovoEvento,
  type EventoDoCombate,
  type SituacaoDoCombate,
} from "./eventosCombate";
import type { GrupoEncontro } from "./tipos";

const sit = (round: number, fichas: SituacaoDoCombate["fichas"] = [], combateAtivo = true): SituacaoDoCombate => ({ combateAtivo, round, fichas });
const ev = (extra: Partial<EventoDoCombate>): EventoDoCombate => ({
  id: "e1", room_code: "s", tipo: "rodada", rodada: 3, slugs: [], pct: null, texto: "x", publico: false, feito: false, created_at: "2026-10-09T10:00:00Z", ...extra,
});
const grupo = (name: string, quantidade: number): GrupoEncontro => ({ name, cls: "", ac: 10, hp_max: 10, speed: 9, init_mod: 0, ataque: "", notes: "", quantidade });

describe("disparou", () => {
  it("por rodada: chegou ou passou da rodada", () => {
    expect(disparou(ev({ rodada: 3 }), sit(2))).toBe(false);
    expect(disparou(ev({ rodada: 3 }), sit(3))).toBe(true);
    expect(disparou(ev({ rodada: 3 }), sit(5))).toBe(true);
  });
  it("sem combate de pé nada dispara", () => {
    expect(disparou(ev({ rodada: 1 }), sit(1, [], false))).toBe(false);
  });
  it("por PV: no percentual ou abaixo, e basta um dos monstros", () => {
    const e = ev({ tipo: "pv", rodada: null, pct: 50, slugs: ["g1", "g2"] });
    expect(disparou(e, sit(1, [{ slug: "g1", hp: 6, hp_max: 10 }, { slug: "g2", hp: 10, hp_max: 10 }]))).toBe(false);
    expect(disparou(e, sit(1, [{ slug: "g1", hp: 5, hp_max: 10 }]))).toBe(true);
    expect(disparou(e, sit(1, [{ slug: "g1", hp: 10, hp_max: 10 }, { slug: "g2", hp: 1, hp_max: 10 }]))).toBe(true);
  });
  it("0% é a 0 PV; 100% dispara na hora; ficha de outro monstro ou que sumiu não conta", () => {
    const zero = ev({ tipo: "pv", rodada: null, pct: 0, slugs: ["d"] });
    expect(disparou(zero, sit(1, [{ slug: "d", hp: 1, hp_max: 200 }]))).toBe(false);
    expect(disparou(zero, sit(1, [{ slug: "d", hp: 0, hp_max: 200 }]))).toBe(true);
    expect(disparou(ev({ tipo: "pv", rodada: null, pct: 100, slugs: ["d"] }), sit(1, [{ slug: "d", hp: 200, hp_max: 200 }]))).toBe(true);
    expect(disparou(zero, sit(1, [{ slug: "outro", hp: 0, hp_max: 10 }]))).toBe(false);
    expect(disparou(zero, sit(1, []))).toBe(false);
  });
  it("PV máximo zero não vira divisão torta", () => {
    expect(disparou(ev({ tipo: "pv", rodada: null, pct: 50, slugs: ["x"] }), sit(1, [{ slug: "x", hp: 0, hp_max: 0 }]))).toBe(false);
  });
});

describe("pendentes", () => {
  it("só os disparados e não feitos; rodada antes de PV, cada grupo na ordem", () => {
    const eventos = [
      ev({ id: "pv", tipo: "pv", rodada: null, pct: 50, slugs: ["d"], created_at: "2026-10-09T09:00:00Z" }),
      ev({ id: "r5", rodada: 5 }),
      ev({ id: "r2", rodada: 2 }),
      ev({ id: "feito", rodada: 1, feito: true }),
      ev({ id: "futuro", rodada: 9 }),
    ];
    const r = pendentes(eventos, sit(5, [{ slug: "d", hp: 3, hp_max: 10 }]));
    expect(r.map((x) => x.id)).toEqual(["r2", "r5", "pv"]);
  });
});

describe("rotuloDoGatilho", () => {
  const nomes: Record<string, string> = { a: "Goblin", b: "Goblin 2", c: "Goblin 3", d: "Dragão" };
  const nomeDe = (s: string) => nomes[s] ?? null;
  it("rodada, PV de um, de vários e de quem sumiu", () => {
    expect(rotuloDoGatilho(ev({ rodada: 3 }), nomeDe)).toBe("Rodada 3");
    expect(rotuloDoGatilho(ev({ tipo: "pv", pct: 50, slugs: ["d"] }), nomeDe)).toBe("50% de PV · Dragão");
    expect(rotuloDoGatilho(ev({ tipo: "pv", pct: 0, slugs: ["a", "b", "c"] }), nomeDe)).toBe("0 PV · Goblin, Goblin 2 +1");
    expect(rotuloDoGatilho(ev({ tipo: "pv", pct: 50, slugs: ["zzz"] }), nomeDe)).toBe("50% de PV · monstro que saiu da sala");
  });
});

describe("eventosParaOCombate", () => {
  const grupos = [grupo("Goblin", 3), grupo("Chefe", 1)];
  const criados = ["g1", "g2", "g3", "c1"].map((slug) => ({ slug }));
  it("troca o grupo pelos slugs criados, na faixa certa", () => {
    const r = eventosParaOCombate(
      [
        { id: "a", tipo: "pv", rodada: null, grupo: 1, pct: 50, texto: "Chefe foge", publico: false },
        { id: "b", tipo: "pv", rodada: null, grupo: 0, pct: 0, texto: "Goblins fogem", publico: true },
        { id: "c", tipo: "rodada", rodada: 3, grupo: null, pct: null, texto: "Teto cai", publico: false },
      ],
      grupos,
      criados,
    );
    expect(r.map((x) => [x.tipo, x.slugs, x.texto])).toEqual([
      ["pv", ["c1"], "Chefe foge"],
      ["pv", ["g1", "g2", "g3"], "Goblins fogem"],
      ["rodada", [], "Teto cai"],
    ]);
  });
  it("descarta aviso de PV de grupo que não existe mais", () => {
    expect(eventosParaOCombate([{ id: "a", tipo: "pv", rodada: null, grupo: 5, pct: 50, texto: "x", publico: false }], grupos, criados)).toEqual([]);
  });
  it("respeita o limite de quantidade do grupo (a faixa usa a mesma conta de npcsDoEncontro)", () => {
    const gigante = [grupo("Rato", 9999), grupo("Rei", 1)];
    const muitos = Array.from({ length: 100 }, (_, i) => ({ slug: `s${i}` }));
    const r = eventosParaOCombate([{ id: "a", tipo: "pv", rodada: null, grupo: 0, pct: 0, texto: "x", publico: false }], gigante, muitos);
    expect(r[0].slugs.length).toBeGreaterThan(0);
    expect(r[0].slugs.length).toBeLessThanOrEqual(40);
  });
});

describe("normalizar", () => {
  it("evento do banco torto vira valor seguro", () => {
    const e = normalizarEvento({ id: "x", tipo: "pv", pct: "999", slugs: ["a", 5, null], texto: "  oi   mundo  ", publico: "sim" });
    expect(e).toMatchObject({ tipo: "pv", pct: 100, slugs: ["a"], texto: "oi mundo", publico: false, feito: false, rodada: null });
    expect(normalizarEvento(null).id).toBe("");
  });
  it("preparados: descarta sem id ou sem texto e limita rodada e porcentagem", () => {
    const r = normalizarPreparados([
      { id: "a", tipo: "rodada", rodada: 500, texto: "ok" },
      { id: "", tipo: "rodada", rodada: 1, texto: "sem id" },
      { id: "b", tipo: "pv", grupo: 2, pct: -5, texto: "pv" },
      { id: "c", tipo: "rodada", rodada: 1, texto: "   " },
    ]);
    expect(r.map((x) => [x.id, x.rodada, x.grupo, x.pct])).toEqual([["a", 99, null, null], ["b", null, 2, 0]]);
    expect(normalizarPreparados("lixo")).toEqual([]);
  });
});

describe("validarNovoEvento / log", () => {
  it("exige texto e número do gatilho", () => {
    expect(validarNovoEvento({ tipo: "rodada", rodada: "3", pct: "", texto: " Teto cai " })).toEqual({ ok: true, rodada: 3, pct: null, texto: "Teto cai" });
    expect(validarNovoEvento({ tipo: "pv", rodada: "", pct: "0", texto: "Morreu" })).toEqual({ ok: true, rodada: null, pct: 0, texto: "Morreu" });
    for (const ruim of [
      { tipo: "rodada" as const, rodada: "", pct: "", texto: "x" },
      { tipo: "pv" as const, rodada: "", pct: "", texto: "x" },
      { tipo: "rodada" as const, rodada: "2", pct: "", texto: "  " },
    ]) expect(validarNovoEvento(ruim).ok).toBe(false);
  });
  it("a linha pública leva só o texto", () => {
    expect(linhaPublicaDoEvento("  O teto  desaba ")).toBe("📜 O teto desaba");
  });
});

describe("eventosAoTirarGrupo", () => {
  it("tira o aviso do grupo removido e reaponta os seguintes", () => {
    const base = { rodada: null, texto: "x", publico: false } as const;
    const r = eventosAoTirarGrupo(
      [
        { id: "a", tipo: "pv", grupo: 0, pct: 50, ...base },
        { id: "b", tipo: "pv", grupo: 1, pct: 50, ...base },
        { id: "c", tipo: "pv", grupo: 2, pct: 0, ...base },
        { id: "d", tipo: "rodada", grupo: null, pct: null, rodada: 2, texto: "r", publico: false },
      ],
      1,
    );
    expect(r.map((e) => [e.id, e.grupo])).toEqual([["a", 0], ["c", 1], ["d", null]]);
  });
});

describe("aviso de teste de concentração", () => {
  const vida = (hp: number, extra: Partial<{ hp_temp: number; concentration: boolean; concentration_on: string }> = {}) => ({
    hp,
    hp_temp: 0,
    concentration: true,
    concentration_on: "Bênção",
    ...extra,
  });

  it("quem concentra e perde PV recebe a CD (10 ou metade do dano) e o texto com o feitiço", () => {
    expect(testeDeConcentracao(vida(20), vida(17))).toEqual({ cd: 10, texto: "Teste de Constituição, CD 10 · concentrado em Bênção · 3 de dano" });
    expect(testeDeConcentracao(vida(40), vida(10))?.cd).toBe(15);
    expect(testeDeConcentracao(vida(200), vida(1))?.cd).toBe(30);
  });

  it("PV temporário absorvendo tudo ainda é dano", () => {
    expect(testeDeConcentracao(vida(20, { hp_temp: 5 }), vida(20, { hp_temp: 0 }))?.cd).toBe(10);
  });

  it("sem teste: cura, mesmo PV, não concentrava, ou largou a concentração (0 PV, condição)", () => {
    expect(testeDeConcentracao(vida(10), vida(15))).toBeNull();
    expect(testeDeConcentracao(vida(10), vida(10))).toBeNull();
    expect(testeDeConcentracao(vida(10, { concentration: false }), vida(5, { concentration: false }))).toBeNull();
    expect(testeDeConcentracao(vida(10), vida(0, { concentration: false }))).toBeNull();
  });

  it("sem nome do feitiço o texto não inventa nada", () => {
    expect(testeDeConcentracao(vida(10, { concentration_on: "" }), vida(8, { concentration_on: "" }))?.texto).toBe("Teste de Constituição, CD 10 · 2 de dano");
  });

  it("o aviso aparece enquanto a pessoa concentra, com ou sem combate, e some quando ela larga", () => {
    const e = ev({ tipo: "concentracao", rodada: null, slugs: ["ana"], texto: "Teste" });
    const com = { ...sit(1, [], false), concentrando: ["ana"] };
    expect(disparou(e, com)).toBe(true);
    expect(pendentes([e], com)).toHaveLength(1);
    expect(pendentes([e], { ...com, concentrando: [] })).toHaveLength(0);
    expect(pendentes([e], sit(1, [], false))).toHaveLength(0);
  });

  it("vem antes dos avisos de rodada e de PV, e o rótulo leva o nome", () => {
    const c = ev({ id: "c", tipo: "concentracao", rodada: null, slugs: ["ana"], created_at: "2026-10-09T12:00:00Z" });
    const r = ev({ id: "r", tipo: "rodada", rodada: 1 });
    const s = { ...sit(2), concentrando: ["ana"] };
    expect(pendentes([r, c], s).map((x) => x.id)).toEqual(["c", "r"]);
    expect(rotuloDoGatilho(c, (slug) => (slug === "ana" ? "Ana" : null))).toBe("Concentração · Ana");
  });

  it("normaliza o tipo novo sem rodada nem porcentagem", () => {
    const n = normalizarEvento({ id: "x", tipo: "concentracao", slugs: ["ana"], texto: "t" });
    expect([n.tipo, n.rodada, n.pct]).toEqual(["concentracao", null, null]);
  });
});
