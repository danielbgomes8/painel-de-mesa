import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TABELAS_COM_SALA, TABELAS_FORA_DO_BACKUP, caminhoSeguroDaImagem, copiarImagens, copiarSalas, lerTudo } from "../../scripts/backup-salas.mjs";

/** Resposta de mentira do PostgREST: `paginas` em ordem, uma por pedido. */
function bancoDeMentira(respostas: Record<string, unknown[][] | { status: number }>) {
  const pedidos: { caminho: string; range: string }[] = [];
  const contadores: Record<string, number> = {};
  const buscar = async (endereco: string, opcoes: { headers: Record<string, string> }) => {
    const caminho = endereco.split("/rest/v1/")[1];
    pedidos.push({ caminho, range: opcoes.headers.Range });
    const tabela = caminho.split("?")[0];
    const r = respostas[tabela] ?? [[]];
    if (!Array.isArray(r)) {
      return { ok: false, status: r.status, text: async () => "erro do banco", json: async () => ({}) };
    }
    const i = (contadores[tabela] = (contadores[tabela] ?? -1) + 1);
    return { ok: true, status: 200, text: async () => "", json: async () => r[Math.min(i, r.length - 1)] };
  };
  return { buscar: buscar as unknown as typeof fetch, pedidos };
}

describe("backup bruto das salas", () => {
  it("cobre TODA tabela com room_code das migrations (senão o backup esquece dado novo)", () => {
    const pasta = join(process.cwd(), "supabase", "migrations");
    const criadas = new Set<string>();
    for (const arquivo of readdirSync(pasta).filter((a) => a.endsWith(".sql"))) {
      const sql = readFileSync(join(pasta, arquivo), "utf-8");
      for (const m of sql.matchAll(/create table (?:if not exists )?public\.([a-z_]+)/gi)) criadas.add(m[1]);
    }
    criadas.delete("rooms"); // a sala em si vai à parte
    for (const fora of TABELAS_FORA_DO_BACKUP) criadas.delete(fora); // não é dado da campanha
    expect([...criadas].sort()).toEqual([...TABELAS_COM_SALA].sort());
  });

  it("lê todas as páginas quando a tabela passa de 1000 linhas", async () => {
    const cheia = Array.from({ length: 1000 }, (_, i) => ({ n: i }));
    const resto = [{ n: 1000 }, { n: 1001 }, { n: 1002 }];
    const { buscar, pedidos } = bancoDeMentira({ combat_log: [cheia, resto] });
    const linhas = await lerTudo({ url: "https://x.supabase.co", chave: "k", caminho: "combat_log?room_code=eq.a", buscar });
    expect(linhas).toHaveLength(1003);
    expect(pedidos.map((p) => p.range)).toEqual(["0-999", "1000-1999"]);
  });

  it("um erro do banco derruba o backup em vez de gravar uma cópia furada", async () => {
    const { buscar } = bancoDeMentira({ rooms: { status: 503 } });
    await expect(copiarSalas({ url: "https://x.supabase.co", chave: "k", buscar })).rejects.toThrow(/HTTP 503/);
  });

  it("banco sem nenhuma sala (pausado/vazio) é erro, não backup vazio", async () => {
    const { buscar } = bancoDeMentira({ rooms: [[]] });
    await expect(copiarSalas({ url: "https://x.supabase.co", chave: "k", buscar })).rejects.toThrow(/nenhuma sala/);
  });

  it("copia cada sala com todas as tabelas, filtrando por room_code", async () => {
    const { buscar, pedidos } = bancoDeMentira({
      rooms: [[{ code: "a" }, { code: "b" }]],
      characters: [[{ slug: "x" }]],
    });
    // O script é JS puro (roda no GitHub sem compilar): o formato é declarado aqui.
    const copias = (await copiarSalas({ url: "https://x.supabase.co", chave: "k", buscar })) as {
      codigo: string;
      dados: Record<string, unknown[]>;
    }[];
    expect(copias.map((c) => c.codigo)).toEqual(["a", "b"]);
    for (const { dados } of copias) {
      for (const tabela of TABELAS_COM_SALA) expect(Array.isArray(dados[tabela])).toBe(true);
    }
    expect(copias[0].dados.characters).toEqual([{ slug: "x" }]);
    // uma sala não vaza pra outra: cada pedido leva o room_code da própria sala
    const deB = pedidos.filter((p) => p.caminho.includes("room_code=eq.b"));
    expect(deB).toHaveLength(TABELAS_COM_SALA.length);
  });
});

