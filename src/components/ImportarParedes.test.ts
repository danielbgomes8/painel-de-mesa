// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportarParedes } from "./ImportarParedes";
import type { NovaParede } from "@/lib/paredes";

/**
 * A tela de importar paredes, com um "banco" de mentira no lugar do
 * `muros.adicionar`. As regras (ler, mudar de escala, fechar fresta) têm teste
 * próprio em lib/importarParedes.test.ts; aqui é o que a tela promete: só entra
 * o que foi conferido, e só diz "entraram" depois de o banco confirmar.
 */

const cena = { largura: 1520, altura: 1520 };
const RESPOSTA = JSON.stringify({ largura: 760, altura: 760, paredes: [[100, 100, 400, 100], [400, 100, 400, 300]], portas: [[200, 300, 240, 300]] });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function montar(adicionar: (novas: NovaParede[]) => Promise<boolean> = async () => true) {
  render(createElement(ImportarParedes, { cena, paredes: [], adicionar }));
  fireEvent.click(screen.getByRole("button", { name: /importar paredes de um arquivo/ }));
  return {
    campo: screen.getByLabelText("Resposta da IA com as paredes") as HTMLTextAreaElement,
    botao: screen.getByRole("button", { name: "importar pro mapa" }) as HTMLButtonElement,
  };
}

describe("importar paredes", () => {
  it("abre fechado: nada de campo na tela até o Mestre tocar", () => {
    render(createElement(ImportarParedes, { cena, paredes: [], adicionar: async () => true }));
    expect(screen.queryByLabelText("Resposta da IA com as paredes")).toBeNull();
    expect(screen.getByRole("button", { name: /importar paredes de um arquivo/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("aberto, traz o passo a passo pro Mestre (quem nunca usou não precisa de ninguém explicando)", () => {
    montar();
    const passos = [...document.querySelectorAll(".mapa-passos li")].map((li) => li.textContent ?? "");
    expect(passos).toHaveLength(4);
    expect(passos[0]).toContain("copiar o pedido pra IA");
    expect(passos[1]).toContain("junto com a imagem deste mapa");
    expect(passos[3]).toContain("importar pro mapa");
  });

  it("sem texto, ou com texto que não é uma lista de paredes, não deixa importar e diz por quê", () => {
    const { campo, botao } = montar();
    expect(botao.disabled).toBe(true);
    fireEvent.change(campo, { target: { value: "oi, tudo bem?" } });
    expect(botao.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("Não entendi o texto");
  });

  it("mostra o que vai entrar e manda as paredes já no tamanho da cena", async () => {
    const adicionar = vi.fn(async () => true);
    const { campo, botao } = montar(adicionar);
    fireEvent.change(campo, { target: { value: RESPOSTA } });
    expect(screen.getByText(/Prontas pra entrar: 2 paredes e 1 porta\./)).toBeTruthy();
    fireEvent.click(botao);
    await waitFor(() => expect(screen.getByText(/Entraram 2 paredes e 1 porta/)).toBeTruthy());
    expect(adicionar).toHaveBeenCalledTimes(1);
    expect(adicionar).toHaveBeenCalledWith([
      { tipo: "parede", x1: 200, y1: 200, x2: 800, y2: 200 },
      { tipo: "parede", x1: 800, y1: 200, x2: 800, y2: 600 },
      { tipo: "porta", x1: 400, y1: 600, x2: 480, y2: 600, aberta: false },
    ]);
    // O campo esvazia: tocar de novo não importa a mesma planta em dobro.
    expect(campo.value).toBe("");
    expect(botao.disabled).toBe(true);
  });

  it("só diz que entrou depois de o banco confirmar; se falhar, avisa e guarda o texto", async () => {
    let responder: (ok: boolean) => void = () => {};
    const adicionar = vi.fn(() => new Promise<boolean>((r) => (responder = r)));
    const { campo, botao } = montar(adicionar);
    fireEvent.change(campo, { target: { value: RESPOSTA } });
    fireEvent.click(botao);
    await waitFor(() => expect(botao.textContent).toBe("importando…"));
    expect(screen.queryByText(/Entraram/)).toBeNull();
    responder(false);
    await waitFor(() => expect(screen.getByText(/Não importou/)).toBeTruthy());
    expect(campo.value).toBe(RESPOSTA);
  });

  it("copia o pedido com o tamanho deste mapa", async () => {
    const writeText = vi.fn(async (texto: string) => void texto);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "copiar o pedido pra IA" }));
    await waitFor(() => expect(screen.getByText(/Pedido copiado/)).toBeTruthy());
    expect(writeText.mock.calls[0][0]).toContain("1520 de largura por 1520 de altura");
  });

  it("navegador que não deixa copiar: o pedido fica à vista pra copiar à mão", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: async () => Promise.reject(new Error("sem permissão")) } });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "copiar o pedido pra IA" }));
    const pedido = (await screen.findByLabelText("Pedido pra IA")) as HTMLTextAreaElement;
    expect(pedido.value).toContain(`"largura": 1520, "altura": 1520`);
  });

  it("lê o arquivo escolhido pro mesmo campo do texto colado", async () => {
    const { campo } = montar();
    const entrada = document.querySelector('.mapa-importar input[type="file"]') as HTMLInputElement;
    const arquivo = new File([RESPOSTA], "paredes.json", { type: "application/json" });
    fireEvent.change(entrada, { target: { files: [arquivo] } });
    await waitFor(() => expect(campo.value).toBe(RESPOSTA));
    expect(screen.getByText(/Prontas pra entrar: 2 paredes e 1 porta\./)).toBeTruthy();
  });
});
