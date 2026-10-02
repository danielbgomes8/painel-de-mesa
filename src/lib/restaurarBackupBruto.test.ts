import { describe, expect, it } from "vitest";
import { TABELAS_COM_SALA } from "../../scripts/backup-salas.mjs";
import {
  emLotes,
  ordemDeRestauracao,
  prepararLinhas,
  problemasDoArquivo,
  restaurar,
  restaurarImagens,
  resumirArquivo,
} from "../../scripts/restaurar-backup-bruto.mjs";

describe("restaurar o backup diário bruto", () => {
  it("restaura TODA tabela que o backup copia (senão um dado novo ficaria de fora da volta)", () => {
    const ordem = ordemDeRestauracao();
    expect(ordem[0]).toBe("rooms");
    expect([...ordem].slice(1).sort()).toEqual([...TABELAS_COM_SALA].sort());
  });

  it("a sala vem primeiro e as cenas antes da névoa, dos peões e das paredes (chave estrangeira)", () => {
    const ordem = ordemDeRestauracao();
    expect(ordem.indexOf("cenas")).toBeLessThan(ordem.indexOf("cena_nevoa"));
    expect(ordem.indexOf("cenas")).toBeLessThan(ordem.indexOf("cena_pecas"));
    expect(ordem.indexOf("cenas")).toBeLessThan(ordem.indexOf("cena_paredes"));
    expect(ordem.indexOf("rooms")).toBeLessThan(ordem.indexOf("characters"));
  });

  it("tira a coluna que o banco gera sozinho (ele recusaria) e põe a névoa na ordem em que foi pintada", () => {
    const linhas = [
      { id: "c", seq: 30, modo: "esconder" },
      { id: "a", seq: 10, modo: "revelar" },
      { id: "b", seq: 20, modo: "revelar" },
    ];
    const prontas = prepararLinhas("cena_nevoa", linhas);
    expect(prontas.map((l: Record<string, unknown>) => l.id)).toEqual(["a", "b", "c"]);
    expect(prontas.every((l: Record<string, unknown>) => !("seq" in l))).toBe(true);
    // as outras tabelas passam como estão
    expect(prepararLinhas("characters", [{ id: "x", seq: 1 }])).toEqual([{ id: "x", seq: 1 }]);
  });

  it("parte em lotes sem perder linha", () => {
    const lotes = emLotes(Array.from({ length: 450 }, (_, i) => i), 200);
    expect(lotes.map((l: number[]) => l.length)).toEqual([200, 200, 50]);
    expect(emLotes([], 200)).toEqual([]);
  });

  it("resume só o que o arquivo tem", () => {
    expect(resumirArquivo({ rooms: [{}], characters: [{}, {}], diario: [] })).toEqual([
      ["rooms", 1],
      ["characters", 2],
    ]);
  });

  it("recusa arquivo que não é backup, antes de encostar no banco", () => {
    expect(problemasDoArquivo(null)).not.toEqual([]);
    expect(problemasDoArquivo({ sala: "x" })).toContain("falta a linha da sala (campo `rooms`)");
    expect(problemasDoArquivo({ sala: "x", rooms: [{ code: "x" }], characters: "nada" })).toEqual(["`characters` não é uma lista"]);
    expect(problemasDoArquivo({ sala: "x", rooms: [{ code: "x" }] })).toEqual([]);
  });

  it("simulação não grava nada; de verdade, insere na ordem certa, com 'ignorar duplicata'", async () => {
    const dados = {
      sala: "s",
      rooms: [{ code: "s" }],
      cena_nevoa: [{ id: "n1", seq: 2 }, { id: "n0", seq: 1 }],
      cenas: [{ id: "c1" }],
      characters: [{ id: "p1" }],
    };
    const chamadas: { url: string; corpo: unknown; prefer: string }[] = [];
    const buscar = async (entrada: RequestInfo | URL, init?: RequestInit) => {
      chamadas.push({
        url: String(entrada).replace(/^.*\/rest\/v1\//, ""),
        corpo: JSON.parse(String(init?.body)),
        prefer: String((init?.headers as Record<string, string>).Prefer),
      });
      return new Response(null, { status: 201 });
    };

    const simulado = await restaurar({ dados, url: "https://x.supabase.co", chave: "k", executar: false, buscar });
    expect(chamadas).toHaveLength(0);
    expect(simulado.map(([t]) => t)).toEqual(["rooms", "characters", "cenas", "cena_nevoa"]);

    await restaurar({ dados, url: "https://x.supabase.co", chave: "k", executar: true, buscar });
    expect(chamadas.map((c) => c.url)).toEqual(["rooms", "characters", "cenas", "cena_nevoa"]);
    expect(chamadas.every((c) => c.prefer.includes("ignore-duplicates"))).toBe(true);
    expect(chamadas[3].corpo).toEqual([{ id: "n0" }, { id: "n1" }]);
  });

  it("para no primeiro erro do banco, dizendo qual tabela", async () => {
    const buscar = async () => new Response("violates foreign key", { status: 409 });
    await expect(
      restaurar({ dados: { sala: "s", rooms: [{ code: "s" }] }, url: "https://x.supabase.co", chave: "k", executar: true, buscar }),
    ).rejects.toThrow(/rooms: HTTP 409/);
  });
});

describe("restaurar as imagens dos mapas", () => {
  const dados = { cenas: [{ imagem: "sala/um.jpg" }, { imagem: "sala/dois.jpg" }, { imagem: null }, { imagem: "../fora.jpg" }] };
  const resposta = (status: number, texto = "") => ({ ok: status >= 200 && status < 300, status, text: async () => texto });
  const arquivos = (existem: string[]) => async (a: string) => {
    if (existem.includes(a)) return Buffer.from("img");
    throw new Error("ENOENT");
  };

  it("simulação só conta o que existe na pasta, sem chamar o Storage", async () => {
    let chamou = false;
    const r = await restaurarImagens({
      dados, pasta: "backup", url: "https://x", chave: "k", executar: false,
      buscar: (async () => (chamou = true, resposta(200))) as never,
      ler: arquivos(["backup/mapas/sala/um.jpg"]),
    });
    expect(chamou).toBe(false);
    expect(r).toEqual({ enviadas: 1, jaExistiam: 0, semArquivo: ["sala/dois.jpg"] });
  });

  it("de verdade, sobe sem sobrescrever e trata 'já existe' como ok", async () => {
    const pedidos: { endereco: string; metodo: string; upsert: string }[] = [];
    const r = await restaurarImagens({
      dados, pasta: "backup", url: "https://x", chave: "k", executar: true,
      buscar: (async (e: string, o: { method: string; headers: Record<string, string> }) => {
        pedidos.push({ endereco: e, metodo: o.method, upsert: o.headers["x-upsert"] });
        return e.endsWith("um.jpg") ? resposta(200) : resposta(400, '{"error":"Duplicate","message":"The resource already exists"}');
      }) as never,
      ler: arquivos(["backup/mapas/sala/um.jpg", "backup/mapas/sala/dois.jpg"]),
    });
    expect(r).toEqual({ enviadas: 1, jaExistiam: 1, semArquivo: [] });
    expect(pedidos.map((p) => [p.endereco, p.metodo, p.upsert])).toEqual([
      ["https://x/storage/v1/object/mapas/sala/um.jpg", "POST", "false"],
      ["https://x/storage/v1/object/mapas/sala/dois.jpg", "POST", "false"],
    ]);
  });

  it("outro erro do Storage derruba a restauração", async () => {
    await expect(
      restaurarImagens({ dados: { cenas: [{ imagem: "a.jpg" }] }, pasta: "b", url: "https://x", chave: "k", executar: true, buscar: (async () => resposta(500, "ruim")) as never, ler: arquivos(["b/mapas/a.jpg"]) }),
    ).rejects.toThrow(/HTTP 500/);
  });
});
