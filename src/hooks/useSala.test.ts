// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BancoFalso } from "./bancoFalsoParaTeste";
import { mudancaDe } from "@/lib/desfazer";
import type { Peca } from "@/lib/pecas";
import type { ItemIniciativa } from "@/lib/tipos";

/**
 * O `useSala` de verdade (o hook inteiro, não pedaços dele) contra um banco
 * falso em memória (bancoFalsoParaTeste.ts). Cobre o que o robô de tela não
 * alcança: corridas entre aparelhos (o aviso de tempo real que ainda não
 * chegou), a fila de quando a internet cai e o desfazer que não pode atropelar
 * ninguém. As regras puras de cada coisa já têm teste próprio em src/lib; aqui
 * é a costura delas com o banco.
 */

const banco = vi.hoisted(() => ({ atual: null as unknown as { cliente: unknown } }));
vi.mock("@/lib/supabase", () => ({
  supabaseConfigurado: true,
  get supabase() {
    return banco.atual.cliente;
  },
}));

// Importa depois do mock (o vi.mock sobe pro topo, mas deixa explícito).
const { useSala } = await import("./useSala");

const SALA = "teste";
let bd: BancoFalso;
let errosNoConsole: unknown[][];

beforeEach(() => {
  bd = new BancoFalso();
  banco.atual = bd;
  errosNoConsole = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errosNoConsole.push(args);
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

async function abrir() {
  const r = renderHook(() => useSala(SALA));
  await waitFor(() => expect(r.result.current.carregando).toBe(false));
  await waitFor(() => expect(r.result.current.conectado).toBe(true));
  return r;
}

function ficha(slug: string, nome: string, extra: Record<string, unknown> = {}) {
  return bd.semear("characters", [{ room_code: SALA, slug, name: nome, ...extra }])[0] as { id: string; slug: string };
}

const daSala = (l: Record<string, unknown>) => l.room_code === SALA;
const ordemNoBanco = () => (bd.linhas("combat_state")[0].order_json as ItemIniciativa[]).map((o) => o.slug);

describe("useSala: abrir a sala", () => {
  it("garante as linhas da sala e lê as fichas do banco", async () => {
    ficha("tiberio", "Tibério Vaz");
    const { result } = await abrir();
    expect(result.current.erro).toBeNull();
    expect(result.current.personagens.map((p) => p.name)).toEqual(["Tibério Vaz"]);
    expect(bd.linhas("rooms")).toEqual([expect.objectContaining({ code: SALA })]);
    expect(bd.linhas("combat_state")[0]).toMatchObject({ room_code: SALA, version: 0 });
    expect(errosNoConsole).toEqual([]);
  });

  it("o que outro aparelho grava chega na tela pelo tempo real", async () => {
    const t = ficha("tiberio", "Tibério Vaz", { hp: 20 });
    const { result } = await abrir();
    bd.comoOutroAparelho("characters", (l) => l.id === t.id, { hp: 11 });
    await waitFor(() => expect(result.current.personagens[0].hp).toBe(11));
  });
});

describe("useSala: escrever sem atropelar outro celular", () => {
  it("dano manda só as colunas que mudaram: a nota que outro celular acabou de gravar fica", async () => {
    const t = ficha("tiberio", "Tibério Vaz", { hp: 20, hp_max: 20 });
    const { result } = await abrir();
    // Outro celular grava uma nota e o aviso ainda não chegou neste.
    bd.comoOutroAparelho("characters", (l) => l.id === t.id, { notes: "devendo 3 po" }, { avisar: false });
    await act(() => result.current.atualizarVariosPersonagens([{ id: t.id, patch: { hp: 15 } }]));
    expect(bd.linhas("characters")[0]).toMatchObject({ hp: 15, notes: "devendo 3 po" });
    const enviados = bd.pedidos.filter((p) => p.tabela === "characters" && p.op === "update").map((p) => p.carga);
    expect(enviados).toEqual([{ hp: 15 }]);
  });

  it("ordem de iniciativa: se outro aparelho gravou no meio, refaz a conta em cima da ordem nova (ninguém some)", async () => {
    const { result } = await abrir();
    const goblin = { slug: "goblin", name: "Goblin", init: 12 };
    const tiberio = { slug: "tiberio", name: "Tibério Vaz", init: 15 };
    // O Mestre, de outro aparelho, põe o goblin — e o aviso não chegou aqui.
    bd.comoOutroAparelho("combat_state", daSala, { order_json: [goblin], version: 1 }, { avisar: false });
    await act(async () => {
      await result.current.definirCombate((atual) => ({ order: [...atual.order, tiberio] }));
    });
    expect(ordemNoBanco()).toEqual(["goblin", "tiberio"]);
    expect(bd.linhas("combat_state")[0].version).toBe(2);
    expect(result.current.combate.order.map((o) => o.slug)).toEqual(["goblin", "tiberio"]);
  });
});

describe("useSala: desfazer", () => {
  it("volta o dano quando nada mudou depois", async () => {
    ficha("tiberio", "Tibério Vaz", { hp: 20, hp_max: 20 });
    const { result } = await abrir();
    const p = result.current.personagens[0];
    await act(async () => {
      await result.current.atualizarVariosPersonagens([{ id: p.id, patch: { hp: 12 } }]);
      result.current.lembrarDesfazer({ rotulo: "Tibério sofreu 8", textoLog: null, personagens: [mudancaDe(p, { hp: 12 })], combate: null, criados: [] });
    });
    await waitFor(() => expect(result.current.personagens[0].hp).toBe(12));
    let r: Awaited<ReturnType<typeof result.current.desfazer>> | undefined;
    await act(async () => {
      r = await result.current.desfazer();
    });
    expect(r).toEqual({ ok: true, rotulo: "Tibério sofreu 8" });
    expect(bd.linhas("characters")[0].hp).toBe(20);
  });

  it("não atropela outro aparelho: se a ordem mudou depois, recusa e não mexe no banco", async () => {
    const { result } = await abrir();
    await act(async () => {
      const feito = await result.current.definirCombate({ order: [{ slug: "tiberio", name: "Tibério Vaz", init: 15 }] });
      result.current.lembrarDesfazer({ rotulo: "Tibério entrou", textoLog: null, personagens: [], combate: feito, criados: [] });
    });
    // Outro aparelho vira a rodada, e o aviso chega aqui.
    const versao = bd.linhas("combat_state")[0].version as number;
    bd.comoOutroAparelho("combat_state", daSala, { round: 2, version: versao + 1 });
    await waitFor(() => expect(result.current.combate.round).toBe(2));
    let r: Awaited<ReturnType<typeof result.current.desfazer>> | undefined;
    await act(async () => {
      r = await result.current.desfazer();
    });
    expect(r).toEqual({ ok: false, motivo: "a ordem de iniciativa mudou depois disso" });
    expect(bd.linhas("combat_state")[0]).toMatchObject({ round: 2 });
    expect(ordemNoBanco()).toEqual(["tiberio"]);
  });

  it("devolve o peão que saiu do mapa junto com o inimigo, no mesmo lugar", async () => {
    const goblin = { slug: "goblin", name: "Goblin", init: 12 };
    bd.semear("combat_state", [{ room_code: SALA, order_json: [goblin], version: 3 }]);
    const peca: Peca = { id: "p1", cena_id: "c1", room_code: SALA, slug: "goblin", nome: "", x: 150, y: 250, tamanho: 1, cor: null, oculto: true, aura: null, created_at: "2026-10-01T20:00:00Z" };
    const { result } = await abrir();
    await act(async () => {
      const feito = await result.current.definirCombate({ order: [] });
      result.current.lembrarDesfazer({ rotulo: "Goblin saiu", textoLog: null, personagens: [], combate: feito, criados: [], pecas: { criadas: [], tiradas: [peca] } });
    });
    await act(async () => {
      await result.current.desfazer();
    });
    expect(ordemNoBanco()).toEqual(["goblin"]);
    expect(bd.linhas("cena_pecas")).toEqual([expect.objectContaining({ id: "p1", x: 150, y: 250, oculto: true })]);
  });
});

describe("useSala: sem internet", () => {
  it("o dano fica na tela e na fila, e vai pro banco quando a conexão volta", async () => {
    const t = ficha("tiberio", "Tibério Vaz", { hp: 20, hp_max: 20 });
    const { result } = await abrir();
    bd.semRede = true;
    await act(() => result.current.atualizarPersonagem(t.id, { hp: 7 }));
    expect(result.current.semInternet).toBe(true);
    expect(result.current.esperando).toBe(1);
    expect(result.current.personagens[0].hp).toBe(7);
    expect(bd.linhas("characters")[0].hp).toBe(20);

    bd.semRede = false;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(result.current.semInternet).toBe(false));
    expect(bd.linhas("characters")[0].hp).toBe(7);
    expect(result.current.esperando).toBe(0);
    expect(result.current.avisoFalha).toBeNull();
  });

  it("se outro aparelho mexeu na mesma ficha nesse meio-tempo, não atropela e avisa o que ficou de fora", async () => {
    const t = ficha("tiberio", "Tibério Vaz", { hp: 20, hp_max: 20 });
    const { result } = await abrir();
    bd.semRede = true;
    await act(() => result.current.atualizarPersonagem(t.id, { hp: 7 }));
    // Enquanto este estava sem internet, o Mestre curou o Tibério de outro celular.
    bd.comoOutroAparelho("characters", (l) => l.id === t.id, { hp: 18 }, { avisar: false });
    bd.semRede = false;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(result.current.avisoFalha).toContain("Tibério Vaz"));
    expect(bd.linhas("characters")[0].hp).toBe(18);
    await waitFor(() => expect(result.current.personagens[0].hp).toBe(18));
  });
});

