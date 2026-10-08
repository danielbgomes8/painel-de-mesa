/**
 * Importar paredes e portas de um arquivo (ou de um texto colado) — as regras
 * puras: entender o texto, levar as coordenadas pro tamanho da cena e fechar as
 * frestas entre pontas que deviam se encontrar.
 *
 * Pra que serve: desenhar um mapa grande à mão cansa. O Mestre manda a imagem do
 * mapa pra uma IA que enxerga imagens, junto com o pedido de `pedidoDeParedes`,
 * e cola aqui a resposta. A IA acerta a planta, mas erra alguns pixels e às vezes
 * deixa um canto sem fechar — e uma fresta deixa a visão vazar. Por isso o
 * resultado é um RASCUNHO: entra no mapa, o Mestre confere e corrige com a
 * ferramenta de paredes (ou tira tudo com "↩ desfazer parede").
 *
 * O formato do arquivo:
 *   { "largura": 760, "altura": 760,
 *     "paredes": [[x1, y1, x2, y2], ...],
 *     "portas":  [[x1, y1, x2, y2], ...] }
 * `largura` e `altura` dizem em que tamanho de imagem as coordenadas foram
 * escritas (o app guarda a cena reduzida, então quase nunca é o tamanho da cena).
 * Cada item também pode ser { x1, y1, x2, y2 } — e a porta, { ..., "aberta": true }.
 */
import type { Cena, Ponto } from "./cenas";
import { PAREDES_MAXIMAS, PAREDE_MINIMA_PX, type NovaParede, type Parede } from "./paredes";

/** Pontas a menos que isso uma da outra (fração do lado maior do mapa) viram a mesma ponta. */
export const ENCAIXE_DA_IMPORTACAO = 0.015;
/** Quanto (px da cena) a parede esticada num "T" passa da parede em que bateu. */
const SOBRA_DO_T_PX = 0.5;
/** Abaixo disso (px) a ponta já está em cima da outra parede: não há fresta. */
const ENCOSTA_PX = 1e-6;
/** Texto maior que isso não é uma lista de paredes (400 paredes dão uns 15 mil caracteres). */
export const TEXTO_MAXIMO_DA_IMPORTACAO = 200_000;

type CenaDaImportacao = Pick<Cena, "largura" | "altura">;
type Pontas = Pick<Parede, "x1" | "y1" | "x2" | "y2">;

export type LeituraDeParedes =
  | {
      ok: true;
      novas: NovaParede[];
      paredes: number;
      portas: number;
      /** Itens que não deu pra aproveitar (linha torta, ou curta demais pra ser parede). */
      ignoradas: number;
      /** Pontas que foram puxadas pra fechar fresta. */
      emendadas: number;
      /** O arquivo não disse o tamanho da imagem: as coordenadas valeram como px desta cena. */
      semMedida: boolean;
    }
  | { ok: false; erro: string };

function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** O JSON de dentro do texto: a IA costuma embrulhar em ```json … ``` ou pôr uma frase antes. */
function extrairJson(texto: string): unknown {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return undefined;
  try {
    return JSON.parse(texto.slice(inicio, fim + 1));
  } catch {
    return undefined;
  }
}

function lerItem(item: unknown): { seg: [number, number, number, number]; aberta: boolean } | null {
  if (Array.isArray(item)) {
    const [x1, y1, x2, y2] = [numero(item[0]), numero(item[1]), numero(item[2]), numero(item[3])];
    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
    return { seg: [x1, y1, x2, y2], aberta: false };
  }
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const [x1, y1, x2, y2] = [numero(o.x1), numero(o.y1), numero(o.x2), numero(o.y2)];
  if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
  return { seg: [x1, y1, x2, y2], aberta: o.aberta === true };
}

function arredondar(v: number): number {
  return Math.round(v * 10) / 10;
}

function comprimento(p: Pontas): number {
  return Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
}

/** O ponto do segmento mais perto de `p`. */
function pontoMaisPertoNoSegmento(p: Ponto, s: Pontas): Ponto {
  const sx = s.x2 - s.x1;
  const sy = s.y2 - s.y1;
  const quad = sx * sx + sy * sy;
  const k = quad === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - s.x1) * sx + (p[1] - s.y1) * sy) / quad));
  return [s.x1 + k * sx, s.y1 + k * sy];
}