describe("backup das imagens dos mapas", () => {
  const resposta = (status: number, texto = "") => ({ ok: status >= 200 && status < 300, status, arrayBuffer: async () => new TextEncoder().encode(texto).buffer });
  const comCenas = (...imagens: (string | null)[]) => [{ codigo: "a", dados: { cenas: imagens.map((imagem) => ({ imagem })) } }];

  it("só aceita caminho que cabe numa pasta local (o banco é aberto: nada de sair da pasta)", () => {
    expect(caminhoSeguroDaImagem("sala/cena.jpg")).toBe("sala/cena.jpg");
    for (const ruim of ["../x.jpg", "/etc/passwd", "a/../../b", "a//b", "a\\b", "", null, 7]) {
      expect(caminhoSeguroDaImagem(ruim as string)).toBeNull();
    }
  });

  it("baixa cada imagem pelo endereço público e grava em <pasta>/mapas/<caminho>", async () => {
    const gravados: Record<string, string> = {};
    const pedidos: string[] = [];
    const r = await copiarImagens({
      url: "https://x.supabase.co",
      copias: comCenas("sala/um.jpg", null, "sala/dois jpg"),
      pasta: "backup",
      buscar: (async (e: string) => {
        pedidos.push(e);
        return resposta(200, e.includes("um") ? "UM" : "DOIS");
      }) as never,
      gravar: async (arquivo: string, conteudo: Buffer) => {
        gravados[arquivo] = conteudo.toString();
      },
    });
    expect(r).toEqual({ baixadas: 2, faltando: [] });
    expect(pedidos).toEqual([
      "https://x.supabase.co/storage/v1/object/public/mapas/sala/um.jpg",
      "https://x.supabase.co/storage/v1/object/public/mapas/sala/dois%20jpg",
    ]);
    expect(gravados).toEqual({ "backup/mapas/sala/um.jpg": "UM", "backup/mapas/sala/dois jpg": "DOIS" });
  });

  it("a mesma imagem em duas cenas é baixada uma vez só", async () => {
    let n = 0;
    await copiarImagens({ url: "https://x", copias: comCenas("a.jpg", "a.jpg"), pasta: "b", buscar: (async () => (n++, resposta(200, "x"))) as never, gravar: async () => {} });
    expect(n).toBe(1);
  });

  it("imagem que o Storage não tem vira aviso; erro de servidor derruba o backup", async () => {
    const avisos: string[] = [];
    const r = await copiarImagens({ url: "https://x", copias: comCenas("sumiu.jpg"), pasta: "b", buscar: (async () => resposta(404)) as never, gravar: async () => {}, aviso: (m: string) => avisos.push(m) });
    expect(r).toEqual({ baixadas: 0, faltando: ["sumiu.jpg"] });
    expect(avisos[0]).toContain("sumiu.jpg");
    await expect(copiarImagens({ url: "https://x", copias: comCenas("a.jpg"), pasta: "b", buscar: (async () => resposta(503)) as never, gravar: async () => {} })).rejects.toThrow(/HTTP 503/);
  });

  it("caminho suspeito no banco não vira arquivo fora da pasta", async () => {
    let gravou = false;
    const r = await copiarImagens({ url: "https://x", copias: comCenas("../../fora.jpg"), pasta: "b", buscar: (async () => resposta(200, "x")) as never, gravar: async () => void (gravou = true), aviso: () => {} });
    expect(gravou).toBe(false);
    expect(r.baixadas).toBe(0);
  });
});
