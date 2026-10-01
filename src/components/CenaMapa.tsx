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
  comporNevoaComVisao,
  desenharAreas,
  desenharReguas,
  escalaDaNevoa,
  type FormaDesenhavel,
  type PreviaDeArea,
  type PreviaDeRegua,
} from "@/lib/desenharCena";
import { REGUA_MINIMA_PX, medirRegua, type ModoRegua, type ReguaNaTela } from "@/lib/regua";
import { MODELO_INICIAL, cruzamentoMaisPerto, type AreaNaTela, type ModeloArea } from "@/lib/area";
import {
  TOQUE_NA_PAREDE_PX,
  acharParedeNoPonto,
  paredeEntre,
  paredesDoComodo,
  pontoParaParede,
  segmentosQueBloqueiam,
  type ModoParede,
  type NovaParede,
  type Parede,
} from "@/lib/paredes";
import {
  alcanceEmPx,
  codificarMascara,
  criarMascara,
  decodificarMascara,
  juntarMascaras,
  marcarVistos,
  poligonoDeVisao,
  type Mascara,
} from "@/lib/visao";
import { COR_PING_MESTRE } from "@/lib/ping";
import { acharPecaNoPonto, encaixarNaGrade, type PecaNaTela } from "@/lib/pecas";
import { PING_TOLERANCIA_PX, PING_TOQUE_LONGO_MS, type PingNaTela } from "@/lib/ping";

export type Ferramenta = "mover" | "quadradinhos" | "pincel" | "retangulo" | "ping" | "regua" | "area" | "parede" | "colocar";

/** O que o Mestre pode pedir ao mapa de fora (botões "enquadrar", "levar a mesa"). */
export type CenaMapaApi = {
  /** Esquece o que o grupo já viu (a memória da visão automática) neste aparelho. */
  reiniciarMemoria: () => void;
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
  /** Paredes e portas (só o Mestre as vê; pra todos elas decidem o que a visão alcança). */
  paredes?: readonly Parede[];
  /** O que a ferramenta "parede" faz, e o que fazer com o que o Mestre desenhar. */
  modoParede?: ModoParede;
  aoCriarParedes?: (novas: NovaParede[]) => void;
  aoApagarParede?: (id: string) => void;
  /** Tocar numa porta com a ferramenta de mover (Mestre) abre ou fecha. */
  aoAlternarPorta?: (id: string) => void;
  /** Mestre: mostrar o que cada inimigo enxerga (não abre névoa pra mesa). */
  verVisaoDosInimigos?: boolean;
  /** Paredes e peões já foram lidos do banco. Enquanto não, a visão automática
   *  espera (a névoa fica só a feita à mão): sem as paredes ela enxergaria
   *  através de tudo e marcaria isso como "já visto" pra sempre. */
  visaoPronta?: boolean;
  /** Mestre: o que o grupo já viu mudou; guarda no banco (`cenas.explorado`). */
  aoExplorar?: (texto: string) => void;
  /** Ferramenta "colocar": o Mestre tocou num ponto do mapa. */
  aoEscolherPonto?: (ponto: Ponto) => void;
  /** Peões da cena (já calculados pro ponto de vista de quem olha). */
  pecas?: readonly PecaNaTela[];
  /** Soltou um peão num lugar novo (já encaixado na grade). */
  aoMoverPeca?: (id: string, x: number, y: number) => void;
  /** Tocou num peão (ou em lugar nenhum: null). */
  aoTocarPeca?: (id: string | null) => void;
  ref?: Ref<CenaMapaApi>;
};

