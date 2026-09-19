import { describe, expect, it } from "vitest";
import {
  combateSemConflito,
  conflitosDePersonagens,
  ehFalhaDeRede,
  ehLinhaProvisoria,
  enfileirar,
  horaCurta,
  lerFilaGuardada,
  lerFotoGuardada,
  linhasProvisorias,
  mudancasEsperando,
  type OpOffline,
} from "./offline";
import { mudancaDe } from "./desfazer";
import { ajustePVComLog } from "./regras";
import type { EstadoCombate, Personagem } from "./tipos";

const goblin = {
  id: "g1",
  name: "Goblin",
  is_npc: true,
  revealed: false,
  hp: 7,
  hp_max: 7,
  hp_temp: 0,
  dss: 0,
  dsf: 0,
  concentration: false,
  concentration_on: "",
  cond: {},
  cond_prazo: {},
} as unknown as Personagem;

const combate: EstadoCombate = { round: 1, turn: 0, order: [{ slug: "goblin", name: "Goblin", init: 12 }] };

describe("sem internet: o que é queda de rede", () => {
  it("erro sem código (fetch que não saiu) é queda de rede", () => {
    expect(ehFalhaDeRede({ message: "TypeError: Failed to fetch", code: "" })).toBe(true);
    expect(ehFalhaDeRede({ message: "FetchError: Load failed", code: "" })).toBe(true);
  });

  it("recusa do banco (com código) não é — continua falhando como antes", () => {
    expect(ehFalhaDeRede({ message: "duplicate key", code: "23505" })).toBe(false);
    expect(ehFalhaDeRede({ message: "JWT expired", code: "PGRST301" })).toBe(false);
    expect(ehFalhaDeRede(null)).toBe(false);
  });
});

describe("sem internet: a fila", () => {
  it("linha de log fica amarrada à escrita que veio logo antes", () => {
    let fila: OpOffline[] = [];
    fila = enfileirar(fila, { tipo: "log", textos: ["a"], quando: "t" }, "l0", 1);
    fila = enfileirar(fila, { tipo: "personagens", mudancas: [] }, "p1", 2);
    fila = enfileirar(fila, { tipo: "log", textos: ["b"], quando: "t" }, "l1", 3);
    fila = enfileirar(fila, { tipo: "log", textos: ["c"], quando: "t" }, "l2", 4);
    fila = enfileirar(fila, { tipo: "combate", antes: combate, depois: combate }, "c1", 5);
    fila = enfileirar(fila, { tipo: "log", textos: ["d"], quando: "t" }, "l3", 6);
    const dep = Object.fromEntries(fila.filter((o) => o.tipo === "log").map((o) => [o.id, o.tipo === "log" && o.dependeDe]));
    expect(dep).toEqual({ l0: null, l1: "p1", l2: "p1", l3: "c1" });
  });

  it("wi-fi pendurado: escrita que falha depois entra na posição de quando foi feita", () => {
    let fila: OpOffline[] = [];
    // O segundo dano (seq 2) falhou antes do primeiro (seq 1) voltar.
    fila = enfileirar(fila, { tipo: "personagens", mudancas: [] }, "dano2", 2);
    fila = enfileirar(fila, { tipo: "personagens", mudancas: [] }, "dano1", 1);
    fila = enfileirar(fila, { tipo: "log", textos: ["linha do dano 1"], quando: "t" }, "log1", 3);
    expect(fila.map((o) => o.id)).toEqual(["dano1", "dano2", "log1"]);
  });

  it("o contador do topo conta mudanças, não linhas de log", () => {
    let fila: OpOffline[] = [];
    fila = enfileirar(fila, { tipo: "personagens", mudancas: [] }, "p1", 1);
    fila = enfileirar(fila, { tipo: "log", textos: ["x", "y"], quando: "t" }, "l1", 2);
    fila = enfileirar(fila, { tipo: "combate", antes: combate, depois: combate }, "c1", 3);
    expect(mudancasEsperando(fila)).toBe(2);
  });

  it("linhas ainda na fila aparecem como provisórias, a mais nova primeiro", () => {
    let fila: OpOffline[] = [];
    fila = enfileirar(fila, { tipo: "log", textos: ["primeira", "segunda"], quando: "2026-09-19T15:00:00Z" }, "l1", 1);
    fila = enfileirar(fila, { tipo: "log", textos: ["terceira"], quando: "2026-09-19T15:01:00Z" }, "l2", 2);
    const linhas = linhasProvisorias(fila);
    expect(linhas.map((l) => l.text)).toEqual(["terceira", "segunda", "primeira"]);
    expect(linhas.every((l) => ehLinhaProvisoria(l.id))).toBe(true);
    expect(ehLinhaProvisoria("3f2a-uuid-do-banco")).toBe(false);
  });
});

describe("sem internet: na volta, só grava o que não mudou em outro aparelho", () => {
  const dano = mudancaDe(goblin, ajustePVComLog(goblin, -5).patch);

  it("ficha do jeito que a mudança encontrou: grava", () => {
    expect(conflitosDePersonagens([dano], [goblin])).toEqual([]);
  });

  it("outro celular mexeu no PV no meio tempo: não grava e diz quem", () => {
    expect(conflitosDePersonagens([dano], [{ ...goblin, hp: 3 }])).toEqual(["Goblin"]);
  });

  it("ficha apagada no meio tempo também é conflito", () => {
    expect(conflitosDePersonagens([dano], [])).toEqual(["Goblin"]);
  });

  it("duas mudanças seguidas na mesma ficha encadeiam: a segunda parte de onde a primeira deixou", () => {
    const depoisDoPrimeiro = { ...goblin, ...dano.depois } as Personagem;
    const segundo = mudancaDe(depoisDoPrimeiro, ajustePVComLog(depoisDoPrimeiro, -1).patch);
    expect(conflitosDePersonagens([segundo], [depoisDoPrimeiro])).toEqual([]);
    expect(conflitosDePersonagens([segundo], [goblin])).toEqual(["Goblin"]);
  });

  it("ordem de iniciativa: só grava se ninguém passou o turno no meio tempo", () => {
    const depois = { ...combate, turn: 1 };
    expect(combateSemConflito({ antes: combate }, combate)).toBe(true);
    expect(combateSemConflito({ antes: combate }, depois)).toBe(false);
  });
});

describe("sem internet: o que fica guardado no aparelho", () => {
  it("fila com formato estranho vira fila vazia; op quebrada é descartada", () => {
    expect(lerFilaGuardada(null)).toEqual([]);
    expect(lerFilaGuardada("{lixo")).toEqual([]);
    const boa: OpOffline = { id: "l1", seq: 1, tipo: "log", textos: ["a"], dependeDe: null, quando: "t" };
    expect(lerFilaGuardada(JSON.stringify([boa, { id: "x", tipo: "log" }, { tipo: "combate" }]))).toEqual([boa]);
  });

  it("foto da sala: precisa de hora, personagens e ordem", () => {
    expect(lerFotoGuardada(null)).toBeNull();
    expect(lerFotoGuardada(JSON.stringify({ quando: "t", personagens: [] }))).toBeNull();
    const foto = lerFotoGuardada(JSON.stringify({ quando: "t", personagens: [goblin], combate, combateVersao: "4" }));
    expect(foto?.personagens).toHaveLength(1);
    expect(foto?.combateVersao).toBe(4);
  });

  it("hora curta da foto", () => {
    const d = new Date(2026, 8, 19, 9, 5);
    expect(horaCurta(d.toISOString())).toBe("09:05");
    expect(horaCurta("lixo")).toBe("");
  });
});
