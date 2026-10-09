import { describe, expect, it } from "vitest";
import {
  LIMITE_POR_ABERTURA,
  TELAS_DE_USO,
  criarFreioDeUso,
  quandoFoi,
  resumirUso,
  sortearAbertura,
  telaValida,
} from "./uso";

const AGORA = Date.parse("2026-10-09T20:00:00Z");
const dias = (n: number) => new Date(AGORA - n * 86_400_000).toISOString();

describe("telaValida / catálogo", () => {
  it("toda tela do catálogo segue o padrão aceito e tem rótulo único", () => {
    for (const tela of Object.keys(TELAS_DE_USO)) expect(telaValida(tela), tela).toBe(true);
    const rotulos = Object.values(TELAS_DE_USO);
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });
  it("recusa nome com espaço, maiúscula, vazio ou grande demais", () => {
    for (const ruim of ["", "Aba Combate", "aba:Combate", "a:b:c", "x".repeat(61), "aba:"]) {
      expect(telaValida(ruim), ruim).toBe(false);
    }
  });
});

describe("criarFreioDeUso", () => {
  it("cada tela vale uma vez por abertura", () => {
    const pode = criarFreioDeUso();
    expect(pode("aba:combate")).toBe(true);
    expect(pode("aba:combate")).toBe(false);
    expect(pode("aba:mapa")).toBe(true);
  });
  it("não aceita tela inválida e para no teto", () => {
    const pode = criarFreioDeUso();
    expect(pode("Tela Torta")).toBe(false);
    for (let i = 0; i < LIMITE_POR_ABERTURA; i++) expect(pode(`t:n${i}`)).toBe(true);
    expect(pode("aba:combate")).toBe(false);
  });
});

describe("sortearAbertura", () => {
  it("tem 12 caracteres de 0-9 a-z e muda conforme o sorteio", () => {
    expect(sortearAbertura()).toMatch(/^[0-9a-z]{12}$/);
    expect(sortearAbertura(() => 0)).toBe("000000000000");
    expect(sortearAbertura(() => 0.999)).toBe("zzzzzzzzzzzz");
  });
});

describe("resumirUso", () => {
  it("conta aberturas distintas por tela, separa por papel e acha o último uso", () => {
    const r = resumirUso(
      [
        { tela: "aba:combate", papel: "mestre", abertura: "a", created_at: dias(3) },
        { tela: "aba:combate", papel: "mestre", abertura: "a", created_at: dias(1) }, // mesma abertura: conta uma
        { tela: "aba:combate", papel: "jogador", abertura: "b", created_at: dias(2) },
        { tela: "aba:combate", papel: "telao", abertura: "c", created_at: dias(5) },
        { tela: "aba:mapa", papel: "jogador", abertura: "b", created_at: dias(2) },
      ],
      AGORA,
    );
    expect(r.aberturasNoTotal).toBe(3);
    const combate = r.usadas[0];
    expect(combate.tela).toBe("aba:combate");
    expect(combate.aberturas).toBe(3);
    expect(combate.porPapel).toEqual({ mestre: 1, jogador: 1, telao: 1 });
    expect(combate.ultimo).toBe(dias(1));
    expect(r.usadas[1].tela).toBe("aba:mapa");
  });

  it("ignora o que passou do período, data torta e papel desconhecido", () => {
    const r = resumirUso(
      [
        { tela: "aba:fichas", papel: "mestre", abertura: "a", created_at: dias(31) },
        { tela: "aba:fichas", papel: "mestre", abertura: "b", created_at: "ontem à noite" },
        { tela: "aba:fichas", papel: "visitante", abertura: "c", created_at: dias(1) },
      ],
      AGORA,
    );
    expect(r.usadas).toEqual([]);
    expect(r.aberturasNoTotal).toBe(0);
  });

  it("lista as telas conhecidas que ninguém abriu", () => {
    const r = resumirUso([{ tela: "aba:fichas", papel: "mestre", abertura: "a", created_at: dias(1) }], AGORA);
    const nunca = r.nuncaUsadas.map((t) => t.tela);
    expect(nunca).not.toContain("aba:fichas");
    expect(nunca).toContain("aba:mapa");
    expect(nunca.length).toBe(Object.keys(TELAS_DE_USO).length - 1);
  });

  it("tela de uma versão futura aparece com o nome cru em vez de sumir", () => {
    const r = resumirUso([{ tela: "nova:coisa", papel: "mestre", abertura: "a", created_at: dias(1) }], AGORA);
    expect(r.usadas[0].rotulo).toBe("nova:coisa");
  });

  it("desempata por nome quando o número de aberturas é igual", () => {
    const r = resumirUso(
      [
        { tela: "aba:mestre", papel: "mestre", abertura: "a", created_at: dias(1) },
        { tela: "aba:campanha", papel: "mestre", abertura: "a", created_at: dias(1) },
      ],
      AGORA,
    );
    expect(r.usadas.map((t) => t.tela)).toEqual(["aba:campanha", "aba:mestre"]);
  });
});

describe("quandoFoi", () => {
  it("diz hoje, ontem e há N dias pelo dia do calendário", () => {
    const agora = new Date(2026, 9, 9, 12, 0, 0);
    expect(quandoFoi(new Date(2026, 9, 9, 0, 5, 0).toISOString(), agora)).toBe("hoje");
    expect(quandoFoi(new Date(2026, 9, 8, 23, 59, 0).toISOString(), agora)).toBe("ontem");
    expect(quandoFoi(new Date(2026, 9, 4, 10, 0, 0).toISOString(), agora)).toBe("há 5 dias");
  });
});
