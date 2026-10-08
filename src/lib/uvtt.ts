/**
 * Arquivo "Universal VTT" (.dd2vtt, .uvtt, .df2vtt): o que o Dungeondraft e o Dungeon Scrawl exportam. Já traz as paredes e
 * as portas EXATAS do que o autor desenhou — não há o que detectar, só traduzir pro formato do importador de paredes
 * (`importarParedes.ts`), que leva as coordenadas pro tamanho da cena e fecha as frestas.
 *
 * O que o arquivo tem (só usamos a geometria; a imagem embutida, que pesa vários MB, é descartada):
 *   resolution: { map_origin: {x, y}, map_size: {x, y}, pixels_per_grid }   (medidas em quadradinhos)
 *   line_of_sight: [[{x, y}, ...], ...]    linhas de parede (sequência de pontos; fechada repete o primeiro)
 *   objects_line_of_sight: [...]           o que bloqueia a vista mas não é parede (pilar, móvel alto)
 *   portals: [{ position, bounds: [{x, y}, {x, y}], closed, ... }]   portas e janelas
 */

/** Arquivos assim passam fácil de 10 MB por causa da imagem em base64; acima disso não é mapa de mesa. */
export const TAMANHO_MAXIMO_DO_UVTT = 80_000_000;

export function pareceArquivoUvtt(nome: string): boolean {
  return /\.(dd2vtt|uvtt|df2vtt)$/i.test(nome);
}

export type LeituraDeUvtt =
  | { ok: true; texto: string; paredes: number; portas: number; largura: number; altura: number }
  | { ok: false; erro: string };

type P = { x: number; y: number };

function ponto(v: unknown): P | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return typeof o.x === "number" && typeof o.y === "number" && Number.isFinite(o.x) && Number.isFinite(o.y) ? { x: o.x, y: o.y } : null;
}

function r1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Tira os pontos do meio de trechos retos (a linha de uma sala reta chega com um ponto por quadradinho). */
function semPontosRetos(pts: P[]): P[] {
  const saida: P[] = [];
  for (const p of pts) {
    while (saida.length >= 2) {
      const a = saida[saida.length - 2];
      const b = saida[saida.length - 1];
      const cruz = (b.x - a.x) * (p.y - b.y) - (b.y - a.y) * (p.x - b.x);
      const mesmaDirecao = (b.x - a.x) * (p.x - b.x) + (b.y - a.y) * (p.y - b.y) > 0;
      if (Math.abs(cruz) < 1e-6 && mesmaDirecao) saida.pop();
      else break;
    }
    saida.push(p);
  }
  return saida;
}

/**
 * Tira de uma parede o pedaço que passa por baixo de uma porta (a porta é o que vale ali). Se `s` não está na reta da porta,
 * devolve `s` como veio; se a porta fica no meio, devolve os dois pedaços de fora.
 */
function cortarPelaPorta(s: [P, P], d: [P, P], folga: number): [P, P][] {
  const dx = d[1].x - d[0].x;
  const dy = d[1].y - d[0].y;
  const quad = dx * dx + dy * dy;
  if (quad === 0) return [s];
  const dist = (p: P) => Math.abs((p.x - d[0].x) * dy - (p.y - d[0].y) * dx) / Math.sqrt(quad);
  if (dist(s[0]) > folga || dist(s[1]) > folga) return [s];
  const sx = s[1].x - s[0].x;
  const sy = s[1].y - s[0].y;
  const sq = sx * sx + sy * sy;
  if (sq === 0) return [s];
  // Onde a porta começa e termina, em fração do comprimento de `s`.
  const t = (p: P) => ((p.x - s[0].x) * sx + (p.y - s[0].y) * sy) / sq;
  const [t0, t1] = [t(d[0]), t(d[1])].sort((a, b) => a - b);
  if (t1 <= 0.001 || t0 >= 0.999) return [s]; // só encosta
  const em = (k: number): P => ({ x: s[0].x + sx * k, y: s[0].y + sy * k });
  const saida: [P, P][] = [];
  if (t0 > 0.001) saida.push([s[0], em(Math.min(1, t0))]);
  if (t1 < 0.999) saida.push([em(Math.max(0, t1)), s[1]]);
  return saida;
}

