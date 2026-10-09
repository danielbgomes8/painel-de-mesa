import { describe, expect, it } from "vitest";
import {
  acabou,
  efeitosQueAcabaram,
  efeitoVisivel,
  linhaDoEfeito,
  normalizarEfeito,
  textoRestante,
  validarNovoEfeito,
  type EfeitoDoCombate,
} from "./efeitosCombate";

const ordem = [{ slug: "ana" }, { slug: "bruno" }, { slug: "goblin" }];
const efeito = (p: Partial<EfeitoDoCombate> = {}): EfeitoDoCombate => ({
  id: "1",
  room_code: "t",
  nome: "Bênção",
  alvo_slug: "ana",
  lancador_slug: "bruno",
  termina_rodada: 5,
  created_at: "2026-01-01T00:00:00Z",
  ...p,
});

describe("acabou", () => {
  it("antes da rodada final não acabou", () => {
    expect(acabou(efeito(), { round: 4, turn: 2, order: ordem })).toBe(false);
  });
  it("na rodada final, só quando chega o turno de quem lançou", () => {
    expect(acabou(efeito(), { round: 5, turn: 0, order: ordem })).toBe(false);
    expect(acabou(efeito(), { round: 5, turn: 1, order: ordem })).toBe(true);
    expect(acabou(efeito(), { round: 5, turn: 2, order: ordem })).toBe(true);
  });
  it("depois da rodada final acabou, mesmo se o lançador saiu da ordem", () => {
    expect(acabou(efeito(), { round: 6, turn: 0, order: ordem })).toBe(true);
    expect(acabou(efeito({ lancador_slug: "sumiu" }), { round: 5, turn: 0, order: ordem })).toBe(true);
  });
  it("sem lançador acaba no início da rodada final", () => {
    expect(acabou(efeito({ lancador_slug: null }), { round: 5, turn: 0, order: ordem })).toBe(true);
    expect(acabou(efeito({ lancador_slug: null }), { round: 4, turn: 2, order: ordem })).toBe(false);
  });
  it("sem combate nada acaba", () => {
    expect(acabou(efeito(), { round: 9, turn: 0, order: [] })).toBe(false);
  });
});

describe("validarNovoEfeito", () => {
  const base = { nome: "  Bênção ", duracao: "10", alvo_slug: "ana", lancador_slug: "ana" };
  it("soma a duração à rodada de agora", () => {
    const r = validarNovoEfeito(base, 3);
    expect(r.ok && r.efeito.termina_rodada).toBe(13);
    expect(r.ok && r.efeito.nome).toBe("Bênção");
  });
  it("recusa nome vazio, duração torta e sem alvo", () => {
    expect(validarNovoEfeito({ ...base, nome: " " }, 1).ok).toBe(false);
    expect(validarNovoEfeito({ ...base, duracao: "" }, 1).ok).toBe(false);
    expect(validarNovoEfeito({ ...base, duracao: "abc" }, 1).ok).toBe(false);
    expect(validarNovoEfeito({ ...base, alvo_slug: "" }, 1).ok).toBe(false);
  });
  it("limita a duração a 1 hora", () => {
    const r = validarNovoEfeito({ ...base, duracao: "99999" }, 1);
    expect(r.ok && r.efeito.termina_rodada).toBe(601);
  });
});

describe("textoRestante e fila de avisos", () => {
  it("conta as rodadas que faltam", () => {
    expect(textoRestante(efeito(), 2)).toBe("3 rod.");
    expect(textoRestante(efeito(), 4)).toBe("1 rod.");
    expect(textoRestante(efeito(), 5)).toBe("acaba nesta rodada");
  });
  it("lista só os que acabaram, do mais antigo ao mais novo", () => {
    const a = efeito({ id: "a", created_at: "2026-01-01T00:00:02Z", termina_rodada: 2 });
    const b = efeito({ id: "b", created_at: "2026-01-01T00:00:01Z", termina_rodada: 2 });
    const c = efeito({ id: "c", termina_rodada: 9 });
    expect(efeitosQueAcabaram([a, b, c], { round: 3, turn: 0, order: ordem }).map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("efeitoVisivel (segredo se esconde na tela)", () => {
  it("o Mestre vê tudo", () => {
    expect(efeitoVisivel(true, { is_npc: true, revealed: false })).toBe(true);
  });
  it("jogador não vê efeito de inimigo oculto, vê o de aliado e o de inimigo revelado", () => {
    expect(efeitoVisivel(false, { is_npc: true, revealed: false })).toBe(false);
    expect(efeitoVisivel(false, { is_npc: true, revealed: true })).toBe(true);
    expect(efeitoVisivel(false, { is_npc: false, revealed: false })).toBe(true);
    expect(efeitoVisivel(false, undefined)).toBe(false);
  });
});

describe("normalizarEfeito e log", () => {
  it("transforma lixo em valor seguro", () => {
    const e = normalizarEfeito({ id: 3, nome: 7, termina_rodada: "x", lancador_slug: "" });
    expect(e.id).toBe("");
    expect(e.termina_rodada).toBe(1);
    expect(e.lancador_slug).toBeNull();
  });
  it("linha do log usa o nome já protegido", () => {
    expect(linhaDoEfeito(" Bênção ", "Um inimigo")).toBe("⏳ Bênção em Um inimigo acabou");
  });
});