function distancia(a: Ponto, b: Ponto): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Quanto a parede precisa crescer, na própria direção `u` a partir da ponta `p`,
 *  pra bater em `o`; Infinity se não bate. */
function quantoFaltaAte(p: Ponto, u: Ponto, o: Pontas): number {
  const dx = o.x2 - o.x1;
  const dy = o.y2 - o.y1;
  const den = u[0] * dy - u[1] * dx;
  if (Math.abs(den) < 1e-9) return Infinity; // paralelas
  const qx = o.x1 - p[0];
  const qy = o.y1 - p[1];
  const t = (qx * dy - qy * dx) / den;
  const s = (qx * u[1] - qy * u[0]) / den;
  return t > 0 && s >= -1e-9 && s <= 1 + 1e-9 ? t : Infinity;
}

/**
 * Fecha as frestas de um lote de paredes novas. Nunca muda de lugar uma linha
 * que veio do arquivo (nem as que já existem na cena): só ESTICA a parede na
 * direção dela ou ACRESCENTA um trechinho de ligação. Mover uma ponta pra fechar
 * um canto parece mais simples, mas entorta a parede — e abre fresta em todo "T"
 * que estava fechado no meio dela (achado testando com um mapa de verdade).
 *
 * Só olha ponta SOLTA, a que não encosta em nenhuma outra parede; canto fechado
 * e "T" fechado ficam como vieram. Pra cada ponta solta, na ordem:
 *  1. se esticando a parede ela bate em outra logo ali, estica (o "T" fecha);
 *  2. senão, se há a ponta de outra parede por perto, um trechinho liga as duas;
 *  3. senão, se passa rente ao meio de outra parede, o trechinho vai até ela.
 * "Perto" é `tolerancia` (px da cena). Devolve as paredes (os trechinhos no fim)
 * e quantas frestas fechou. O que fica pro Mestre: canto de um cômodo perto do
 * canto de outro, sem ponta solta no meio.
 */
export function soldarPontas(novas: readonly NovaParede[], existentes: readonly Pontas[], tolerancia: number): { paredes: NovaParede[]; emendadas: number } {
  const saida: NovaParede[] = novas.map((p) => ({ ...p }));
  let emendadas = 0;
  if (tolerancia <= 0) return { paredes: saida, emendadas };

  // Só as que vieram do arquivo: os trechinhos entram no fim e já nascem encaixados.
  const doArquivo = saida.length;
  for (let i = 0; i < doArquivo; i++) {
    const p = saida[i];
    for (const ponta of ["1", "2"] as const) {
      const [kx, ky] = ponta === "1" ? (["x1", "y1"] as const) : (["x2", "y2"] as const);
      const aqui: Ponto = [p[kx], p[ky]];
      const outraPonta: Ponto = ponta === "1" ? [p.x2, p.y2] : [p.x1, p.y1];
      const resto: Pontas[] = [...existentes, ...saida.filter((o) => o !== p)];
      if (resto.some((o) => distancia(aqui, pontoMaisPertoNoSegmento(aqui, o)) <= ENCOSTA_PX)) continue;

      // 1. Esticar na própria direção.
      const tamanho = distancia(outraPonta, aqui);
      const u: Ponto = [(aqui[0] - outraPonta[0]) / tamanho, (aqui[1] - outraPonta[1]) / tamanho];
      const falta = Math.min(...resto.map((o) => quantoFaltaAte(aqui, u, o)));
      if (falta <= tolerancia) {
        // Passa um tiquinho da parede alvo: cruzar não faz mal, e encostar "quase"
        // (erro de conta numa parede inclinada) deixaria um fio de fresta.
        p[kx] = Math.round((aqui[0] + u[0] * (falta + SOBRA_DO_T_PX)) * 100) / 100;
        p[ky] = Math.round((aqui[1] + u[1] * (falta + SOBRA_DO_T_PX)) * 100) / 100;
        emendadas++;
        continue;
      }

      // 2. A ponta de outra parede por perto (a que já está em cima desta não conta:
      //    ali não há fresta).
      const emCimaDesta = (q: Ponto) => distancia(q, pontoMaisPertoNoSegmento(q, p)) <= ENCOSTA_PX;
      let alvo: Ponto | null = null;
      let menor = tolerancia;
      for (const o of resto) {
        for (const q of [[o.x1, o.y1], [o.x2, o.y2]] as const) {
          const d = distancia(aqui, q);
          if (d <= menor && !emCimaDesta(q)) {
            menor = d;
            alvo = q;
          }
        }
      }
      if (alvo) {
        saida.push({ tipo: "parede", x1: aqui[0], y1: aqui[1], x2: alvo[0], y2: alvo[1] });
        emendadas++;
        continue;
      }

      // 3. Rente ao meio de outra parede.
      for (const o of resto) {
        const q = pontoMaisPertoNoSegmento(aqui, o);
        const d = distancia(aqui, q);
        if (d <= menor && !emCimaDesta(q)) {
          menor = d;
          alvo = q;
        }
      }
      if (alvo) {
        saida.push({ tipo: "parede", x1: aqui[0], y1: aqui[1], x2: alvo[0], y2: alvo[1] });
        emendadas++;
      }
    }
  }
  return { paredes: saida, emendadas };
}

