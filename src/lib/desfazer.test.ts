import { describe, expect, it } from "vitest";
import {
  camposConferiveis,
  contarAlvos,
  empilhar,
  lerPilhaGuardada,
  MAX_DESFAZER,
  mesmoValor,
  mudancaDe,
  mudouAlgo,
  podeDesfazer,
  textoDesfeito,
  type AcaoDesfazivel,
} from "./desfazer";
import { ajustePVComLog, condicaoComLog } from "./regras";
import type { EstadoCombate, Personagem } from "./tipos";

const personagem = (extra: Partial<Personagem>): Personagem =>
  ({
    id: "id-goblin",
    room_code: "sala",
    slug: "goblin",
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
    ...extra,
  }) as Personagem;

const combateAntes: EstadoCombate = { round: 1, turn: 0, order: [{ slug: "goblin", name: "Goblin", init: 12 }] };
const combateDepois: EstadoCombate = { ...combateAntes, turn: 1 };

const acao = (extra: Partial<AcaoDesfazivel>): AcaoDesfazivel => ({
  id: "a1",
  rotulo: "teste",
  textoLog: null,
  personagens: [],
  combate: null,
  criados: [],
  ...extra,
});

describe("desfazer: o que guardar", () => {
  it("guarda o valor de antes só dos campos que a ação mexeu", () => {
    const goblin = personagem({});
    const { patch } = ajustePVComLog(goblin, -5);
    const m = mudancaDe(goblin, patch);
    expect(m.antes).toEqual({ hp: 7, hp_temp: 0 });
    expect(m.depois).toEqual({ hp: 2, hp_temp: 0 });
    expect(m.nome).toBe("Goblin");
  });

  it("cura em quem já está cheio não ocupa o botão de desfazer", () => {
    const goblin = personagem({});
    const { patch } = ajustePVComLog(goblin, 3);
    expect(mudouAlgo(acao({ personagens: [mudancaDe(goblin, patch)] }))).toBe(false);
    expect(mudouAlgo(acao({ personagens: [mudancaDe(goblin, ajustePVComLog(goblin, -3).patch)] }))).toBe(true);
  });

  it("criar ficha ou mudar a ordem sempre conta como mudança", () => {
    expect(mudouAlgo(acao({ criados: ["x"] }))).toBe(true);
    expect(mudouAlgo(acao({ combate: { antes: combateAntes, depois: combateDepois } }))).toBe(true);
    expect(mudouAlgo(acao({ combate: { antes: combateAntes, depois: combateAntes } }))).toBe(false);
  });

  it("peão posto ou tirado do mapa junto com a ordem também conta", () => {
    expect(mudouAlgo(acao({ pecas: { criadas: ["p1"], tiradas: [] } }))).toBe(true);
    expect(mudouAlgo(acao({ pecas: { criadas: [], tiradas: [] } }))).toBe(false);
  });

  it("a pilha guarda as mais novas no topo e esquece as mais velhas", () => {
    let pilha: AcaoDesfazivel[] = [];
    for (let i = 0; i < MAX_DESFAZER + 3; i++) pilha = empilhar(pilha, acao({ id: `a${i}` }));
    expect(pilha).toHaveLength(MAX_DESFAZER);
    expect(pilha[0].id).toBe(`a${MAX_DESFAZER + 2}`);
  });
});