/** Lê o texto de um arquivo UVTT e devolve o texto no formato do importador de paredes. */
export function uvttParaImportacao(conteudo: string): LeituraDeUvtt {
  let bruto: unknown;
  try {
    bruto = JSON.parse(conteudo);
  } catch {
    return { ok: false, erro: "Não consegui ler esse arquivo. Um arquivo do Dungeondraft ou do Dungeon Scrawl é .dd2vtt, .uvtt ou .df2vtt." };
  }
  if (!bruto || typeof bruto !== "object") return { ok: false, erro: "Esse arquivo não tem o formato Universal VTT." };
  const o = bruto as Record<string, unknown>;
  const res = (o.resolution ?? {}) as Record<string, unknown>;
  const tamanho = ponto(res.map_size);
  const origem = ponto(res.map_origin) ?? { x: 0, y: 0 };
  const ppg = typeof res.pixels_per_grid === "number" ? res.pixels_per_grid : 0;
  if (!tamanho || tamanho.x <= 0 || tamanho.y <= 0 || ppg <= 0) {
    return { ok: false, erro: "Esse arquivo não diz o tamanho do mapa (falta “resolution”); não parece um Universal VTT." };
  }
  const px = (p: P): [number, number] => [(p.x - origem.x) * ppg, (p.y - origem.y) * ppg];

  // Portas primeiro: a parede que passa por baixo de uma porta é a própria porta e não entra duas vezes.
  const vaos: [P, P][] = [];
  const abertas: boolean[] = [];
  if (Array.isArray(o.portals)) {
    for (const item of o.portals) {
      if (!item || typeof item !== "object") continue;
      const b = (item as Record<string, unknown>).bounds;
      const a = Array.isArray(b) ? ponto(b[0]) : null;
      const c = Array.isArray(b) ? ponto(b[1]) : null;
      if (!a || !c) continue;
      vaos.push([a, c]);
      abertas.push((item as Record<string, unknown>).closed === false);
    }
  }

  const paredes: [number, number, number, number][] = [];
  const folga = 0.2; // quadradinhos
  for (const chave of ["line_of_sight", "objects_line_of_sight"] as const) {
    const linhas = o[chave];
    if (!Array.isArray(linhas)) continue;
    for (const linha of linhas) {
      if (!Array.isArray(linha)) continue;
      const pts = semPontosRetos(linha.map(ponto).filter((p): p is P => p !== null));
      for (let i = 0; i + 1 < pts.length; i++) {
        let pedacos: [P, P][] = [[pts[i], pts[i + 1]]];
        for (const d of vaos) pedacos = pedacos.flatMap((q) => cortarPelaPorta(q, d, folga));
        for (const q of pedacos) {
          const [x1, y1] = px(q[0]);
          const [x2, y2] = px(q[1]);
          paredes.push([r1(x1), r1(y1), r1(x2), r1(y2)]);
        }
      }
    }
  }
  const listaPortas = vaos.map(([a, c], i) => {
    const [x1, y1] = px(a);
    const [x2, y2] = px(c);
    return { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), aberta: abertas[i] };
  });
  if (paredes.length + listaPortas.length === 0) return { ok: false, erro: "Esse arquivo não tem nenhuma parede nem porta (falta “line_of_sight”)." };

  const largura = Math.round(tamanho.x * ppg);
  const altura = Math.round(tamanho.y * ppg);
  return { ok: true, texto: JSON.stringify({ largura, altura, paredes, portas: listaPortas }), paredes: paredes.length, portas: listaPortas.length, largura, altura };
}