/**
 * Lê o texto do arquivo (ou colado) e devolve as paredes prontas pra entrar na
 * cena, já no tamanho dela, presas dentro do mapa e com as frestas fechadas — ou
 * o motivo, em português de mesa, de não ter dado. Não grava nada.
 */
export function lerParedesDoTexto(texto: string, cena: CenaDaImportacao, existentes: readonly Pontas[]): LeituraDeParedes {
  if (!texto.trim()) return { ok: false, erro: "Cole o texto ou escolha o arquivo com as paredes." };
  if (texto.length > TEXTO_MAXIMO_DA_IMPORTACAO) return { ok: false, erro: "Esse texto é grande demais pra ser uma lista de paredes." };
  if (cena.largura <= 0 || cena.altura <= 0) return { ok: false, erro: "Este mapa ainda não tem tamanho; espere a imagem carregar." };

  const bruto = extrairJson(texto);
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) {
    return { ok: false, erro: "Não entendi o texto. Ele precisa ser a resposta inteira da IA, com as chaves { } do começo e do fim." };
  }
  const o = bruto as Record<string, unknown>;
  const listaParedes = Array.isArray(o.paredes) ? o.paredes : [];
  const listaPortas = Array.isArray(o.portas) ? o.portas : [];
  if (listaParedes.length + listaPortas.length === 0) {
    return { ok: false, erro: "Não achei nenhuma parede nem porta: o texto precisa ter a lista “paredes” (e, se houver, “portas”)." };
  }

  const temLargura = o.largura !== undefined && o.largura !== null;
  const temAltura = o.altura !== undefined && o.altura !== null;
  let fx = 1;
  let fy = 1;
  if (temLargura || temAltura) {
    const [l, a] = [numero(o.largura), numero(o.altura)];
    if (l === null || a === null || l <= 0 || a <= 0) {
      return { ok: false, erro: "“largura” e “altura” precisam ser os dois números do tamanho da imagem em que as paredes foram medidas." };
    }
    fx = cena.largura / l;
    fy = cena.altura / a;
  }

  let ignoradas = 0;
  const lidas: NovaParede[] = [];
  const prender = (v: number, maximo: number) => arredondar(Math.min(maximo, Math.max(0, v)));
  for (const [lista, tipo] of [[listaParedes, "parede"], [listaPortas, "porta"]] as const) {
    for (const item of lista) {
      const lido = lerItem(item);
      if (!lido) {
        ignoradas++;
        continue;
      }
      const nova: NovaParede = {
        tipo,
        x1: prender(lido.seg[0] * fx, cena.largura),
        y1: prender(lido.seg[1] * fy, cena.altura),
        x2: prender(lido.seg[2] * fx, cena.largura),
        y2: prender(lido.seg[3] * fy, cena.altura),
        ...(tipo === "porta" ? { aberta: lido.aberta } : {}),
      };
      if (comprimento(nova) < PAREDE_MINIMA_PX) {
        ignoradas++;
        continue;
      }
      lidas.push(nova);
    }
  }
  if (lidas.length === 0) return { ok: false, erro: "Nenhuma linha do texto virou parede: confira se cada uma tem os quatro números (x1, y1, x2, y2)." };

  const { paredes: novas, emendadas } = soldarPontas(lidas, existentes, Math.max(cena.largura, cena.altura) * ENCAIXE_DA_IMPORTACAO);
  // Depois de fechar as frestas: os trechinhos que entraram contam no limite.
  const cabem = PAREDES_MAXIMAS - existentes.length;
  if (novas.length > cabem) {
    return {
      ok: false,
      erro: `O texto dá ${novas.length} paredes e portas, e neste mapa só cabem mais ${Math.max(0, cabem)} (o máximo é ${PAREDES_MAXIMAS}). Apague as que já existem ou peça um desenho com menos trechos.`,
    };
  }
  return {
    ok: true,
    novas,
    paredes: novas.filter((p) => p.tipo === "parede").length,
    portas: novas.filter((p) => p.tipo === "porta").length,
    ignoradas,
    emendadas,
    semMedida: !(temLargura || temAltura),
  };
}