describe("useSala: sem internet (texto)", () => {
  it("nota escrita sem internet não apaga a que outro aparelho gravou no meio-tempo (texto não tem a trava do próprio UPDATE)", async () => {
    const t = ficha("tiberio", "Tibério Vaz", { notes: "" });
    const { result } = await abrir();
    bd.semRede = true;
    await act(() => result.current.atualizarPersonagem(t.id, { notes: "a do celular" }));
    bd.comoOutroAparelho("characters", (l) => l.id === t.id, { notes: "a do Mestre" }, { avisar: false });
    bd.semRede = false;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(result.current.avisoFalha).toContain("Tibério Vaz"));
    expect(bd.linhas("characters")[0].notes).toBe("a do Mestre");
  });
});

describe("useSala: ficha apagada", () => {
  it("tira a ficha da ordem e o peão dela de todos os mapas (marcador avulso fica)", async () => {
    const g = ficha("goblin", "Goblin", { is_npc: true });
    bd.semear("combat_state", [{ room_code: SALA, order_json: [{ slug: "goblin", name: "Goblin", init: 12 }], version: 1 }]);
    bd.semear("cena_pecas", [
      { cena_id: "c1", room_code: SALA, slug: "goblin", nome: "", x: 1, y: 1, tamanho: 1, oculto: false },
      { cena_id: "c2", room_code: SALA, slug: "goblin", nome: "", x: 2, y: 2, tamanho: 1, oculto: true },
      { cena_id: "c1", room_code: SALA, slug: null, nome: "Baú", x: 3, y: 3, tamanho: 1, oculto: false },
    ]);
    const { result } = await abrir();
    await act(() => result.current.removerPersonagem(g.id));
    await waitFor(() => expect(bd.linhas("cena_pecas").map((p) => p.nome)).toEqual(["Baú"]));
    expect(bd.linhas("characters")).toEqual([]);
    expect(ordemNoBanco()).toEqual([]);
  });
});