type Pintura = {
  ferramenta: Exclude<Ferramenta, "mover" | "ping" | "regua" | "area" | "parede" | "colocar">;
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
  paredes,
  modoParede = "parede",
  aoCriarParedes,
  aoApagarParede,
  aoAlternarPorta,
  verVisaoDosInimigos = false,
  visaoPronta = true,
  aoExplorar,
  aoEscolherPonto,
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
  /** A névoa que vale de fato: a feita à mão, ou ela com a visão automática por cima. */
  const nevoaFinalRef = useRef<HTMLCanvasElement | null>(null);
  const composicaoRef = useRef<HTMLCanvasElement | null>(null);
  /** O que o grupo já viu (neste aparelho e o que o Mestre guardou), da cena `memoriaDaCena`. */
  const memoriaRef = useRef<{ cenaId: string; mascara: Mascara } | null>(null);
  const remotoAnteriorRef = useRef<{ cenaId: string; texto: string } | null>(null);
  const explorarRef = useRef<{ timer: number; enviado: string }>({ timer: 0, enviado: "" });
  const visaoDosInimigosRef = useRef<(readonly (readonly Ponto[])[])>([]);
  const ultimaComposicaoRef = useRef(0);
  /** Parede sendo desenhada agora (px do mapa, já encaixada) e porta tocada (abre no soltar). */
  const paredeViva = useRef<{ a: Ponto; b: Ponto; telaA: { x: number; y: number }; telaB: { x: number; y: number } } | null>(null);
  const portaToque = useRef<{ id: string; x: number; y: number } | null>(null);

  const propsRef = useRef({ cena, mestre, interativo, seguirCamera, ferramenta, modoNevoa, pincel, aoPintar, pings, aoPingar, modoRegua, corRegua, reguas, aoMedir, modeloArea, areas, aoAreaar, paredes, modoParede, aoCriarParedes, aoApagarParede, aoAlternarPorta, verVisaoDosInimigos, visaoPronta, aoExplorar, aoEscolherPonto, pecas, aoMoverPeca, aoTocarPeca });
  useEffect(() => {
    propsRef.current = { cena, mestre, interativo, seguirCamera, ferramenta, modoNevoa, pincel, aoPintar, pings, aoPingar, modoRegua, corRegua, reguas, aoMedir, modeloArea, areas, aoAreaar, paredes, modoParede, aoCriarParedes, aoApagarParede, aoAlternarPorta, verVisaoDosInimigos, visaoPronta, aoExplorar, aoEscolherPonto, pecas, aoMoverPeca, aoTocarPeca };
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
    const canvas = nevoaFinalRef.current ?? nevoaRef.current;
    if (!canvas || canvas.width === 0) return false;
    const chave = `${Math.round(x)},${Math.round(y)}`;
    const guardado = coberturaRef.current.get(chave);
    if (guardado !== undefined) return guardado;
    const fs = escalaDaNevoa(propsRef.current.cena);
    const px = Math.min(canvas.width - 1, Math.max(0, Math.floor(x * fs)));
    const py = Math.min(canvas.height - 1, Math.max(0, Math.floor(y * fs)));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    // Limiar baixo de propósito: a parte "já vista" (escurecida, metade da névoa)
    // também conta como coberta — um inimigo não aparece num lugar que o grupo
    // só lembra, só onde enxerga agora.
    const coberto = ctx ? ctx.getImageData(px, py, 1, 1).data[3] > 40 : false;
    coberturaRef.current.set(chave, coberto);
    return coberto;
  }, []);

  /** A memória do grupo desta cena (uma nova, se a cena ou a escala da grade mudou). */
  const memoriaDaCena = useCallback((): Mascara => {
    const c = propsRef.current.cena;
    const nova = criarMascara(c);
    const atual = memoriaRef.current;
    if (atual && atual.cenaId === c.id && atual.mascara.cols === nova.cols && atual.mascara.rows === nova.rows && atual.mascara.lado === nova.lado) {
      return atual.mascara;
    }
    memoriaRef.current = { cenaId: c.id, mascara: nova };
    return nova;
  }, []);

  /** O Mestre guarda no banco o que o grupo já viu — 1,5 s depois da última mudança, e só se mudou. */
  const agendarExplorar = useCallback(() => {
    const p = propsRef.current;
    if (!p.mestre || !p.aoExplorar || !p.cena.na_mesa) return;
    const texto = codificarMascara(memoriaDaCena());
    if (texto === p.cena.explorado || texto === explorarRef.current.enviado) return;
    window.clearTimeout(explorarRef.current.timer);
    explorarRef.current.timer = window.setTimeout(() => {
      const agora = propsRef.current;
      // O mapa pode ter saído da mesa (ou o aparelho deixado de ser o do Mestre) nesse 1,5 s.
      if (!agora.mestre || !agora.cena.na_mesa) return;
      const atual = codificarMascara(memoriaDaCena());
      if (atual && atual !== agora.cena.explorado && atual !== explorarRef.current.enviado) {
        explorarRef.current.enviado = atual;
        propsRef.current.aoExplorar?.(atual);
      }
    }, 1500);
  }, [memoriaDaCena]);

  /** Refaz a névoa que vale (a feita à mão + a visão automática) e a visão dos
   *  inimigos. Chamada quando muda peão, parede, porta, ajuste da cena ou névoa
   *  — e, com o peão sendo arrastado, algumas vezes por segundo. */
  const recomporNevoa = useCallback(() => {
    const p = propsRef.current;
    const fino = nevoaRef.current;
    const c = p.cena;
    if (!fino || c.largura <= 0 || c.altura <= 0) return;
    coberturaRef.current.clear();
    if (!c.visao_ligada || !p.visaoPronta) {
      nevoaFinalRef.current = fino;
      visaoDosInimigosRef.current = [];
      return;
    }
    const segmentos = segmentosQueBloqueiam(p.paredes ?? []);
    const alcance = alcanceEmPx(c);
    const arr = arrastoVisual.current;
    const onde = (x: PecaNaTela): Ponto => (arr && arr.id === x.id ? [arr.x, arr.y] : [x.x, x.y]);
    const pecas = p.pecas ?? [];
    const dosJogadores = pecas.filter((x) => x.observa).map((x) => poligonoDeVisao(onde(x), segmentos, alcance));
    visaoDosInimigosRef.current = p.mestre && p.verVisaoDosInimigos ? pecas.filter((x) => x.inimigo).map((x) => poligonoDeVisao(onde(x), segmentos, alcance)) : [];
    const memoria = memoriaDaCena();
    // Só vira "já visto" o que a MESA viu: com o mapa ainda sendo preparado, o
    // Mestre pode mexer nos peões à vontade sem gastar a névoa.
    if (c.na_mesa) {
      marcarVistos(memoria, dosJogadores);
      // Sempre pergunta se há o que guardar (e não só quando surgiu célula nova): o
      // relógio pode ter sido cancelado, e quem sabe se já foi tudo gravado é a comparação.
      agendarExplorar();
    }
    if (!composicaoRef.current) composicaoRef.current = document.createElement("canvas");
    comporNevoaComVisao(composicaoRef.current, fino, c, dosJogadores, memoria);
    nevoaFinalRef.current = composicaoRef.current;
  }, [memoriaDaCena, agendarExplorar]);

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
      nevoa: nevoaFinalRef.current ?? nevoaRef.current,
      vista: vistaRef.current,
      larguraTela: w,
      alturaTela: h,
      dpr,
      mestre: p.mestre,
      previa: previaRef.current,
      pecas: p.pecas,
      pecaCoberta: cobertaPorNevoa,
      arrasto: arrastoVisual.current,
      // Só o Mestre vê paredes, portas e a visão dos inimigos.
      paredes: p.mestre ? p.paredes : undefined,
      previaParede: p.mestre && paredeViva.current ? { tipo: p.modoParede === "comodo" ? "comodo" : p.modoParede === "porta" ? "porta" : "parede", a: paredeViva.current.a, b: paredeViva.current.b } : null,
      visaoDosInimigos: p.mestre ? visaoDosInimigosRef.current : undefined,
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
      reiniciarMemoria: () => {
        memoriaRef.current = null;
        explorarRef.current.enviado = "";
        window.clearTimeout(explorarRef.current.timer);
        recomporNevoa();
        pedirQuadro();
      },
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
    [pedirQuadro, aplicarEnquadre, recomporNevoa],
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
    recomporNevoa();
    pedirQuadro();
  }, [cena, regras, pedirQuadro, recomporNevoa]);

  // O que o Mestre guardou como "já visto" chegou (ou foi zerado): junta com o
  // que este aparelho viu, ou esquece tudo se o Mestre cobriu de novo.
  useEffect(() => {
    const anterior = remotoAnteriorRef.current;
    remotoAnteriorRef.current = { cenaId: cena.id, texto: cena.explorado };
    if (anterior && anterior.cenaId === cena.id && anterior.texto !== "" && cena.explorado === "") {
      memoriaRef.current = null;
      explorarRef.current.enviado = "";
    } else if (cena.explorado) {
      const remota = decodificarMascara(cena.explorado, cena);
      if (remota) juntarMascaras(memoriaDaCena(), remota);
    }
    recomporNevoa();
    pedirQuadro();
  }, [cena.id, cena.explorado, cena, memoriaDaCena, recomporNevoa, pedirQuadro]);

  // Paredes, portas e ajustes da visão: refaz a névoa.
  useEffect(() => {
    recomporNevoa();
    pedirQuadro();
  }, [paredes, verVisaoDosInimigos, visaoPronta, cena.visao_ligada, cena.visao_alcance, cena.metros, cena.grade_px, cena.na_mesa, recomporNevoa, pedirQuadro]);

  // O relógio de guardar a memória não pode sobreviver ao componente.
  useEffect(() => {
    const guardado = explorarRef.current;
    return () => window.clearTimeout(guardado.timer);
  }, []);

  // Peões novos: o peão mexido já está no lugar certo, então o "desenhar aqui
  // enquanto não chega" pode sair (a não ser que ainda estejam arrastando).
  useEffect(() => {
    if (!arrastoPeca.current) arrastoVisual.current = null;
    recomporNevoa();
    pedirQuadro();
  }, [pecas, pedirQuadro, recomporNevoa]);

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
      paredeViva.current = null;
      portaToque.current = null;
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

    // "Pôr o grupo onde eu tocar": o toque escolhe o ponto e a ferramenta acaba.
    if (p.ferramenta === "colocar" && p.aoEscolherPonto) {
      semArrastar.current = true;
      p.aoEscolherPonto(noMapa(pos));
      return;
    }

    // Paredes (Mestre): arrastar desenha; no modo apagar, tocar numa parede a tira.
    if (p.ferramenta === "parede" && p.mestre) {
      const ponto = noMapa(pos);
      const escala = vistaRef.current.escala;
      semArrastar.current = true;
      if (p.modoParede === "apagar") {
        const alvo = acharParedeNoPonto(p.paredes ?? [], ponto, TOQUE_NA_PAREDE_PX / escala);
        if (alvo) p.aoApagarParede?.(alvo.id);
        return;
      }
      if (!p.aoCriarParedes) return;
      const inicio = pontoParaParede(p.cena, p.paredes ?? [], ponto, escala);
      paredeViva.current = { a: inicio, b: inicio, telaA: pos, telaB: pos };
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

    // Mestre: tocar numa porta com a ferramenta de mover a abre ou fecha — mas só
    // ao soltar, e só se o dedo não andou (senão era o começo de um arrasto do mapa).
    if (p.ferramenta === "mover" && p.mestre && p.aoAlternarPorta) {
      const [mx, my] = noMapa(pos);
      const porta = acharParedeNoPonto(p.paredes ?? [], [mx, my], TOQUE_NA_PAREDE_PX / vistaRef.current.escala, "porta");
      portaToque.current = porta ? { id: porta.id, x: pos.x, y: pos.y } : null;
    }

    const ferr = p.ferramenta;
    const pintavel =
      p.mestre && ferr !== "mover" && ferr !== "ping" && ferr !== "regua" && ferr !== "area" && ferr !== "parede" && ferr !== "colocar" && p.aoPintar && (ferr !== "quadradinhos" || gradeUsavel(p.cena));
    if (!pintavel && p.aoPingar) {
      // Sem ferramenta de pintura em uso: dedo parado por um instante vira ping.
      cancelarToqueLongo();
      const timer = window.setTimeout(() => {
        const t = toqueLongo.current;
        toqueLongo.current = null;
        if (!t) return;
        semArrastar.current = true;
        portaToque.current = null;
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

    // A porta tocada só abre se o dedo ficou parado.
    const pt = portaToque.current;
    if (pt && Math.hypot(agora.x - pt.x, agora.y - pt.y) > PING_TOLERANCIA_PX) portaToque.current = null;

    // Arrastando uma parede.
    const pw = paredeViva.current;
    if (pw) {
      pw.b = pontoParaParede(p.cena, p.paredes ?? [], noMapa(agora), vistaRef.current.escala);
      pw.telaB = agora;
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
      // A visão acompanha o peão enquanto ele anda (poucas vezes por segundo: a conta pesa).
      if (p.cena.visao_ligada) {
        const t = performance.now();
        if (t - ultimaComposicaoRef.current > 70) {
          ultimaComposicaoRef.current = t;
          recomporNevoa();
        }
      }
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
      const pw = paredeViva.current;
      if (pw) {
        paredeViva.current = null;
        const p = propsRef.current;
        const arrastou = Math.hypot(pw.telaB.x - pw.telaA.x, pw.telaB.y - pw.telaA.y) >= REGUA_MINIMA_PX;
        if (!cancelado && arrastou) {
          const novas =
            p.modoParede === "comodo"
              ? paredesDoComodo(pw.a, pw.b)
              : [paredeEntre(p.modoParede === "porta" ? "porta" : "parede", pw.a, pw.b)].filter((n): n is NovaParede => n !== null);
          if (novas && novas.length > 0) p.aoCriarParedes?.(novas);
        }
        pedirQuadro();
        return;
      }
      const pt = portaToque.current;
      portaToque.current = null;
      if (pt && !cancelado) propsRef.current.aoAlternarPorta?.(pt.id);
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

  const pintando = mestre && ferramenta !== "mover" && ferramenta !== "ping" && ferramenta !== "regua" && ferramenta !== "area" && ferramenta !== "parede" && ferramenta !== "colocar";
  return (
    <div ref={caixaRef} className="cena-caixa">
      <canvas
        ref={canvasRef}
        className="cena-canvas"
        style={{ cursor: !interativo ? "default" : pintando || ferramenta === "regua" || ferramenta === "area" || ferramenta === "parede" || ferramenta === "colocar" ? "crosshair" : ferramenta === "ping" ? "pointer" : "grab", pointerEvents: interativo ? "auto" : "none" }}
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
