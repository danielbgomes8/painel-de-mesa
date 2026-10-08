// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreviaDeParedes } from "./PreviaDeParedes";

afterEach(cleanup);

const deteccao = { largura: 400, altura: 300, paredes: [[0, 10, 100, 10], [50, 0, 50, 90]] as [number, number, number, number][], portas: [[100, 10, 130, 10]] as [number, number, number, number][] };

describe("prévia das paredes achadas", () => {
  it("cada linha é um botão e tocar avisa qual", () => {
    const aoAlternar = vi.fn();
    render(createElement(PreviaDeParedes, { url: "x.jpg", deteccao, tiradas: new Set<string>(), aoAlternar }));
    expect(screen.getAllByRole("button")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Porta 0, dentro" }));
    expect(aoAlternar).toHaveBeenCalledWith("d0");
  });

  it("a linha tirada aparece como fora", () => {
    render(createElement(PreviaDeParedes, { url: "x.jpg", deteccao, tiradas: new Set(["p1"]), aoAlternar: () => {} }));
    const b = screen.getByRole("button", { name: "Parede 1, fora" });
    expect(b.getAttribute("aria-pressed")).toBe("false");
  });

  it("o teclado também tira a linha", () => {
    const aoAlternar = vi.fn();
    render(createElement(PreviaDeParedes, { url: "x.jpg", deteccao, tiradas: new Set<string>(), aoAlternar }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Parede 0, dentro" }), { key: "Enter" });
    expect(aoAlternar).toHaveBeenCalledWith("p0");
  });
});
