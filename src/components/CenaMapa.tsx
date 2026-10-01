"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import {
  ZOOM_MAXIMO,
  celulasNoSegmento,
  enquadrar,
  escalaMinima,
  gradeUsavel,
  limitarVista,
  raioDoPincel,
  regiaoVisivel,
  retanguloEntre,
  retangulosDasCelulas,
  simplificarTrilha,
  telaParaMapa,
  zoomEm,
  type Cena,
  type ModoNevoa,
  type NovaRegra,
  type Ponto,
  type RegraNevoa,
  type Regiao,
  type TamanhoPincel,
  type Vista,
} from "@/lib/cenas";
import {
  desenharCena,
  desenharNevoa,
  desenharPings,
  desenharAreas,
  desenharReguas,
  escalaDaNevoa,
  type FormaDesenhavel,
  type PreviaDeArea,
  type PreviaDeRegua,
} from "@/lib/desenharCena";
import { REGUA_MINIMA_PX, medirRegua, type ModoRegua, type ReguaNaTela } from "@/lib/regua";
import { MODELO_INICIAL, cruzamentoMaisPerto, type AreaNaTela, type ModeloArea } from "@/lib/area";
import { COR_PING_MESTRE } from "@/lib/ping";
import { acharPecaNoPonto, encaixarNaGrade, type PecaNaTela } from "@/lib/pecas";
import { PING_TOLERANCIA_PX, PING_TOQUE_LONGO_MS, type PingNaTela } from "@/lib/ping";

export type Ferramenta = "mover" | "quadradinhos" | "pincel" | "retangulo" | "ping" | "regua" | "area";

/** O que o Mestre pode pedir ao mapa de fora (botões "enquadrar", "levar a mesa"). */
export type CenaMapaApi = {
  /** Mostra o mapa inteiro. */
  enquadrarTudo: () => void;
  /** Volta à visão de partida: a câmera do Mestre (mesa) ou o mapa inteiro. */
  reenquadrar: () => void;
  /** O pedaço do mapa que a tela mostra agora, em px da imagem. */
  regiaoVisivel: () => Regiao | null;
};

type Props = {
  cena: Cena;
  /** Link da imagem; null enquanto a cena não tem imagem. */
  imagemUrl: string | null;
  regras: readonly RegraNevoa[];
  /** O Mestre enxerga o mapa através da névoa e pode pintá-la. */
  mestre: boolean;
  /** Telão: sem toque nem roda do mouse, só mostra. */
  interativo?: boolean;
  /** Acompanha a câmera que o Mestre definiu (mesa); o Mestre navega livre. */
  seguirCamera?: boolean;
  ferramenta?: Ferramenta;
  modoNevoa?: ModoNevoa;
  pincel?: TamanhoPincel;
  /** Chamado quando o Mestre solta uma pincelada. */
  aoPintar?: (nova: NovaRegra) => void;
  /** Pings na tela (de quem for) e como pingar. Sem `aoPingar`, o mapa só mostra. */
  pings?: readonly PingNaTela[];
  aoPingar?: (x: number, y: number) => void;
  /** Régua: o modo de medir, a cor da prévia (a de quem mede), as réguas na tela e
   *  o que fazer quando soltar (mostrar pra mesa). Só mede com a ferramenta "regua". */
  modoRegua?: ModoRegua;
  corRegua?: string;
  reguas?: readonly ReguaNaTela[];
  aoMedir?: (a: Ponto, b: Ponto, modo: ModoRegua, deslocamento: number | null) => void;
  /** Modelos de magia: a forma e o tamanho escolhidos, as áreas na tela e o que
   *  fazer quando soltar (mostrar pra mesa). Só desenha com a ferramenta "area". */
  modeloArea?: ModeloArea;
  areas?: readonly AreaNaTela[];
  aoAreaar?: (modelo: ModeloArea, origem: Ponto, direcao: Ponto) => void;
  /** Peões da cena (já calculados pro ponto de vista de quem olha). */
  pecas?: readonly PecaNaTela[];
  /** Soltou um peão num lugar novo (já encaixado na grade). */
  aoMoverPeca?: (id: string, x: number, y: number) => void;
  /** Tocou num peão (ou em lugar nenhum: null). */
  aoTocarPeca?: (id: string | null) => void;
  ref?: Ref<CenaMapaApi>;
};