/**
 * O pedido que o Mestre manda pra IA junto com a imagem do mapa. Diz o tamanho
 * da cena pra as coordenadas já virem na medida dela (a IA enxerga proporção, não
 * pixel: vale mesmo que a imagem enviada seja maior que a guardada no app).
 */
export function pedidoDeParedes(cena: CenaDaImportacao): string {
  return [
    "Esta imagem é um mapa de RPG visto de cima. Quero as paredes e as portas dele como segmentos de reta, pra um app que calcula o que os personagens enxergam.",
    "",
    `Considere que a imagem tem ${cena.largura} de largura por ${cena.altura} de altura, com (0, 0) no canto de cima à esquerda, x crescendo pra direita e y pra baixo. Todas as coordenadas são nessa medida.`,
    "",
    "Regras:",
    "- Cada parede é um segmento [x1, y1, x2, y2] passando pelo MEIO da espessura da parede desenhada.",
    "- Parede comprida e reta é um segmento só. Parede curva vira poucos segmentos retos.",
    "- Onde duas paredes se encontram, use exatamente as mesmas coordenadas nas duas pontas: não pode sobrar fresta em canto nenhum.",
    "- Onde há uma porta, interrompa a parede e ponha a porta como um segmento que fecha a abertura inteira, na mesma linha da parede.",
    "- Passagem aberta (sem porta) fica sem nada.",
    "- Marque só o que bloqueia a passagem e a vista: nada de móveis, tapetes, escadas, legenda, texto, bússola ou borda do papel.",
    `- No máximo ${PAREDES_MAXIMAS} segmentos somando paredes e portas.`,
    "",
    "Responda só com o JSON, sem explicação, neste formato:",
    `{"largura": ${cena.largura}, "altura": ${cena.altura}, "paredes": [[x1, y1, x2, y2]], "portas": [[x1, y1, x2, y2]]}`,
  ].join("\n");
}

/**
 * As paredes da borda da imagem que ainda faltam — pra mapa cortado rente às paredes de fora
 * (uma taverna, uma casa): sem elas a visão do grupo "vaza" pra fora do mapa. Um lado que já tem
 * parede correndo junto dele (a até `perto` px, cobrindo quase tudo) não ganha outra.
 */
export function contornoQueFalta(cena: CenaDaImportacao, existentes: readonly Pontas[], perto = Math.max(cena.largura, cena.altura) * 0.02): NovaParede[] {
  const { largura: w, altura: h } = cena;
  const lados: NovaParede[] = [
    { tipo: "parede", x1: 0, y1: 0, x2: w, y2: 0 },
    { tipo: "parede", x1: w, y1: 0, x2: w, y2: h },
    { tipo: "parede", x1: 0, y1: h, x2: w, y2: h },
    { tipo: "parede", x1: 0, y1: 0, x2: 0, y2: h },
  ];
  return lados.filter((lado) => {
    const horizontal = lado.y1 === lado.y2;
    const total = horizontal ? w : h;
    // Quanto do lado já está coberto por paredes paralelas coladas nele (intervalos unidos).
    const trechos = existentes
      .filter((p) => (horizontal ? Math.abs(p.y1 - lado.y1) <= perto && Math.abs(p.y2 - lado.y1) <= perto : Math.abs(p.x1 - lado.x1) <= perto && Math.abs(p.x2 - lado.x1) <= perto))
      .map((p) => (horizontal ? [Math.min(p.x1, p.x2), Math.max(p.x1, p.x2)] : [Math.min(p.y1, p.y2), Math.max(p.y1, p.y2)]))
      .sort((a, b) => a[0] - b[0]);
    let coberto = 0;
    let fim = 0;
    for (const [a, b] of trechos) {
      if (b <= fim) continue;
      coberto += b - Math.max(a, fim);
      fim = b;
    }
    return coberto < total * 0.9;
  });
}
