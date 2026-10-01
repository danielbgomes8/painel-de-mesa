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
import { iconesVisiveis, posicoesDosIcones, type PecaNaTela } from "./pecas";
import { medirRegua, opacidadeDaRegua, partesDoRotulo, type CenaParaRegua, type ModoRegua, type ReguaNaTela } from "./regua";
import { formaNoMapa, opacidadeDaArea, rotuloDaArea, type AreaNaTela, type ModeloArea } from "./area";
import type { Parede } from "./paredes";
import type { Mascara } from "./visao";

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

/** Compõe a névoa que a mesa de fato vê quando a visão automática está ligada:
 *  a névoa feita à mão (`fino`) com buracos por cima — o que o grupo JÁ viu
 *  (a memória, escurecido: metade clara) e o que vê AGORA (aberto de vez).
 *  Revelar à mão continua valendo; esconder à mão não segura contra a visão. */
export function comporNevoaComVisao(
  destino: HTMLCanvasElement,
  fino: HTMLCanvasElement,
  cena: Pick<Cena, "largura" | "altura">,
  agora: readonly (readonly Ponto[])[],
  memoria: Mascara | null,
): void {
  if (destino.width !== fino.width) destino.width = fino.width;
  if (destino.height !== fino.height) destino.height = fino.height;
  const ctx = destino.getContext("2d");
  if (!ctx) return;
  const fs = fino.width / Math.max(1, cena.largura);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, destino.width, destino.height);
  ctx.drawImage(fino, 0, 0);
  ctx.globalCompositeOperation = "destination-out";
  ctx.setTransform(fs, 0, 0, fs, 0, 0);
  if (memoria) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#000";
    // +0,5 px de folga em cada célula pra não aparecer fresta entre elas.
    for (let r = 0; r < memoria.rows; r++) {
      for (let c = 0; c < memoria.cols; c++) {
        if (memoria.celulas[r * memoria.cols + c]) ctx.fillRect(c * memoria.lado - 0.5, r * memoria.lado - 0.5, memoria.lado + 1, memoria.lado + 1);
      }
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#000";
  for (const poli of agora) {
    if (poli.length < 3) continue;
    ctx.beginPath();
    poli.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Paredes e portas, só pro Mestre: vermelho = parede, dourado = porta (cheia
 *  fechada, tracejada aberta). A mesa nunca vê isso — só o desenho do mapa. */
export function desenharParedes(
  ctx: CanvasRenderingContext2D,
  paredes: readonly Parede[],
  escala: number,
  previa: { tipo: "parede" | "porta" | "comodo"; a: Ponto; b: Ponto } | { tipo: "curva"; pontos: readonly Ponto[] } | null,
): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  /** `passada`: "contorno" (o preto por baixo), "cor", ou as duas de uma vez. */
  const traco = (x1: number, y1: number, x2: number, y2: number, cor: string, largura: number, tracejada: boolean, passada: "contorno" | "cor" | "tudo" = "tudo") => {
    ctx.setLineDash(tracejada ? [7 / escala, 6 / escala] : []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    if (passada !== "cor") {
      ctx.lineWidth = (largura + 2.5) / escala;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.stroke();
    }
    if (passada !== "contorno") {
      ctx.lineWidth = largura / escala;
      ctx.strokeStyle = cor;
      ctx.stroke();
    }
  };
  // Todos os contornos primeiro e as cores depois: desenhando parede por parede,
  // o contorno preto de cada uma caía por cima da ponta da vizinha — numa curva
  // (dezenas de trechos emendados) a parede parecia tracejada.
  for (const passada of ["contorno", "cor"] as const) {
    for (const p of paredes) {
      if (p.tipo === "porta") traco(p.x1, p.y1, p.x2, p.y2, "#f0b030", 4, p.aberta, passada);
      else traco(p.x1, p.y1, p.x2, p.y2, "#e0504f", 3, false, passada);
    }
  }
  if (previa && previa.tipo === "curva") {
    // O traço como o dedo fez; ao soltar ele vira os trechos retos de verdade.
    ctx.globalAlpha = 0.9;
    for (const passada of ["contorno", "cor"] as const) {
      for (let i = 1; i < previa.pontos.length; i++) {
        traco(previa.pontos[i - 1][0], previa.pontos[i - 1][1], previa.pontos[i][0], previa.pontos[i][1], "#e0504f", 3, false, passada);
      }
    }
    ctx.globalAlpha = 1;
  } else if (previa) {
    const [ax, ay] = previa.a;
    const [bx, by] = previa.b;
    ctx.globalAlpha = 0.9;
    if (previa.tipo === "comodo") {
      for (const [x1, y1, x2, y2] of [[ax, ay, bx, ay], [bx, ay, bx, by], [bx, by, ax, by], [ax, by, ax, ay]] as const) {
        traco(x1, y1, x2, y2, "#e0504f", 3, true);
      }
    } else {
      traco(ax, ay, bx, by, previa.tipo === "porta" ? "#f0b030" : "#e0504f", previa.tipo === "porta" ? 4 : 3, true);
    }
    ctx.globalAlpha = 1;
  }
  ctx.setLineDash([]);
}

/** O que cada inimigo enxerga, só pro Mestre: um véu vermelho com contorno
 *  (pra saber se o goblin está vendo o grupo). Não abre névoa pra mesa. */
export function desenharVisaoDosInimigos(ctx: CanvasRenderingContext2D, poligonos: readonly (readonly Ponto[])[], escala: number): void {
  ctx.lineJoin = "round";
  for (const poli of poligonos) {
    if (poli.length < 3) continue;
    ctx.beginPath();
    poli.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = "rgba(226, 75, 74, 0.16)";
    ctx.fill();
    ctx.lineWidth = 2 / escala;
    ctx.strokeStyle = "rgba(226, 75, 74, 0.7)";
    ctx.stroke();
  }
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
  /** Só pro Mestre: as paredes e portas, a parede em construção e a visão dos inimigos. */
  paredes?: readonly Parede[];
  previaParede?: { tipo: "parede" | "porta" | "comodo"; a: Ponto; b: Ponto } | { tipo: "curva"; pontos: readonly Ponto[] } | null;
  visaoDosInimigos?: readonly (readonly Ponto[])[];
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

  // O que só o Mestre enxerga: sai de baixo dos peões (que ficam por cima).
  if (e.mestre) {
    if (e.visaoDosInimigos && e.visaoDosInimigos.length > 0) desenharVisaoDosInimigos(ctx, e.visaoDosInimigos, vista.escala);
    if ((e.paredes && e.paredes.length > 0) || e.previaParede) desenharParedes(ctx, e.paredes ?? [], vista.escala, e.previaParede ?? null);
  }

  if (e.pecas && e.pecas.length > 0) {
    desenharPecas(ctx, e.pecas, e.mestre, e.pecaCoberta ?? (() => false), e.arrasto ?? null, vista.escala);
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
  escala: number,
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
    desenharIcones(ctx, p, x, y, r, escala);
    ctx.restore();
  }
}

/** Fonte de emoji de cada sistema (o `system-ui` sozinho não garante). */
const FONTE_EMOJI = `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif`;

/** As condições do peão: bolinhas coloridas com um emoji, sobre a borda, por
 *  cima de anel de vez e de seleção. Com mais de quatro, o resto vira "+N".
 *  O tamanho acompanha o peão, mas nunca fica menor que ~7 px na tela (num mapa
 *  afastado o peão é pequeno e o ícone ainda precisa ser reconhecível) nem
 *  maior que meio peão. */
function desenharIcones(ctx: CanvasRenderingContext2D, p: PecaNaTela, x: number, y: number, r: number, escala: number): void {
  if (p.icones.length === 0) return;
  const { mostrar, extras } = iconesVisiveis(p.icones);
  const raio = Math.min(r * 0.55, Math.max(r * 0.38, 7 / escala));
  const lugares = posicoesDosIcones(mostrar.length + (extras > 0 ? 1 : 0), r, raio);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const bolinha = (cx: number, cy: number, cor: string) => {
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, raio * 0.16);
    ctx.strokeStyle = "#fff";
    ctx.stroke();
  };
  mostrar.forEach((icone, i) => {
    const cx = x + lugares[i].dx;
    const cy = y + lugares[i].dy;
    bolinha(cx, cy, icone.cor);
    ctx.font = `${Math.round(raio * 1.2)}px ${FONTE_EMOJI}`;
    ctx.fillStyle = "#fff";
    ctx.fillText(icone.emoji, cx, cy + raio * 0.06);
    if (icone.nivel) {
      // O nível da exaustão, pequeno, no canto de baixo à direita da bolinha.
      ctx.font = `800 ${Math.round(raio * 0.85)}px system-ui, sans-serif`;
      ctx.lineWidth = Math.max(2, raio * 0.3);
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(String(icone.nivel), cx + raio * 0.7, cy + raio * 0.7);
      ctx.fillStyle = "#fff";
      ctx.fillText(String(icone.nivel), cx + raio * 0.7, cy + raio * 0.7);
    }
  });
  if (extras > 0) {
    const cx = x + lugares[mostrar.length].dx;
    const cy = y + lugares[mostrar.length].dy;
    bolinha(cx, cy, "#2b2620");
    ctx.font = `700 ${Math.round(raio * 0.95)}px system-ui, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.fillText(`+${extras}`, cx, cy + raio * 0.04);
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

/** Caixinha escura com texto (uma linha por item de `linhas`), acima do ponto
 *  `(ax, ay)` da tela e sem sair dela. Se a etiqueta for mais larga que a tela
 *  (celular pequeno) a letra encolhe, e quando ocupa a tela toda fica centrada. */
function desenharEtiqueta(
  ctx: CanvasRenderingContext2D,
  linhas: readonly string[],
  ax: number,
  ay: number,
  larguraTela: number,
  alturaTela: number,
  cor: string,
): void {
  let fonte = 13;
  let largura = 0;
  for (; fonte >= 9; fonte--) {
    ctx.font = `600 ${fonte}px system-ui, sans-serif`;
    largura = Math.max(...linhas.map((l) => ctx.measureText(l).width)) + 18;
    if (largura <= larguraTela - 8) break;
  }
  const alturaEtiqueta = linhas.length * (fonte + 6) + 8;
  const cx = largura >= larguraTela - 8 ? larguraTela / 2 : Math.min(larguraTela - largura / 2 - 4, Math.max(largura / 2 + 4, ax));
  const cy = Math.min(alturaTela - alturaEtiqueta / 2 - 4, Math.max(alturaEtiqueta / 2 + 4, ay - alturaEtiqueta / 2));
  ctx.fillStyle = "rgba(0,0,0,0.82)";
  ctx.strokeStyle = cor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - largura / 2, cy - alturaEtiqueta / 2, largura, alturaEtiqueta, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  linhas.forEach((l, k) => ctx.fillText(l, cx, cy - alturaEtiqueta / 2 + 4 + (k + 0.5) * (fonte + 6)));
}

/** A área de magia que está sendo arrastada agora neste aparelho (ainda não enviada). */
export type PreviaDeArea = { modelo: ModeloArea; o: Ponto; d: Ponto; cor: string };

/** Desenha os modelos de magia (e a prévia do que está sendo arrastado) sobre o
 *  mapa: a figura em cor translúcida com contorno, a origem marcada e uma
 *  etiqueta ("Mestre: Esfera · raio 6 m"). Em coordenadas do mapa, então a figura
 *  cobre o que cobre de verdade, em qualquer zoom. Devolve quantas estão vivas,
 *  pro laço de quadros continuar. */
export function desenharAreas(
  ctx: CanvasRenderingContext2D,
  cena: Pick<Cena, "grade_px" | "metros">,
  areas: readonly AreaNaTela[],
  previa: PreviaDeArea | null,
  vista: Vista,
  larguraTela: number,
  alturaTela: number,
  dpr: number,
  agora: number,
): number {
  let vivas = 0;
  const desenhar = (a: { forma: ModeloArea["forma"]; o: Ponto; d: Ponto; metros: number; largura: number; cor: string; de?: string }, opacidade: number) => {
    const figura = formaNoMapa(cena, a);
    ctx.setTransform(dpr * vista.escala, 0, 0, dpr * vista.escala, dpr * vista.tx, dpr * vista.ty);
    ctx.beginPath();
    if (figura.tipo === "circulo") {
      ctx.arc(figura.centro[0], figura.centro[1], figura.raio, 0, Math.PI * 2);
    } else {
      figura.pontos.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
    }
    ctx.globalAlpha = opacidade * 0.3;
    ctx.fillStyle = a.cor;
    ctx.fill();
    ctx.globalAlpha = opacidade;
    ctx.lineJoin = "round";
    ctx.lineWidth = 5 / vista.escala;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.stroke();
    ctx.lineWidth = 2.5 / vista.escala;
    ctx.strokeStyle = a.cor;
    ctx.stroke();

    // Origem e etiqueta, em coordenadas da tela (tamanho fixo em qualquer zoom).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const [ox, oy] = mapaParaTela(vista, a.o[0], a.o[1]);
    ctx.beginPath();
    ctx.arc(ox, oy, 5, 0, Math.PI * 2);
    ctx.fillStyle = a.cor;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000";
    ctx.stroke();
    const pontos = figura.tipo === "circulo" ? [[figura.centro[0], figura.centro[1] - figura.raio]] : figura.pontos;
    const telaDos = pontos.map(([x, y]) => mapaParaTela(vista, x, y));
    const topo = Math.min(...telaDos.map((q) => q[1]));
    const meio = telaDos.reduce((soma, q) => soma + q[0], 0) / telaDos.length;
    desenharEtiqueta(ctx, [(a.de ? `${a.de}: ` : "") + rotuloDaArea(a)], meio, topo - 8, larguraTela, alturaTela, a.cor);
  };
  for (const a of areas) {
    const opacidade = opacidadeDaArea(agora - a.chegouEm);
    if (opacidade === null) continue;
    vivas++;
    desenhar(a, opacidade);
  }
  if (previa) desenhar({ ...previa.modelo, o: previa.o, d: previa.d, cor: previa.cor }, 1);
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return vivas;
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
    const { principal, detalhe } = partesDoRotulo(m, r.desloc);
    const linhas = [(r.de ? `${r.de}: ` : "") + principal, ...(detalhe ? [detalhe] : [])];
    // No meio da linha, sem sair da tela.
    desenharEtiqueta(ctx, linhas, (x1 + x2) / 2, (y1 + y2) / 2 - 10, larguraTela, alturaTela, r.cor);
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
