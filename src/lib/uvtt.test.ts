import { describe, expect, it } from "vitest";
import { lerParedesDoTexto } from "./importarParedes";
import { pareceArquivoUvtt, uvttParaImportacao } from "./uvtt";

/** Uma sala de 4×3 quadradinhos com uma porta no meio da parede de baixo; o mapa tem 10×8 quadradinhos de 70 px. */
function arquivo(extra: Record<string, unknown> = {}) {
  const sala = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 2 }];
  return JSON.stringify({
    format: 0.3,
    resolution: { map_origin: { x: 0, y: 0 }, map_size: { x: 10, y: 8 }, pixels_per_grid: 70 },
    line_of_sight: [sala],
    portals: [],
    image: "AAAA",
    ...extra,
  });
}

describe("uvttParaImportacao", () => {
  it("leva as linhas de parede pra px do mapa e junta os trechos retos", () => {
    const l = uvttParaImportacao(arquivo());
    expect(l.ok).toBe(true);
    if (!l.ok) return;
    expect(l.largura).toBe(700);
    expect(l.altura).toBe(560);
    // 4 lados (o topo tinha 4 pontos em fila reta e vira um trecho só)
    expect(l.paredes).toBe(4);
    const j = JSON.parse(l.texto);
    expect(j.paredes).toContainEqual([140, 140, 420, 140]);
    expect(j.image).toBeUndefined();
  });

  it("porta vira porta (aberta se closed é falso) e a parede por baixo dela não entra duas vezes", () => {
    const sala = [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 2 }];
    const l = uvttParaImportacao(
      arquivo({ line_of_sight: [sala], portals: [{ position: { x: 3.5, y: 5 }, bounds: [{ x: 3, y: 5 }, { x: 4, y: 5 }], closed: false }] }),
    );
    expect(l.ok).toBe(true);
    if (!l.ok) return;
    const j = JSON.parse(l.texto);
    expect(j.portas).toEqual([{ x1: 210, y1: 350, x2: 280, y2: 350, aberta: true }]);
    // a parede de baixo vira dois pedaços (o vão da porta fica de fora): (420,350)→(280,350) e (210,350)→(140,350)
    const embaixo = j.paredes.filter((p: number[]) => p[1] === 350 && p[3] === 350);
    expect(embaixo).toEqual([[420, 350, 280, 350], [210, 350, 140, 350]]);
  });

  it("o resultado entra direto no importador de paredes, na medida da cena", () => {
    const l = uvttParaImportacao(arquivo());
    if (!l.ok) throw new Error("devia ler");
    const r = lerParedesDoTexto(l.texto, { largura: 1400, altura: 1120 }, []);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.paredes).toBe(4);
  });

  it("recusa o que não é Universal VTT, com motivo", () => {
    expect(uvttParaImportacao("não é json")).toMatchObject({ ok: false });
    expect(uvttParaImportacao("{}")).toMatchObject({ ok: false });
    expect(uvttParaImportacao(arquivo({ line_of_sight: [] }))).toMatchObject({ ok: false });
  });

  it("reconhece a extensão", () => {
    expect(pareceArquivoUvtt("masmorra.dd2vtt")).toBe(true);
    expect(pareceArquivoUvtt("Mapa.UVTT")).toBe(true);
    expect(pareceArquivoUvtt("paredes.json")).toBe(false);
  });
});