type Pintura = {
  ferramenta: Exclude<Ferramenta, "mover" | "ping" | "regua" | "area">;
  modo: ModoNevoa;
  raio: number;
  pontos: Ponto[];
  inicio: Ponto;
  ultimo: Ponto;
  celulas: { col: number; row: number }[];
};

type Pinca = { distancia: number; vista: Vista; centro: { x: number; y: number }; ponto: Ponto };

/**
 * O mapa no canvas: imagem, grade e névoa, com zoom (pinça ou roda do mouse) e
 * arrastar. As contas moram em `lib/cenas.ts` (com teste) e o desenho em
 * `lib/desenharCena.ts`; aqui ficam só os gestos e o ciclo de desenho.
 *
 * O estado do gesto (vista, dedos na tela) vive em `ref`, não em `useState`:
 * um arrasto muda a vista dezenas de vezes por segundo e não pode redesenhar
 * a árvore do React a cada toque.
 */
export function CenaMapa({
  cena,
  imagemUrl,
  regras,
  mestre,
  interativo = true,
  seguirCamera = false,
  ferramenta = "mover",
  modoNevoa = "revelar",
  pincel = "m",
  aoPintar,
  pings,
  aoPingar,
  modoRegua = "grade",
  corRegua = COR_PING_MESTRE,
  reguas,
  aoMedir,
  modeloArea = MODELO_INICIAL,
  areas,
  aoAreaar,
  pecas,
  aoMoverPeca,
  aoTocarPeca,
  ref,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const nevoaRef = useRef<HTMLCanvasElement | null>(null);
  const imagemRef = useRef<HTMLImageElement | null>(null);
  const vistaRef = useRef<Vista>({ escala: 1, tx: 0, ty: 0 });
  const tamanhoRef = useRef({ w: 0, h: 0, dpr: 1 });
  const previaRef = useRef<{ modo: ModoNevoa; forma: FormaDesenhavel } | null>(null);
  const quadroRef = useRef(0);
  /** Já mexeram na vista com a mão: redimensionar a tela não a reenquadra. */
  const tocouRef = useRef(false);
  const dedos = useRef(new Map<number, { x: number; y: number }>());
  const pinca = useRef<Pinca | null>(null);
  const pintura = useRef<Pintura | null>(null);
  /** Dedo parado esperando virar ping (toque longo): onde começou e o relógio. */
  const toqueLongo = useRef<{ x: number; y: number; timer: number } | null>(null);
  /** Com a ferramenta ping, ou depois do ping, o dedo não arrasta o mapa. */
  const semArrastar = useRef(false);
  /** Peão sendo arrastado agora (posição em px do mapa; `moveu` = passou da tolerância). */
  const arrastoPeca = useRef<{ id: string; tamanho: number; dx: number; dy: number; x: number; y: number; telaX: number; telaY: number; moveu: boolean } | null>(null);
  /** Onde desenhar o peão mexido, até as propriedades novas chegarem (sem pulo). */
  const arrastoVisual = useRef<{ id: string; x: number; y: number } | null>(null);
  /** Régua sendo arrastada agora (pontos em px do mapa; `telaA` pra saber se é toque ou medida). */
  const areaViva = useRef<{ o: Ponto; d: Ponto; telaA: { x: number; y: number }; telaB: { x: number; y: number } } | null>(null);
  const reguaViva = useRef<{ a: Ponto; b: Ponto; telaA: { x: number; y: number }; telaB: { x: number; y: number }; desloc: number | null } | null>(null);
  /** "Este ponto está na névoa?" guardado, pra não reler o canvas da névoa a cada quadro. */
  const coberturaRef = useRef(new Map<string, boolean>());

  const propsRef = useRef({ cena, mestre, interativo, seguirCamera, ferramenta, modoNevoa, pincel, aoPintar, pings, aoPingar, modoRegua, corRegua, reguas, aoMedir, modeloArea, areas, aoAreaar, pecas, aoMoverPeca, aoTocarPeca });
  useEffect(() => {
    propsRef.current = { cena, mestre, interativo, seguirCamera, ferramenta, modoNevoa, pincel, aoPintar, pings, aoPingar, modoRegua, corRegua, reguas, aoMedir, modeloArea, areas, aoAreaar, pecas, aoMoverPeca, aoTocarPeca };
  });

  // Resultado da última tentativa de carregar; vale só pra URL e tentativa a
  // que se refere. O estado exibido é derivado daqui (sem setState no efeito).
  const [tentativa, setTentativa] = useState(0);
  const [carga, setCarga] = useState<{ url: string; tentativa: number; ok: boolean } | null>(null);
  const imagem: "carregando" | "ok" | "erro" | "sem" = !imagemUrl
    ? "sem"
    : carga && carga.url === imagemUrl && carga.tentativa === tentativa
      ? carga.ok
        ? "ok"
        : "erro"
      : "carregando";

  /** O ponto (px do mapa) está coberto de névoa? Lê o canvas da névoa uma vez
   *  por ponto e guarda; a névoa nova esvazia o guardado. */
  const cobertaPorNevoa = useCallback((x: number, y: number): boolean => {
    const canvas = nevoaRef.current;
    if (!canvas || canvas.width === 0) return false;
    const chave = `${Math.round(x)},${Math.round(y)}`;
    const guardado = coberturaRef.current.get(chave);
    if (guardado !== undefined) return guardado;
    const fs = escalaDaNevoa(propsRef.current.cena);
    const px = Math.min(canvas.width - 1, Math.max(0, Math.floor(x * fs)));
    const py = Math.min(canvas.height - 1, Math.max(0, Math.floor(y * fs)));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const coberto = ctx ? ctx.getImageData(px, py, 1, 1).data[3] > 128 : false;
    coberturaRef.current.set(chave, coberto);
    return coberto;
  }, []);

  /** Pinta um quadro. Devolve quantos pings ainda estão animando (o laço
   *  continua pedindo quadros enquanto for maior que zero). */
  const pintar = useCallback((): number => {
    const canvas = canvasRef.current;
    const { w, h, dpr } = tamanhoRef.current;
    if (!canvas || w === 0 || h === 0) return 0;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    const p = propsRef.current;
    desenharCena(ctx, {
      cena: p.cena,
      imagem: imagemRef.current,
      nevoa: nevoaRef.current,
      vista: vistaRef.current,
      larguraTela: w,
      alturaTela: h,
      dpr,
      mestre: p.mestre,
      previa: previaRef.current,
      pecas: p.pecas,
      pecaCoberta: cobertaPorNevoa,
      arrasto: arrastoVisual.current,
    });
    const agora = performance.now();
    const viva = reguaViva.current;
    const previa: PreviaDeRegua | null = viva ? { a: viva.a, b: viva.b, modo: p.modoRegua, cor: p.corRegua, desloc: viva.desloc } : null;
    const vivaArea = areaViva.current;
    const previaArea: PreviaDeArea | null = vivaArea ? { modelo: p.modeloArea, o: vivaArea.o, d: vivaArea.d, cor: p.corRegua } : null;
    return (
      desenharAreas(ctx, p.cena, p.areas ?? [], previaArea, vistaRef.current, w, h, dpr, agora) +
      desenharPings(ctx, p.pings ?? [], vistaRef.current, w, h, dpr, agora) +
      desenharReguas(ctx, p.cena, p.reguas ?? [], previa, vistaRef.current, w, h, dpr, agora)
    );
  }, [cobertaPorNevoa]);

  const pedirQuadro = useCallback(() => {
    if (quadroRef.current) return;
    const quadro = () => {
      quadroRef.current = 0;
      if (pintar() > 0) quadroRef.current = requestAnimationFrame(quadro);
    };
    quadroRef.current = requestAnimationFrame(quadro);
  }, [pintar]);

  const aplicarEnquadre = useCallback(() => {
    const { w, h } = tamanhoRef.current;
    const p = propsRef.current;
    if (w === 0 || h === 0 || p.cena.largura <= 0) return;
    const regiao = (p.seguirCamera && p.cena.camera) || { x: 0, y: 0, w: p.cena.largura, h: p.cena.altura };
    vistaRef.current = enquadrar(regiao, w, h);
    tocouRef.current = false;
    pedirQuadro();
  }, [pedirQuadro]);

  useImperativeHandle(
    ref,
    () => ({
      reenquadrar: aplicarEnquadre,
      enquadrarTudo: () => {
        const { w, h } = tamanhoRef.current;
        const c = propsRef.current.cena;
        if (w === 0 || c.largura <= 0) return;
        vistaRef.current = enquadrar({ x: 0, y: 0, w: c.largura, h: c.altura }, w, h);
        pedirQuadro();
      },
      regiaoVisivel: () => {
        const { w, h } = tamanhoRef.current;
        return w === 0 ? null : regiaoVisivel(vistaRef.current, w, h);
      },
    }),
    [pedirQuadro, aplicarEnquadre],
  );

  // Imagem da cena.
  useEffect(() => {
    imagemRef.current = null;
    pedirQuadro();
    if (!imagemUrl) return;
    const img = new Image();
    img.decoding = "async";
    let vivo = true;
    img.onload = () => {
      if (!vivo) return;
      imagemRef.current = img;
      setCarga({ url: imagemUrl, tentativa, ok: true });
      pedirQuadro();
    };
    img.onerror = () => {
      if (vivo) setCarga({ url: imagemUrl, tentativa, ok: false });
    };
    img.src = imagemUrl;
    return () => {
      vivo = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [imagemUrl, tentativa, pedirQuadro]);

  // Ping ou régua nova (de quem for): começa a animar.
  useEffect(() => {
    pedirQuadro();
  }, [pings, reguas, areas, pedirQuadro]);

  // O relógio do toque longo não pode sobreviver ao componente.
  useEffect(
    () => () => {
      if (toqueLongo.current) window.clearTimeout(toqueLongo.current.timer);
    },
    [],
  );

  // Névoa: redesenhada por inteiro a cada mudança das pinceladas.
  useEffect(() => {
    if (!nevoaRef.current) nevoaRef.current = document.createElement("canvas");
    if (cena.largura > 0 && cena.altura > 0) desenharNevoa(nevoaRef.current, cena, regras);
    coberturaRef.current.clear();
    pedirQuadro();
  }, [cena, regras, pedirQuadro]);

  // Peões novos: o peão mexido já está no lugar certo, então o "desenhar aqui
  // enquanto não chega" pode sair (a não ser que ainda estejam arrastando).
  useEffect(() => {
    if (!arrastoPeca.current) arrastoVisual.current = null;
    pedirQuadro();
  }, [pecas, pedirQuadro]);

  // Tamanho da caixa (e a rotação do celular).
  useEffect(() => {
    const caixa = caixaRef.current;
    const canvas = canvasRef.current;
    if (!caixa || !canvas) return;
    const medir = () => {
      const w = caixa.clientWidth;
      const h = caixa.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      tamanhoRef.current = { w, h, dpr };
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      if (!tocouRef.current) aplicarEnquadre();
      else {
        vistaRef.current = limitarVista(vistaRef.current, propsRef.current.cena, w, h);
        pedirQuadro();
      }
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(caixa);
    return () => {
      obs.disconnect();
      if (quadroRef.current) cancelAnimationFrame(quadroRef.current);
      quadroRef.current = 0;
    };
  }, [aplicarEnquadre, pedirQuadro]);

  // Cena nova, ou câmera nova do Mestre: reenquadra.
  const chaveCamera = cena.camera ? `${cena.camera.x},${cena.camera.y},${cena.camera.w},${cena.camera.h}` : "tudo";
  useEffect(() => {
    aplicarEnquadre();
  }, [cena.id, cena.largura, cena.altura, chaveCamera, seguirCamera, aplicarEnquadre]);

  // Roda do mouse (notebook): precisa de ouvinte nativo pra poder impedir a
  // rolagem da página.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const aoRolar = (e: WheelEvent) => {
      const p = propsRef.current;
      if (!p.interativo) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const { w, h } = tamanhoRef.current;
      const v = zoomEm(
        vistaRef.current,
        e.clientX - r.left,
        e.clientY - r.top,
        Math.exp(-e.deltaY * 0.0015),
        escalaMinima(p.cena, w, h),
        ZOOM_MAXIMO,
      );
      vistaRef.current = limitarVista(v, p.cena, w, h);
      tocouRef.current = true;
      pedirQuadro();
    };
    canvas.addEventListener("wheel", aoRolar, { passive: false });
    return () => canvas.removeEventListener("wheel", aoRolar);
  }, [pedirQuadro]);

  function posicao(e: React.PointerEvent): { x: number; y: number } {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function noMapa(t: { x: number; y: number }): Ponto {
    return telaParaMapa(vistaRef.current, t.x, t.y);
  }

  function atualizarPrevia() {
    const s = pintura.current;
    if (!s) {
      previaRef.current = null;
      return;
    }
    const c = propsRef.current.cena;
    if (s.ferramenta === "pincel") {
      previaRef.current = { modo: s.modo, forma: { forma: "pincel", dados: { r: s.raio, p: s.pontos } } };
    } else if (s.ferramenta === "retangulo") {
      const r = retanguloEntre(c, s.inicio, s.ultimo);
      previaRef.current = r ? { modo: s.modo, forma: { forma: "retangulos", dados: { r: [r] } } } : null;
    } else {
      previaRef.current = { modo: s.modo, forma: { forma: "retangulos", dados: { r: retangulosDasCelulas(c, s.celulas) } } };
    }
  }

  function cancelarToqueLongo() {
    if (!toqueLongo.current) return;
    window.clearTimeout(toqueLongo.current.timer);
    toqueLongo.current = null;
  }

  function aoPressionar(e: React.PointerEvent) {
    const p = propsRef.current;
    if (!p.interativo) return;
    const pos = posicao(e);

    // Shift+clique (notebook): ping na hora, sem arrastar nada.
    if (e.shiftKey && p.aoPingar && dedos.current.size === 0) {
      p.aoPingar(...noMapa(pos));
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    dedos.current.set(e.pointerId, pos);

    if (dedos.current.size >= 2) {
      // Segundo dedo: cancela a pincelada e o toque longo, e vira pinça.
      cancelarToqueLongo();
      semArrastar.current = false;
      arrastoPeca.current = null;
      arrastoVisual.current = null;
      reguaViva.current = null;
      areaViva.current = null;
      pintura.current = null;
      previaRef.current = null;
      const [a, b] = [...dedos.current.values()];
      const centro = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinca.current = {
        distancia: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        vista: vistaRef.current,
        centro,
        ponto: noMapa(centro),
      };
      pedirQuadro();
      return;
    }

    // Régua: arrastar de um ponto a outro mede. Se o toque começa em cima de um
    // peão, a medida leva o deslocamento dele ("cabe nos 9 m").
    if (p.ferramenta === "regua" && p.aoMedir) {
      const [mx, my] = noMapa(pos);
      const peao = acharPecaNoPonto((p.pecas ?? []).filter((x) => x.deslocamento !== null), mx, my);
      reguaViva.current = { a: [mx, my], b: [mx, my], telaA: pos, telaB: pos, desloc: peao?.deslocamento ?? null };
      semArrastar.current = true;
      pedirQuadro();
      return;
    }

    // Modelo de magia: o toque marca a origem (encaixada no cruzamento da grade);
    // arrastar aponta a direção. Na esfera a origem é o centro e segue o dedo.
    if (p.ferramenta === "area" && p.aoAreaar) {
      const ponto = noMapa(pos);
      const origem = cruzamentoMaisPerto(p.cena, ponto);
      areaViva.current = { o: origem, d: p.modeloArea.forma === "esfera" ? origem : ponto, telaA: pos, telaB: pos };
      semArrastar.current = true;
      pedirQuadro();
      return;
    }

    // Ferramenta ping (Mestre): um toque já pinga.
    if (p.ferramenta === "ping" && p.aoPingar) {
      semArrastar.current = true;
      p.aoPingar(...noMapa(pos));
      return;
    }

    // Peão: com a ferramenta de mover, tocar num peão que dá pra mexer o pega.
    if (p.pecas && p.aoMoverPeca && p.ferramenta === "mover") {
      const [mx, my] = noMapa(pos);
      const alvo = acharPecaNoPonto(p.pecas.filter((x) => x.podeMover), mx, my);
      if (alvo) {
        cancelarToqueLongo();
        arrastoPeca.current = { id: alvo.id, tamanho: alvo.tamanho, dx: mx - alvo.x, dy: my - alvo.y, x: alvo.x, y: alvo.y, telaX: pos.x, telaY: pos.y, moveu: false };
        arrastoVisual.current = { id: alvo.id, x: alvo.x, y: alvo.y };
        p.aoTocarPeca?.(alvo.id);
        pedirQuadro();
        return;
      }
      p.aoTocarPeca?.(null);
    }

    const ferr = p.ferramenta;
    const pintavel =
      p.mestre && ferr !== "mover" && ferr !== "ping" && ferr !== "regua" && ferr !== "area" && p.aoPintar && (ferr !== "quadradinhos" || gradeUsavel(p.cena));
    if (!pintavel && p.aoPingar) {
      // Sem ferramenta de pintura em uso: dedo parado por um instante vira ping.
      cancelarToqueLongo();
      const timer = window.setTimeout(() => {
        const t = toqueLongo.current;
        toqueLongo.current = null;
        if (!t) return;
        semArrastar.current = true;
        propsRef.current.aoPingar?.(...noMapa({ x: t.x, y: t.y }));
        navigator.vibrate?.(25);
      }, PING_TOQUE_LONGO_MS);
      toqueLongo.current = { x: pos.x, y: pos.y, timer };
    }
    if (pintavel) {
      const ponto = noMapa(pos);
      pintura.current = {
        ferramenta: ferr,
        modo: p.modoNevoa,
        raio: raioDoPincel(p.cena, p.pincel),
        pontos: [ponto],
        inicio: ponto,
        ultimo: ponto,
        celulas: ferr === "quadradinhos" ? celulasNoSegmento(p.cena, ponto, ponto) : [],
      };
      atualizarPrevia();
      pedirQuadro();
    }
  }

  function aoMover(e: React.PointerEvent) {
    const antes = dedos.current.get(e.pointerId);
    if (!antes) return;
    const agora = posicao(e);
    dedos.current.set(e.pointerId, agora);
    const p = propsRef.current;
    const { w, h } = tamanhoRef.current;

    if (dedos.current.size >= 2 && pinca.current) {
      const [a, b] = [...dedos.current.values()];
      const centro = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const k = pinca.current;
      const escala = Math.min(ZOOM_MAXIMO, Math.max(escalaMinima(p.cena, w, h), (k.vista.escala * d) / k.distancia));
      vistaRef.current = limitarVista(
        { escala, tx: centro.x - k.ponto[0] * escala, ty: centro.y - k.ponto[1] * escala },
        p.cena,
        w,
        h,
      );
      tocouRef.current = true;
      pedirQuadro();
      return;
    }

    const s = pintura.current;
    if (s) {
      const ponto = noMapa(agora);
      if (s.ferramenta === "pincel") {
        const ult = s.pontos[s.pontos.length - 1];
        if (Math.hypot(ponto[0] - ult[0], ponto[1] - ult[1]) >= s.raio * 0.12) s.pontos.push(ponto);
      } else if (s.ferramenta === "quadradinhos") {
        s.celulas.push(...celulasNoSegmento(p.cena, s.ultimo, ponto));
      }
      s.ultimo = ponto;
      atualizarPrevia();
      pedirQuadro();
      return;
    }

    // Arrastando a régua.
    const rv = reguaViva.current;
    if (rv) {
      rv.b = noMapa(agora);
      rv.telaB = agora;
      pedirQuadro();
      return;
    }

    // Arrastando um modelo de magia.
    const av = areaViva.current;
    if (av) {
      const ponto = noMapa(agora);
      if (p.modeloArea.forma === "esfera") {
        av.o = cruzamentoMaisPerto(p.cena, ponto);
        av.d = av.o;
      } else {
        av.d = ponto;
      }
      av.telaB = agora;
      pedirQuadro();
      return;
    }

    // Arrastando um peão.
    const ar = arrastoPeca.current;
    if (ar) {
      const [mx, my] = noMapa(agora);
      ar.x = Math.min(p.cena.largura, Math.max(0, mx - ar.dx));
      ar.y = Math.min(p.cena.altura, Math.max(0, my - ar.dy));
      if (!ar.moveu && Math.hypot(agora.x - ar.telaX, agora.y - ar.telaY) > PING_TOLERANCIA_PX) ar.moveu = true;
      arrastoVisual.current = { id: ar.id, x: ar.x, y: ar.y };
      pedirQuadro();
      return;
    }

    // Dedo parado esperando virar ping: o mapa fica quieto enquanto ele não sair
    // da tolerância; se sair, é arrasto e o ping é cancelado.
    const t = toqueLongo.current;
    if (t) {
      if (Math.hypot(agora.x - t.x, agora.y - t.y) <= PING_TOLERANCIA_PX) return;
      cancelarToqueLongo();
    }
    if (semArrastar.current) return;

    // Arrastar o mapa com um dedo.
    vistaRef.current = limitarVista(
      { ...vistaRef.current, tx: vistaRef.current.tx + (agora.x - antes.x), ty: vistaRef.current.ty + (agora.y - antes.y) },
      p.cena,
      w,
      h,
    );
    tocouRef.current = true;
    pedirQuadro();
  }

  function confirmarPintura() {
    const s = pintura.current;
    pintura.current = null;
    previaRef.current = null;
    pedirQuadro();
    if (!s) return;
    const p = propsRef.current;
    let nova: NovaRegra | null = null;
    if (s.ferramenta === "pincel") {
      nova = {
        modo: s.modo,
        forma: "pincel",
        dados: { r: Math.round(s.raio * 100) / 100, p: simplificarTrilha(s.pontos, s.raio * 0.25) },
      };
    } else if (s.ferramenta === "retangulo") {
      const r = retanguloEntre(p.cena, s.inicio, s.ultimo);
      if (r) nova = { modo: s.modo, forma: "retangulos", dados: { r: [r] } };
    } else {
      const r = retangulosDasCelulas(p.cena, s.celulas);
      if (r.length > 0) nova = { modo: s.modo, forma: "retangulos", dados: { r } };
    }
    if (nova) p.aoPintar?.(nova);
  }

  function aoSoltar(e: React.PointerEvent, cancelado: boolean) {
    if (!dedos.current.has(e.pointerId)) return;
    dedos.current.delete(e.pointerId);
    cancelarToqueLongo();
    if (dedos.current.size < 2) pinca.current = null;
    if (dedos.current.size === 0) {
      semArrastar.current = false;
      const rv = reguaViva.current;
      if (rv) {
        reguaViva.current = null;
        const arrastou = Math.hypot(rv.telaB.x - rv.telaA.x, rv.telaB.y - rv.telaA.y) >= REGUA_MINIMA_PX;
        const p = propsRef.current;
        // Um toque simples não é régua; medida de zero quadrado também não.
        if (!cancelado && arrastou && medirRegua(p.cena, rv.a, rv.b, p.modoRegua).quadrados > 0) {
          p.aoMedir?.(rv.a, rv.b, p.modoRegua, rv.desloc);
        }
        pedirQuadro();
        return;
      }
      const av = areaViva.current;
      if (av) {
        areaViva.current = null;
        const p = propsRef.current;
        // A esfera vale com um toque (cai onde está o dedo); cone, cubo e linha
        // precisam de uma direção, então um toque simples não conta.
        const arrastou = Math.hypot(av.telaB.x - av.telaA.x, av.telaB.y - av.telaA.y) >= REGUA_MINIMA_PX;
        if (!cancelado && (p.modeloArea.forma === "esfera" || arrastou)) p.aoAreaar?.(p.modeloArea, av.o, av.d);
        pedirQuadro();
        return;
      }
      const ar = arrastoPeca.current;
      if (ar) {
        arrastoPeca.current = null;
        if (cancelado || !ar.moveu) {
          arrastoVisual.current = null;
        } else {
          const [x, y] = encaixarNaGrade(propsRef.current.cena, ar.x, ar.y, ar.tamanho as 1 | 2 | 3 | 4);
          // Fica desenhado no lugar novo até a lista de peões chegar com ele.
          arrastoVisual.current = { id: ar.id, x, y };
          propsRef.current.aoMoverPeca?.(ar.id, x, y);
        }
        pedirQuadro();
        return;
      }
      if (cancelado) {
        pintura.current = null;
        previaRef.current = null;
        pedirQuadro();
      } else confirmarPintura();
    }
  }

  const pintando = mestre && ferramenta !== "mover" && ferramenta !== "ping" && ferramenta !== "regua" && ferramenta !== "area";
  return (
    <div ref={caixaRef} className="cena-caixa">
      <canvas
        ref={canvasRef}
        className="cena-canvas"
        style={{ cursor: !interativo ? "default" : pintando || ferramenta === "regua" || ferramenta === "area" ? "crosshair" : ferramenta === "ping" ? "pointer" : "grab", pointerEvents: interativo ? "auto" : "none" }}
        role="img"
        aria-label={`Mapa ${cena.nome || "sem nome"}`}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={(e) => aoSoltar(e, false)}
        onPointerCancel={(e) => aoSoltar(e, true)}
        onContextMenu={(e) => e.preventDefault()}
      />
      {imagem === "carregando" && <div className="cena-aviso">Carregando o mapa…</div>}
      {imagem === "sem" && <div className="cena-aviso">Esta cena ainda não tem imagem.</div>}
      {imagem === "erro" && (
        <div className="cena-aviso" role="alert">
          <p>Não deu pra carregar o mapa. Confira a conexão.</p>
          <button type="button" className="btn" onClick={() => setTentativa((n) => n + 1)}>
            tentar de novo
          </button>
        </div>
      )}
    </div>
  );
}
