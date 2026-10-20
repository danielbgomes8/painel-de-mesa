import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Em 09–11/10/2026 dois blocos de estilo foram colados no meio de uma regra (`.usolista {`)
// e deixaram uma chave aberta: tudo o que vinha depois do arquivo virou `.usolista .x` e
// parou de valer (luzes, loja, relógios, folhas...), sem nenhum erro no build.
describe("globals.css", () => {
  const css = readFileSync("src/app/globals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("tem as chaves fechadas (nenhuma regra engole as seguintes)", () => {
    let nivel = 0;
    let linha = 1;
    let abertaDesde = 0;
    for (const c of css) {
      if (c === "\n") linha++;
      if (c === "{") {
        if (nivel === 0) abertaDesde = linha;
        nivel++;
      } else if (c === "}") nivel--;
      expect(nivel, `chave fechando sem abrir perto da linha ${linha}`).toBeGreaterThanOrEqual(0);
    }
    expect(nivel, `regra aberta na linha ${abertaDesde} nunca foi fechada`).toBe(0);
  });

  it("nenhuma regra fica aninhada dentro de outra (só blocos @, como @media, abrigam regras)", () => {
    const pilha: string[] = [];
    const problemas: string[] = [];
    for (const m of css.matchAll(/([^{};]*)([{}])/g)) {
      if (m[2] === "{") {
        const seletor = m[1].trim();
        const pai = pilha[pilha.length - 1];
        if (pai !== undefined && !/^@(media|supports|layer|container|keyframes)/.test(pai)) problemas.push(`${seletor} dentro de ${pai}`);
        pilha.push(seletor);
      } else pilha.pop();
    }
    expect(problemas.slice(0, 5)).toEqual([]);
  });
});
