import { describe, expect, it } from "vitest";
import {
  ataquesDoTurno,
  combatentesDoGrupo,
  danoMedio,
  dificuldade,
  inimigosDoEncontro,
  porCento,
  simular,
  simularUmaLuta,
  turnoDoTexto,
  type Combatente,
} from "./simulador";
import { lerAtaquesRolaveis, type AtaqueRolavel } from "./regras";
import type { GrupoEncontro } from "./tipos";

/** Gerador pseudoaleatório com semente (mulberry32): a mesma luta sai igual toda vez. */
function dadoComSemente(semente: number): (faces: number) => number {
  let a = semente >>> 0;
  return (faces) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return 1 + Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * faces);
  };
}
/** Dado viciado: sempre tira o maior valor (20 no d20 = crítico, dado cheio). */
const maximo = (faces: number) => faces;

const golpe = (bonus: number | null, qtd: number, faces: number, mod = 0, vezes = 1): AtaqueRolavel => ({
  nome: "Golpe",
  bonus,
  vezes,
  partes: [{ qtd, faces, mod, tipo: "" }],
});
const comb = (id: string, lado: "grupo" | "inimigos", extra: Partial<Combatente> = {}): Combatente => ({
  id, nome: id, lado, ca: 12, hp: 20, init_mod: 0, turno: [golpe(5, 1, 8, 3)], ...extra,
});

describe("ataquesDoTurno", () => {
  it("sem 'N ataques' escolhe o de maior dano médio", () => {
    const l = lerAtaquesRolaveis("Adaga +4, 1d4+2 perfurante · Espada +4, 2d6+3 cortante");
    const t = ataquesDoTurno(l);
    expect(t).toHaveLength(1);
    expect(danoMedio(t[0])).toBe(10);
  });
  it("com 'N ataques:' usa os N primeiros e repete o último se faltar", () => {
    expect(ataquesDoTurno(lerAtaquesRolaveis("2 ataques: Mordida +5, 1d8+3 perfurante · Garra +5, 1d6+3 cortante")).map((a) => a.nome)).toEqual(["Mordida", "Garra"]);
    expect(ataquesDoTurno(lerAtaquesRolaveis("3 ataques: Cimitarra +4, 1d6+2 cortante")).map((a) => a.nome)).toEqual(["Cimitarra", "Cimitarra", "Cimitarra"]);
  });
  it("texto sem ataque legível não faz nada no turno", () => {
    expect(turnoDoTexto("")).toEqual([]);
    expect(turnoDoTexto("fica parado olhando")).toEqual([]);
  });
});

describe("simularUmaLuta (dados viciados)", () => {
  it("20 natural é crítico: acerta e rola os dados em dobro; quem age primeiro mata", () => {
    const heroi = comb("heroi", "grupo", { ca: 30, hp: 50, turno: [golpe(0, 1, 4)] }); // crítico = 2d4 = 8
    const rato = comb("rato", "inimigos", { ca: 30, hp: 8, turno: [golpe(0, 1, 4)] });
    const r = simularUmaLuta([heroi], [rato], maximo);
    // Empate na iniciativa (20 e 20): o grupo vai primeiro (ordem estável) e derruba o rato (8 PV) no primeiro golpe.
    expect(r).toMatchObject({ vencedor: "grupo", rodadas: 1, caidos: [], danoNoGrupo: 0 });
  });
  it("sem ataque de nenhum lado a luta acaba empatada nas 30 rodadas", () => {
    const r = simularUmaLuta([comb("a", "grupo", { turno: [] })], [comb("b", "inimigos", { turno: [] })], maximo);
    expect(r).toMatchObject({ vencedor: "empate", rodadas: 30 });
  });
  it("quem cai a 0 PV fica registrado e deixa de agir", () => {
    const fraco = comb("fraco", "grupo", { hp: 1, ca: 5, init_mod: -10, turno: [golpe(0, 1, 4)] });
    const bicho = comb("bicho", "inimigos", { hp: 100, ca: 30, turno: [golpe(10, 1, 6, 2)] });
    const r = simularUmaLuta([fraco], [bicho], maximo);
    expect(r.vencedor).toBe("inimigos");
    expect(r.caidos).toEqual(["fraco"]);
  });
  it("ataque de salvaguarda (sem bônus) sempre causa dano; vira metade metade das vezes", () => {
    const alvo = comb("alvo", "grupo", { hp: 1000, ca: 99, turno: [] });
    const dragao = comb("dragao", "inimigos", { hp: 1000, ca: 99, turno: [golpe(null, 4, 6)] });
    const r = simular([alvo], [dragao], dadoComSemente(7), 400);
    // 4d6 = 14 de média; metade em metade das vezes => ~10,5 por rodada, nas 30 rodadas.
    const porRodada = (r.pvGasto * 1000) / 30;
    expect(porRodada).toBeGreaterThan(8.5);
    expect(porRodada).toBeLessThan(12.5);
  });
});

