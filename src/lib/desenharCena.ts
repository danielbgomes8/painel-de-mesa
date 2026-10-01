/**
 * Desenho da cena no canvas: imagem, grade e névoa. As contas (zoom, grade,
 * pincel) ficam em `cenas.ts`, que tem teste; aqui só se pinta.
 */
import {
  gradeUsavel,
  type Cena,
  type ModoNevoa,
  type Ponto,
  type RegraNevoa,
  type Retangulo,
  type Vista,
} from "./cenas";

/** A névoa é desenhada num canvas à parte, menor que a imagem: pra um mapa de
 *  3000 px, 2048 já é mais do que a tela mostra, e poupa memória no celular. */
const LADO_MAXIMO_NEVOA = 2048;

export type FormaDesenhavel =
  | { forma: "retangulos"; dados: { r: readonly Retangulo[] } }
  | { forma: "pincel"; dados: { r: number; p: readonly Ponto[] } };

/** Quanto o canvas da névoa é menor que a imagem da cena (1 = do mesmo tamanho). */
export function escalaDaNevoa(c: Pick<Cena, "largura" | "altura">): number {
  return Math.min(1, LADO_MAXIMO_NEVOA / Math.max(c.largura, c.altura, 1));
}

/** Traça a forma com o estilo (cor, composição) que quem chamou já definiu. */
export function desenharForma(ctx: CanvasRenderingContext2D, f: FormaDesenhavel): void {
  if (f.forma === "retangulos") {
    for (const [x, y, w, h] of f.dados.r) ctx.fillRect(x, y, w, h);
    return;
  }
  const { r, p } = f.dados;
  if (p.length === 0) return;
  if (p.length === 1) {
    ctx.beginPath();
    ctx.arc(p[0][0], p[0][1], r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = r * 2;
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
  ctx.stroke();
}

/** Redesenha a névoa inteira no canvas dela: cobre tudo (se a cena nasce
 *  coberta) e aplica as pinceladas, da mais antiga pra mais nova. `regras` já
 *  vem ordenada (ver `ordenarRegras`). */
export function desenharNevoa(canvas: HTMLCanvasElement, cena: Cena, regras: readonly RegraNevoa[]): void {
  const fs = escalaDaNevoa(cena);
  const w = Math.max(1, Math.round(cena.largura * fs));
  const h = Math.max(1, Math.round(cena.altura * fs));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  if (cena.nevoa_ligada) ctx.fillRect(0, 0, w, h);
  ctx.setTransform(fs, 0, 0, fs, 0, 0);
  for (const regra of regras) {
    // Revelar apaga a névoa (deixa o canvas transparente); esconder pinta de novo.
    ctx.globalCompositeOperation = regra.modo === "revelar" ? "destination-out" : "source-over";
    desenharForma(ctx, regra);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export type EntradaDeDesenho = {
  cena: Cena;
  imagem: CanvasImageSource | null;
  nevoa: HTMLCanvasElement | null;
  vista: Vista;
  /** Tamanho da tela do canvas em px CSS. */
  larguraTela: number;
  alturaTela: number;
  dpr: number;
  /** O Mestre enxerga o mapa através da névoa; a mesa, não. */
  mestre: boolean;
  /** Pincelada em andamento (ainda não gravada). */
  previa?: { modo: ModoNevoa; forma: FormaDesenhavel } | null;
};

/** Pinta um quadro completo. */
export function desenharCena(ctx: CanvasRenderingContext2D, e: EntradaDeDesenho): void {
  const { cena, vista, dpr } = e;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#0d0b09";
  ctx.fillRect(0, 0, e.larguraTela * dpr, e.alturaTela * dpr);

  ctx.setTransform(dpr * vista.escala, 0, 0, dpr * vista.escala, dpr * vista.tx, dpr * vista.ty);

  if (e.imagem) {
    ctx.drawImage(e.imagem, 0, 0, cena.largura, cena.altura);
  } else {
    ctx.fillStyle = "#2a241d";
    ctx.fillRect(0, 0, cena.largura, cena.altura);
  }

  if (gradeUsavel(cena) && cena.grade_px * vista.escala >= 7) {
    desenharGrade(ctx, cena, vista.escala);
  }

  if (e.nevoa) {
    ctx.globalAlpha = e.mestre ? 0.55 : 1;
    ctx.drawImage(e.nevoa, 0, 0, cena.largura, cena.altura);
    ctx.globalAlpha = 1;
  }

  if (e.previa) {
    const revelar = e.previa.modo === "revelar";
    ctx.fillStyle = revelar ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.55)";
    ctx.strokeStyle = ctx.fillStyle;
    desenharForma(ctx, e.previa.forma);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function desenharGrade(ctx: CanvasRenderingContext2D, c: Cena, escala: number): void {
  const g = c.grade_px;
  const inicioX = c.grade_dx - Math.ceil(c.grade_dx / g) * g;
  const inicioY = c.grade_dy - Math.ceil(c.grade_dy / g) * g;
  // Duas passadas (escura grossa + clara fina): a linha aparece tanto em mapa
  // claro quanto em mapa escuro.
  for (const [cor, largura] of [
    ["rgba(0,0,0,0.38)", 1.6],
    ["rgba(255,255,255,0.22)", 0.7],
  ] as const) {
    ctx.strokeStyle = cor;
    ctx.lineWidth = largura / escala;
    ctx.beginPath();
    for (let x = inicioX; x <= c.largura; x += g) {
      if (x < 0) continue;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, c.altura);
    }
    for (let y = inicioY; y <= c.altura; y += g) {
      if (y < 0) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(c.largura, y);
    }
    ctx.stroke();
  }
}
