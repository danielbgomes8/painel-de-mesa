/**
 * Desenho da cena no canvas: imagem, grade e névoa. As contas (zoom, grade,
 * pincel) ficam em `cenas.ts`, que tem teste; aqui só se pinta.
 */
import {
  gradeUsavel,
  mapaParaTela,
  type Cena,
  type ModoNevoa,
  type Ponto,
  type RegraNevoa,
  type Retangulo,
  type Vista,
} from "./cenas";
import { animacaoDoPing, pontoNaBorda, type PingNaTela } from "./ping";
import type { PecaNaTela } from "./pecas";
import { medirRegua, opacidadeDaRegua, partesDoRotulo, type CenaParaRegua, type ModoRegua, type ReguaNaTela } from "./regua";

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
  /** Peões, e como saber se um ponto do mapa está coberto de névoa. */
  pecas?: readonly PecaNaTela[];
  pecaCoberta?: (x: number, y: number) => boolean;
  /** Peão sendo arrastado: desenhado nesta posição em vez da gravada. */
  arrasto?: { id: string; x: number; y: number } | null;
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

  if (e.pecas && e.pecas.length > 0) {
    desenharPecas(ctx, e.pecas, e.mestre, e.pecaCoberta ?? (() => false), e.arrasto ?? null);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

const COR_VEZ = "#f0c24b";

/** Os peões, em coordenadas do mapa (crescem com o zoom, como a miniatura numa
 *  mesa de verdade). A mesa não vê peão oculto nem peão sob a névoa — só o
 *  Mestre, e cada jogador o dele. */
function desenharPecas(
  ctx: CanvasRenderingContext2D,
  pecas: readonly PecaNaTela[],
  mestre: boolean,
  coberta: (x: number, y: number) => boolean,
  arrasto: { id: string; x: number; y: number } | null,
): void {
  for (const p of pecas) {
    const x = arrasto?.id === p.id ? arrasto.x : p.x;
    const y = arrasto?.id === p.id ? arrasto.y : p.y;
    if (!mestre && !p.semNevoa && (p.oculto || coberta(x, y))) continue;
    const r = p.diametro / 2;
    ctx.save();
    ctx.globalAlpha = mestre && p.oculto ? 0.55 : 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = p.cor;
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.strokeStyle = "#fff";
    if (mestre && p.oculto) ctx.setLineDash([r * 0.35, r * 0.25]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (p.vez) {
      ctx.beginPath();
      ctx.arc(x, y, r * 1.16, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(3, r * 0.16);
      ctx.strokeStyle = COR_VEZ;
      ctx.stroke();
    }
    if (p.selecionada) {
      ctx.beginPath();
      ctx.arc(x, y, r * 1.34, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.setLineDash([r * 0.3, r * 0.2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Letras com contorno escuro: legíveis sobre qualquer cor de peão.
    ctx.font = `700 ${Math.round(r * (p.rotulo.length > 2 ? 0.7 : 0.9))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.strokeText(p.rotulo, x, y + r * 0.04);
    ctx.fillStyle = "#fff";
    ctx.fillText(p.rotulo, x, y + r * 0.04);
    ctx.restore();
  }
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

/** Raio máximo do pulso na tela, em px: o mesmo tamanho em qualquer zoom (um
 *  ping sobre o mapa inteiro não pode virar um ponto invisível). */
const RAIO_PING = 52;

/** Desenha os pings por cima de tudo, em coordenadas da TELA (não do mapa), pra
 *  o pulso ter sempre o mesmo tamanho. Ping fora da parte visível vira uma seta
 *  na borda apontando pra ele. Devolve quantos estão vivos: quem chama continua
 *  pedindo quadro enquanto for maior que zero. */
export function desenharPings(
  ctx: CanvasRenderingContext2D,
  pings: readonly PingNaTela[],
  vista: Vista,
  larguraTela: number,
  alturaTela: number,
  dpr: number,
  agora: number,
): number {
  let vivos = 0;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  for (const p of pings) {
    const anim = animacaoDoPing(agora - p.chegouEm);
    if (!anim) continue;
    vivos++;
    const [sx, sy] = mapaParaTela(vista, p.x, p.y);
    const borda = pontoNaBorda(sx, sy, larguraTela, alturaTela);
    if (borda) {
      desenharSeta(ctx, borda.x, borda.y, borda.angulo, p.cor, anim.ponto);
      continue;
    }
    for (const anel of anim.aneis) {
      ctx.globalAlpha = anel.alfa;
      ctx.strokeStyle = p.cor;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 8 + RAIO_PING * anel.raio, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = anim.ponto;
    ctx.fillStyle = p.cor;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    desenharNome(ctx, p.de, sx, sy - 18, p.cor);
  }
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return vivos;
}

/** O nome de quem pingou, com contorno escuro pra ler sobre qualquer mapa. */
function desenharNome(ctx: CanvasRenderingContext2D, nome: string, x: number, y: number, cor: string): void {
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(nome, x, y);
  ctx.fillStyle = cor;
  ctx.fillText(nome, x, y);
}

function desenharSeta(ctx: CanvasRenderingContext2D, x: number, y: number, angulo: number, cor: string, alfa: number): void {
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.translate(x, y);
  ctx.rotate(angulo);
  ctx.fillStyle = cor;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-8, 9);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-8, -9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** A régua que está sendo arrastada agora neste aparelho (ainda não enviada). */
export type PreviaDeRegua = { a: Ponto; b: Ponto; modo: ModoRegua; cor: string; desloc: number | null };

/** Desenha as réguas (e a prévia da que está sendo arrastada) por cima de tudo,
 *  em coordenadas da TELA: a linha liga os pontos medidos e uma etiqueta no meio
 *  diz "4 quadrados · 6 m". Na grade os extremos são os centros dos quadradinhos
 *  (é o que a regra conta); em linha reta a linha é tracejada. Devolve quantas
 *  estão vivas, pro laço de quadros continuar. */
export function desenharReguas(
  ctx: CanvasRenderingContext2D,
  cena: CenaParaRegua,
  reguas: readonly ReguaNaTela[],
  previa: PreviaDeRegua | null,
  vista: Vista,
  larguraTela: number,
  alturaTela: number,
  dpr: number,
  agora: number,
): number {
  let vivas = 0;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  const desenhar = (r: { a: Ponto; b: Ponto; modo: ModoRegua; cor: string; desloc: number | null; de?: string }, opacidade: number) => {
    const m = medirRegua(cena, r.a, r.b, r.modo);
    const [x1, y1] = mapaParaTela(vista, m.a[0], m.a[1]);
    const [x2, y2] = mapaParaTela(vista, m.b[0], m.b[1]);
    ctx.globalAlpha = opacidade;
    // Sem distância ainda (o dedo acabou de encostar): só o ponto de partida, sem etiqueta.
    if (m.quadrados === 0) {
      ctx.beginPath();
      ctx.arc(x1, y1, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = r.cor;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#000";
      ctx.stroke();
      return;
    }
    ctx.lineCap = "round";
    ctx.setLineDash(m.modo === "reta" ? [9, 7] : []);
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = r.cor;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [x, y] of [[x1, y1], [x2, y2]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = r.cor;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#000";
      ctx.stroke();
    }
    // Etiqueta: a medida numa linha e, se houver, "cabe/passa" na outra. Se ainda
    // assim for mais larga que a tela (celular pequeno), a letra encolhe.
    const { principal, detalhe } = partesDoRotulo(m, r.desloc);
    const linhas = [(r.de ? `${r.de}: ` : "") + principal, ...(detalhe ? [detalhe] : [])];
    let fonte = 13;
    let largura = 0;
    for (; fonte >= 9; fonte--) {
      ctx.font = `600 ${fonte}px system-ui, sans-serif`;
      largura = Math.max(...linhas.map((l) => ctx.measureText(l).width)) + 18;
      if (largura <= larguraTela - 8) break;
    }
    const alturaEtiqueta = linhas.length * (fonte + 6) + 8;
    // No meio da linha, sem sair da tela (e centrada quando ocupa a tela toda).
    const cx = largura >= larguraTela - 8 ? larguraTela / 2 : Math.min(larguraTela - largura / 2 - 4, Math.max(largura / 2 + 4, (x1 + x2) / 2));
    const cy = Math.min(alturaTela - alturaEtiqueta / 2 - 4, Math.max(alturaEtiqueta / 2 + 4, (y1 + y2) / 2 - 10 - alturaEtiqueta / 2));
    ctx.fillStyle = "rgba(0,0,0,0.82)";
    ctx.strokeStyle = r.cor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - largura / 2, cy - alturaEtiqueta / 2, largura, alturaEtiqueta, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    linhas.forEach((l, k) => ctx.fillText(l, cx, cy - alturaEtiqueta / 2 + 4 + (k + 0.5) * (fonte + 6)));
  };
  for (const r of reguas) {
    const opacidade = opacidadeDaRegua(agora - r.chegouEm);
    if (opacidade === null) continue;
    vivas++;
    desenhar(r, opacidade);
  }
  if (previa) desenhar(previa, 1);
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return vivas;
}
