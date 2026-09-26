import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIMITES_ERRO, criarFreio, cortar, deveRelatar, resumirErro } from "./erros";

describe("resumo do erro que vai pro banco", () => {
  it("erro do Supabase: a mensagem e, no detalhe, o código que diz o motivo", () => {
    const recusa = {
      message: 'new row violates row-level security policy for table "characters"',
      code: "42501",
      details: null,
      hint: null,
    };
    expect(resumirErro(recusa)).toEqual({ mensagem: recusa.message, detalhe: "código 42501" });
    const semColuna = {
      message: "Could not find the 'vantagens' column of 'characters' in the schema cache",
      code: "PGRST204",
      details: "detalhe",
      hint: "rode a migration",
    };
    expect(resumirErro(semColuna).detalhe).toBe("código PGRST204 · detalhe · rode a migration");
  });

  it("erro de programa: nome, mensagem e a pilha", () => {
    const e = new TypeError("Cannot read properties of undefined (reading 'hp')");
    const r = resumirErro(e);
    expect(r.mensagem).toBe("TypeError: Cannot read properties of undefined (reading 'hp')");
    expect(r.detalhe).toContain("erros.test.ts");
  });

  it("texto e coisa qualquer também viram mensagem", () => {
    expect(resumirErro("contenção demais: desisti depois de 5 tentativas")).toEqual({
      mensagem: "contenção demais: desisti depois de 5 tentativas",
      detalhe: null,
    });
    expect(resumirErro({ a: 1 }).mensagem).toBe('{"a":1}');
    const circular: Record<string, unknown> = {};
    circular.eu = circular;
    expect(resumirErro(circular).mensagem).toBe("[object Object]");
  });

  it("nada passa do tamanho que o banco aceita", () => {
    const enorme = new Error("x".repeat(5000));
    const r = resumirErro(enorme);
    expect(r.mensagem.length).toBe(LIMITES_ERRO.mensagem);
    expect(r.mensagem.endsWith("…")).toBe(true);
    expect(r.detalhe!.length).toBeLessThanOrEqual(LIMITES_ERRO.detalhe);
    expect(cortar("curto", 10)).toBe("curto");
  });

  it("os limites batem com os `check` da migration 0017", () => {
    const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "0017_erros.sql"), "utf-8");
    for (const [coluna, max] of Object.entries(LIMITES_ERRO)) {
      expect(sql, coluna).toContain(`char_length(${coluna}) <= ${max}`);
    }
  });
});

describe("o que vale relatar", () => {
  it("queda de internet não (tem a fila própria)", () => {
    expect(deveRelatar({ message: "TypeError: Failed to fetch", code: "", details: "" })).toBe(false);
    expect(deveRelatar(new TypeError("Failed to fetch"))).toBe(false);
    expect(deveRelatar(new TypeError("Load failed"))).toBe(false);
    expect(deveRelatar(new TypeError("NetworkError when attempting to fetch resource."))).toBe(false);
    expect(deveRelatar(new DOMException("prazo", "TimeoutError"))).toBe(false);
    expect(deveRelatar(new DOMException("cancelado", "AbortError"))).toBe(false);
  });

  it("recusa do banco e erro de programa sim", () => {
    expect(deveRelatar({ message: "permission denied", code: "42501" })).toBe(true);
    expect(deveRelatar(new TypeError("Cannot read properties of undefined"))).toBe(true);
    expect(deveRelatar("contenção demais")).toBe(true);
  });

  it("aviso do navegador e erro sem informação de outro site não", () => {
    expect(deveRelatar("ResizeObserver loop completed with undelivered notifications.")).toBe(false);
    expect(deveRelatar("Script error.")).toBe(false);
    expect(deveRelatar(undefined)).toBe(false);
    expect(deveRelatar(null)).toBe(false);
  });
});

describe("freio dos relatos", () => {
  it("o mesmo erro só uma vez a cada 5 minutos; outro erro passa", () => {
    const pode = criarFreio();
    const erro = { onde: "atualizarPersonagem", mensagem: "permission denied" };
    expect(pode(erro, 0)).toBe(true);
    expect(pode(erro, 60_000)).toBe(false);
    expect(pode({ ...erro, onde: "definirCombate" }, 60_000)).toBe(true);
    expect(pode(erro, 5 * 60_000)).toBe(true);
  });

  it("no máximo 20 por abertura do app, mesmo com erros diferentes", () => {
    const pode = criarFreio();
    const passaram = Array.from({ length: 30 }, (_, i) => pode({ onde: "laço", mensagem: `erro ${i}` }, i)).filter(
      Boolean,
    );
    expect(passaram).toHaveLength(20);
  });
});
