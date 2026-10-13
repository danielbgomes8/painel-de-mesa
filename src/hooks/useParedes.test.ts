// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BancoFalso } from "./bancoFalsoParaTeste";

/**
 * O `useParedes` de verdade contra o banco falso, com o aviso de tempo real ATRASADO (a rede lenta): o Mestre toca
 * na porta várias vezes seguidas e o eco de uma gravação anterior chega no meio. A porta não pode voltar atrás, e o
 * toque seguinte não pode partir do estado velho (o "abre/fecha" sai de `!porta.aberta`).
 */

const banco = vi.hoisted(() => ({ atual: null as unknown as { cliente: unknown } }));
vi.mock("@/lib/supabase", () => ({
  supabaseConfigurado: true,
  get supabase() {
    return banco.atual.cliente;
  },
}));

const { useParedes } = await import("./useParedes");

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
  const porta = bd.semear("cena_paredes", [{ cena_id: CENA, room_code: SALA, tipo: "porta", x1: 0, y1: 0, x2: 60, y2: 0, aberta: false }])[0] as { id: string };
  const r = renderHook(() => useParedes(CENA, SALA));
  await waitFor(() => expect(r.result.current.carregando).toBe(false));
  // O canal assina um instante depois da primeira leitura.
  await act(async () => {
    await new Promise((ok) => setTimeout(ok, 20));
  });
  return { ...r, id: porta.id };
}

const abertaNoBanco = () => bd.linhas("cena_paredes")[0].aberta;
const abertaNaTela = (r: { current: { paredes: { aberta: boolean }[] } }) => r.current.paredes[0].aberta;

async function alternar(r: { current: { alternarPorta: (id: string) => Promise<boolean> } }, id: string) {
  await act(async () => {
    await r.current.alternarPorta(id);
  });
}

describe("useParedes: toques seguidos na porta com o eco atrasado", () => {
  it("três toques (abre, fecha, abre) deixam a porta aberta, mesmo com o eco do primeiro no meio", async () => {
    const { result, id } = await abrir();
    bd.reterEcos();

    await alternar(result, id); // abre
    await alternar(result, id); // fecha
    expect(abertaNaTela(result)).toBe(false);

    // O eco do PRIMEIRO toque (aberta = true) chega agora, depois de a tela já ter ido a "fechada".
    await act(async () => {
      bd.soltarEcos(1);
      await new Promise((ok) => setTimeout(ok, 10));
    });
    expect(abertaNaTela(result)).toBe(false);

    await alternar(result, id); // o terceiro toque abre
    expect(abertaNoBanco()).toBe(true);

    await act(async () => {
      bd.soltarEcos();
      await new Promise((ok) => setTimeout(ok, 10));
    });
    expect(abertaNoBanco()).toBe(true);
    expect(abertaNaTela(result)).toBe(true);
  });

  it("o que OUTRO aparelho mudou na porta durante a janela não se perde: a releitura do fim traz de volta", async () => {
    const { result, id } = await abrir();
    await alternar(result, id); // abre, e a janela abre
    await act(async () => {
      bd.comoOutroAparelho("cena_paredes", (l) => l.id === id, { trancada: true });
      await new Promise((ok) => setTimeout(ok, 30));
    });
    expect(result.current.paredes[0].trancada).toBe(false);
    await waitFor(() => expect(result.current.paredes[0].trancada).toBe(true), { timeout: 5000 });
    expect(abertaNaTela(result)).toBe(true);
  });

  it("com a rede rápida (o eco chega antes do toque seguinte), os toques seguem como sempre (controle)", async () => {
    const { result, id } = await abrir();
    for (let i = 0; i < 3; i++) {
      await alternar(result, id);
      await act(async () => {
        await new Promise((ok) => setTimeout(ok, 20));
      });
    }
    expect(abertaNoBanco()).toBe(true);
    expect(abertaNaTela(result)).toBe(true);
  });
});
