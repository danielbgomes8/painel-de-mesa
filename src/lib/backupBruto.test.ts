import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TABELAS_COM_SALA, copiarSalas, lerTudo } from "../../scripts/backup-salas.mjs";

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
