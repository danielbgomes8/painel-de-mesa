// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BancoFalso } from "./bancoFalsoParaTeste";

/**
 * O `useRelogios` de verdade contra o banco falso, com o aviso de tempo real ATRASADO (a rede lenta): a tela já
 * seguiu em frente quando chega o eco de uma gravação anterior. Os toques seguidos num relógio não podem se perder.
 */

const banco = vi.hoisted(() => ({ atual: null as unknown as { cliente: unknown } }));
vi.mock("@/lib/supabase", () => ({
  supabaseConfigurado: true,
  get supabase() {
    return banco.atual.cliente;
  },
}));

const { useRelogios } = await import("./useRelogios");

const SALA = "teste";
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
  const linha = bd.semear("relogios", [{ room_code: SALA, nome: "Alarme", fatias: 6, cheias: 0, visivel: true, consequencia: "" }])[0] as { id: string };
  const r = renderHook(() => useRelogios(SALA));
  await waitFor(() => expect(r.result.current.carregando).toBe(false));
  // O canal assina um instante depois da primeira leitura.
  await act(async () => {
    await new Promise((ok) => setTimeout(ok, 20));
  });
  return { ...r, id: linha.id };
}

const noBanco = () => bd.linhas("relogios")[0].cheias;
const naTela = (r: { current: { relogios: { cheias: number }[] } }) => r.current.relogios[0].cheias;

async function tocar(r: { current: { mexer: (id: string, d: number) => Promise<unknown> } }, id: string, delta = 1) {
  await act(async () => {
    await r.current.mexer(id, delta);
  });
}

describe("useRelogios: toques seguidos com o eco atrasado", () => {
  it("três toques seguidos dão três fatias, mesmo com o eco do primeiro chegando no meio", async () => {
    const { result, id } = await abrir();
    bd.reterEcos();

    await tocar(result, id); // 0 -> 1
    await tocar(result, id); // 1 -> 2
    expect(naTela(result)).toBe(2);

    // O eco do PRIMEIRO toque (cheias = 1) chega agora, depois de a tela já ter ido a 2.
    await act(async () => {
      bd.soltarEcos(1);
      await new Promise((ok) => setTimeout(ok, 10));
    });

    await tocar(result, id); // o terceiro toque
    expect(noBanco()).toBe(3);

    await act(async () => {
      bd.soltarEcos();
      await new Promise((ok) => setTimeout(ok, 10));
    });
    expect(noBanco()).toBe(3);
    expect(naTela(result)).toBe(3);
  });

  it("o eco atrasado não faz a tela voltar atrás nem por um instante", async () => {
    const { result, id } = await abrir();
    bd.reterEcos();

    await tocar(result, id);
    await tocar(result, id);
    expect(naTela(result)).toBe(2);

    await act(async () => {
      bd.soltarEcos(1);
      await new Promise((ok) => setTimeout(ok, 10));
    });
    expect(naTela(result)).toBe(2);
  });

  it("o que OUTRO aparelho mudou durante a janela não se perde: a releitura do fim traz de volta", async () => {
    const { result, id } = await abrir();
    await tocar(result, id); // 0 -> 1, e a janela abre
    // Outro aparelho enche o relógio logo em seguida; o aviso dele cai dentro da janela e é deixado de lado.
    await act(async () => {
      bd.comoOutroAparelho("relogios", (l) => l.id === id, { cheias: 5 });
      await new Promise((ok) => setTimeout(ok, 30));
    });
    expect(naTela(result)).toBe(1);
    // Passada a janela, a tabela é relida uma vez e a tela alcança o banco.
    await waitFor(() => expect(naTela(result)).toBe(5), { timeout: 5000 });
  });

  it("com a rede rápida (o eco chega antes do toque seguinte), os toques seguem como sempre (controle)", async () => {
    const { result, id } = await abrir();
    for (let i = 0; i < 3; i++) {
      await tocar(result, id);
      await act(async () => {
        await new Promise((ok) => setTimeout(ok, 20));
      });
    }
    expect(noBanco()).toBe(3);
    expect(naTela(result)).toBe(3);
  });
});