describe("simular (sementes fixas)", () => {
  const herois = ["a", "b", "c", "d"].map((id) => comb(id, "grupo", { hp: 30, ca: 15, turno: [golpe(6, 1, 8, 4)] }));
  const goblins = (n: number) => Array.from({ length: n }, (_, i) => comb(`g${i}`, "inimigos", { hp: 7, ca: 13, turno: [golpe(4, 1, 6, 2)] }));

  it("é repetível com a mesma semente", () => {
    expect(simular(herois, goblins(4), dadoComSemente(1), 300)).toEqual(simular(herois, goblins(4), dadoComSemente(1), 300));
  });
  it("as frações fecham: vence + perde + empata = 100%, e perder todos implica alguém cair", () => {
    const r = simular(herois, goblins(6), dadoComSemente(2), 500);
    expect(r.grupoVence + r.grupoPerdeTodos + r.empate).toBeCloseTo(1, 10);
    expect(r.alguemCai).toBeGreaterThanOrEqual(r.grupoPerdeTodos);
    for (const p of r.caiPorPessoa) expect(p.chance).toBeLessThanOrEqual(r.alguemCai);
  });
  it("mais inimigos deixa a luta mais perigosa, e mais PV do grupo, menos", () => {
    const poucos = simular(herois, goblins(3), dadoComSemente(3), 600);
    const muitos = simular(herois, goblins(12), dadoComSemente(3), 600);
    expect(muitos.alguemCai).toBeGreaterThan(poucos.alguemCai);
    expect(muitos.rodadasMedia).toBeGreaterThan(poucos.rodadasMedia);
    const robustos = herois.map((h) => ({ ...h, hp: 90 }));
    expect(simular(robustos, goblins(12), dadoComSemente(3), 600).alguemCai).toBeLessThan(muitos.alguemCai);
  });
  it("CA alta no grupo reduz o dano que ele leva", () => {
    const blindados = herois.map((h) => ({ ...h, ca: 25 }));
    const normal = simular(herois, goblins(8), dadoComSemente(4), 600);
    const blindado = simular(blindados, goblins(8), dadoComSemente(4), 600);
    expect(blindado.pvGasto).toBeLessThan(normal.pvGasto);
  });
  it("um chefe que o grupo mal arranha é mortal", () => {
    const chefe = comb("chefe", "inimigos", { hp: 400, ca: 22, turno: [golpe(12, 3, 10, 6, 3)] });
    const r = simular(herois, [chefe], dadoComSemente(5), 400);
    expect(r.grupoPerdeTodos).toBeGreaterThan(0.5);
    expect(dificuldade(r)).toBe("mortal");
  });
});

describe("inimigosDoEncontro", () => {
  const g = (name: string, quantidade: number, ataque: string): GrupoEncontro => ({ name, cls: "", ac: 13, hp_max: 7, speed: 9, init_mod: 2, ataque, notes: "", quantidade });
  it("um combatente por criatura, numerados quando há mais de uma, na ordem dos grupos", () => {
    const r = inimigosDoEncontro([g("Goblin", 3, "Cimitarra +4, 1d6+2 cortante"), g("Chefe", 1, "")]);
    expect(r.map((c) => c.nome)).toEqual(["Goblin 1", "Goblin 2", "Goblin 3", "Chefe"]);
    expect(r[0]).toMatchObject({ ca: 13, hp: 7, init_mod: 2, lado: "inimigos" });
    expect(r[0].turno).toHaveLength(1);
    expect(r[3].turno).toEqual([]);
  });
  it("quantidade absurda é limitada", () => {
    expect(inimigosDoEncontro([g("Rato", 999, "")]).length).toBeLessThanOrEqual(20);
  });
});

describe("combatentesDoGrupo", () => {
  const base = { hp_temp: 0, init_mod: 1, ataques: [], atributos: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 }, classes: [{ nivel: 3 }] };
  const ficha = (slug: string, extra: Record<string, unknown>) => ({ slug, name: slug, ac: 16, hp: 20, hp_max: 30, is_npc: false, ataque: "Espada: +5, 1d8+3", ...base, ...extra });
  it("usa o PV de agora (com temporário) ou o máximo, deixa de fora quem está a 0 e avisa quem não tem ataque", () => {
    const fichas = [
      ficha("ana", { hp: 12, hp_temp: 5 }),
      ficha("beto", { hp: 0 }),
      ficha("caio", { ataque: "" }),
      ficha("gob", { is_npc: true }),
      ficha("pip", { is_npc: true, dono: "ana" }),
    ];
    const agora = combatentesDoGrupo(fichas, false);
    expect(agora.grupo.map((c) => [c.id, c.hp])).toEqual([["ana", 17], ["caio", 20], ["pip", 20]]);
    expect(agora.deFora).toEqual(["beto"]);
    expect(agora.semAtaque).toEqual(["caio"]);
    expect(combatentesDoGrupo(fichas, true).grupo.map((c) => [c.id, c.hp])).toEqual([["ana", 30], ["beto", 30], ["caio", 30], ["pip", 30]]);
  });
});

describe("dificuldade e porCento", () => {
  it("os cortes", () => {
    expect(dificuldade({ grupoPerdeTodos: 0, alguemCai: 0.1, empate: 0 })).toBe("tranquilo");
    expect(dificuldade({ grupoPerdeTodos: 0, alguemCai: 0.4, empate: 0 })).toBe("medio");
    expect(dificuldade({ grupoPerdeTodos: 0, alguemCai: 0.8, empate: 0 })).toBe("dificil");
    expect(dificuldade({ grupoPerdeTodos: 0.06, alguemCai: 0.5, empate: 0 })).toBe("dificil");
    expect(dificuldade({ grupoPerdeTodos: 0.3, alguemCai: 0.9, empate: 0 })).toBe("mortal");
  });
  it("porCento nunca mostra 0% pra algo que aconteceu", () => {
    expect(porCento(0)).toBe("0%");
    expect(porCento(0.004)).toBe("<1%");
    expect(porCento(0.624)).toBe("62%");
    expect(porCento(0.9995)).toBe(">99%");
    expect(porCento(1)).toBe("100%");
  });
});
