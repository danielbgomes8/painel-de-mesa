// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BancoFalso } from "./bancoFalsoParaTeste";

/**
 * O `usePecas` de verdade contra o banco falso, com o aviso de tempo real ATRASADO (a rede lenta): o jogador arrasta
 * o peão duas vezes seguidas e o eco do primeiro movimento chega depois do segundo. O peão não pode voltar pro lugar
 * velho (era o que deixava a tela mostrando o peão onde ele não está, e o arrasto seguinte pegava o vazio).
 */

const banco = vi.hoisted(() => ({ atual: null as unknown as { cliente: unknown } }));
vi.mock("@/lib/supabase", () => ({
  supabaseConfigurado: true,
  get supabase() {
    return banco.atual.cliente;
  },
}));

const { usePecas } = await import("./usePecas");

const SALA = "teste";
const CENA = "cena-1";
let bd: BancoFalso;

beforeEach(() => {
  bd = new BancoFalso();
  banco.atual = bd;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function abrir() {
  const peao = bd.semear("cena_pecas", [{ cena_id: CENA, room_code: SALA, slug: "jogador", nome: "Jogador", x: 375, y: 315 }])[0] as { id: string };
  const r = renderHook(() => usePecas(CENA, SALA));
  await waitFor(() => expect(r.result.current.carregando).toBe(false));
  // O canal assina um instante depois da primeira leitura.
  await act(async () => {
    await new Promise((ok) => setTimeout(ok, 20));
  });
  return { ...r, id: peao.id };
}

const noBanco = () => [bd.linhas("cena_pecas")[0].x, bd.linhas("cena_pecas")[0].y];
const naTela = (r: { current: { pecas: { x: number; y: number }[] } }) => [r.current.pecas[0].x, r.current.pecas[0].y];

async function mover(r: { current: { atualizar: (id: string, m: { x: number; y: number }) => Promise<boolean> } }, id: string, x: number, y: number) {
  await act(async () => {
    await r.current.atualizar(id, { x, y });
  });
}

describe("usePecas: arrastos seguidos com o eco atrasado", () => {
  it("o eco do primeiro movimento, chegando depois do segundo, não devolve o peão ao lugar velho", async () => {
    const { result, id } = await abrir();
    bd.reterEcos();

    await mover(result, id, 435, 315);
    await mover(result, id, 435, 105);
    expect(naTela(result)).toEqual([435, 105]);

    // O eco do PRIMEIRO movimento (435, 315) chega agora, depois de a tela já ter ido a (435, 105).
    await act(async () => {
      bd.soltarEcos(1);
      await new Promise((ok) => setTimeout(ok, 10));
    });
    expect(naTela(result)).toEqual([435, 105]);

    await act(async () => {
      bd.soltarEcos();
      await new Promise((ok) => setTimeout(ok, 10));
    });
    expect(noBanco()).toEqual([435, 105]);
    expect(naTela(result)).toEqual([435, 105]);
  });

  it("o que OUTRO aparelho moveu durante a janela não se perde: a releitura do fim traz de volta", async () => {
    const { result, id } = await abrir();
    await mover(result, id, 435, 315); // a janela abre
    await act(async () => {
      bd.comoOutroAparelho("cena_pecas", (l) => l.id === id, { x: 105, y: 105 });
      await new Promise((ok) => setTimeout(ok, 30));
    });
    expect(naTela(result)).toEqual([435, 315]);
    await waitFor(() => expect(naTela(result)).toEqual([105, 105]), { timeout: 5000 });
  });

  it("com a rede rápida (o eco chega antes do arrasto seguinte), o peão segue como sempre (controle)", async () => {
    const { result, id } = await abrir();
    await mover(result, id, 435, 315);
    await act(async () => {
      await new Promise((ok) => setTimeout(ok, 20));
    });
    await mover(result, id, 435, 105);
    await act(async () => {
      await new Promise((ok) => setTimeout(ok, 20));
    });
    expect(noBanco()).toEqual([435, 105]);
    expect(naTela(result)).toEqual([435, 105]);
  });
});