describe("desfazer: quando pode", () => {
  const goblin = personagem({});
  const { patch } = ajustePVComLog(goblin, -5);
  const dano = acao({ personagens: [mudancaDe(goblin, patch)] });
  const depoisDoDano = { ...goblin, ...patch };

  it("pode, se nada mudou depois", () => {
    expect(podeDesfazer(dano, [depoisDoDano], combateAntes)).toEqual({ ok: true });
  });

  it("não pode, se alguém mexeu na mesma ficha no meio tempo", () => {
    const outroDano = { ...depoisDoDano, hp: 1 };
    expect(podeDesfazer(dano, [outroDano], combateAntes)).toEqual({
      ok: false,
      motivo: "Goblin mudou depois disso — ajuste na ficha",
    });
  });

  it("mudança em campo que a ação não tocou não atrapalha", () => {
    expect(podeDesfazer(dano, [{ ...depoisDoDano, notes: "fugiu" }], combateAntes).ok).toBe(true);
  });

  it("não pode, se a ficha saiu da sala", () => {
    expect(podeDesfazer(dano, [], combateAntes)).toEqual({ ok: false, motivo: "Goblin não está mais na sala" });
  });

  it("ordem de iniciativa: só volta se ainda for a que a ação deixou", () => {
    const turno = acao({ combate: { antes: combateAntes, depois: combateDepois } });
    expect(podeDesfazer(turno, [], combateDepois).ok).toBe(true);
    expect(podeDesfazer(turno, [], { ...combateDepois, turn: 0, round: 2 })).toEqual({
      ok: false,
      motivo: "a ordem de iniciativa mudou depois disso",
    });
  });

  it("condição: o mapa volta do banco com as chaves em outra ordem e continua igual", () => {
    const comDuas = personagem({ cond: { Envenenado: true } });
    const liga = condicaoComLog(comDuas, "Amedrontado", true);
    const a = acao({ personagens: [mudancaDe(comDuas, liga.patch)] });
    const doBanco = { ...comDuas, cond: { Amedrontado: true, Envenenado: true }, cond_prazo: {} };
    expect(podeDesfazer(a, [doBanco], combateAntes).ok).toBe(true);
    expect(mesmoValor({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });
});

describe("desfazer: o que vai pro log", () => {
  it("uma linha: repete a linha pública que a ação gravou", () => {
    expect(textoDesfeito(["Um inimigo sofreu 5 de dano"], "x")).toBe("↩ Desfeito: Um inimigo sofreu 5 de dano");
  });

  it("várias linhas: o resumo, sem nome nenhum", () => {
    expect(textoDesfeito(["a", "b", "c"], "dano de 5 em 3 alvos")).toBe("↩ Desfeito: dano de 5 em 3 alvos");
  });

  it("ação que não foi pro log não grava nada ao desfazer", () => {
    expect(textoDesfeito([], "x")).toBeNull();
  });

  it("contagem de alvos no singular e no plural", () => {
    expect(contarAlvos(1)).toBe("1 alvo");
    expect(contarAlvos(4)).toBe("4 alvos");
  });
});

describe("desfazer: detalhes de escrita", () => {
  it("só número e verdadeiro/falso entram na conferência do próprio UPDATE", () => {
    expect(camposConferiveis({ hp: 2, hp_temp: 0, concentration: false, concentration_on: "", cond: {} })).toEqual([
      ["hp", 2],
      ["hp_temp", 0],
      ["concentration", false],
    ]);
  });

  it("pilha guardada no navegador: formato estranho vira pilha vazia", () => {
    expect(lerPilhaGuardada(null)).toEqual([]);
    expect(lerPilhaGuardada("lixo{")).toEqual([]);
    expect(lerPilhaGuardada('{"a":1}')).toEqual([]);
    const boa = acao({ id: "ok" });
    expect(lerPilhaGuardada(JSON.stringify([boa, { id: 3 }]))).toEqual([boa]);
    // Com peões: vale; peões tortos descartam a ação; pilha de antes dos peões (sem o campo) continua valendo.
    const comPecas = acao({ id: "p", pecas: { criadas: ["x"], tiradas: [] } });
    expect(lerPilhaGuardada(JSON.stringify([comPecas]))).toEqual([comPecas]);
    expect(lerPilhaGuardada(JSON.stringify([{ ...boa, pecas: { criadas: "x" } }]))).toEqual([]);
    expect(lerPilhaGuardada(JSON.stringify([{ ...boa, pecas: null }]))).toEqual([]);
  });
});
