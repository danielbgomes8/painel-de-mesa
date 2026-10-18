"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import {
  ZOOM_MAXIMO,
  celulasNoSegmento,
  enquadrar,
  escalaMinima,
  gradeUsavel,
  limitarVista,
  misturarVistas,
  raioDoPincel,
  regiaoDeFoco,
  regiaoVisivel,
  retanguloEntre,
  deslocarGrade,
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
import { MODELO_INICIAL, contagemNaArea, cruzamentoMaisPerto, rotuloDaContagem, type AreaNaTela, type FormaNoMapa, type ModeloArea } from "@/lib/area";
import {
  ENCAIXE_NA_PONTA_PX,
  TOLERANCIA_DA_CURVA_PX,
  TOQUE_NA_PAREDE_PX,
  acharParedeNoPonto,
  paredeEntre,
  paredesDoComodo,
  pontoParaParede,
  andarComParedes,
  paredesDoTraco,
  pontaDeParedePerto,
  pousoLivre,
  segmentosQueBloqueiam,
  type ModoParede,
  type NovaParede,
  type Parede,
} from "@/lib/paredes";
import { armadilhasVisiveis, type Armadilha } from "@/lib/armadilhas";
import {
  alcanceEmPx,
  codificarMascara,
  criarMascara,
  decodificarMascara,
  juntarMascaras,
  marcarVistos,
  marcarVistosPorLuz,
  poligonoDeVisao,
  type Mascara,
} from "@/lib/visao";
import {
  acharAlca,
  acharMarcaNoPonto,
  caixaDosPontos,
  centroDaCaixa,
  circuloDe,
  escalarPontos,
  fatorPermitido,
  girarPontos,
  linhaReta,
  manterNoMapa,
  moverPontos,
  retanguloDe,
  marcasVisiveis,
  simplificarDesenho,
  TOQUE_NA_ALCA_PX,
  TOQUE_NA_MARCA_PX,
  TRACO_MINIMO_PX,
  type Marca,
  type ModoMarca,
} from "@/lib/marcas";
import { COR_PING_MESTRE } from "@/lib/ping";
import { acharPecaNoPonto, encaixarNaGrade, type PecaNaTela } from "@/lib/pecas";
import { PING_TOLERANCIA_PX, PING_TOQUE_LONGO_MS, type PingNaTela } from "@/lib/ping";

export type Ferramenta = "mover" | "quadradinhos" | "pincel" | "retangulo" | "ping" | "regua" | "area" | "parede" | "marca" | "colocar" | "grade";

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
  /** Aproxima (fator > 1) ou afasta (< 1) em torno do centro da tela: os botões de zoom. */
  aproximar: (fator: number) => void;
  /** Desliza até o ponto (px da imagem) com um zoom moderado: o HUD do telão focando um jogador. */
  focar: (x: number, y: number) => void;
};

/** Quanto dura o deslize do foco. Curto: quem toca quer ver o peão já. */
const FOCO_MS = 450;

type Props = {
  cena: Cena;
  /** Link da imagem; null enquanto a cena não tem imagem. */
  imagemUrl: string | null;
  regras: readonly RegraNevoa[];
  /** O Mestre enxerga o mapa através da névoa e pode pintá-la. */
  mestre: boolean;
  /** Com toque e roda do mouse. Desligado, o mapa só mostra. (O telão liga: dá
   *  zoom e arrasta a vista, mas sem `aoMoverPeca`/`aoPingar` não mexe em nada.) */
  interativo?: boolean;
  /** Acompanha a câmera que o Mestre definiu (mesa); o Mestre navega livre. */
  seguirCamera?: boolean;
  /** Vista Mestre ligada: o mapa desliza pra este pedaço sempre que ele muda
   *  (e se ajusta ao tamanho da tela). Voltando a null, volta à vista que o
   *  aparelho tinha antes de ligar. */
  vistaGuiada?: Regiao | null;
  /** Avisa o pedaço que a tela mostra sempre que a vista muda (o controle da Vista Mestre). */
  aoMudarVista?: (r: Regiao) => void;
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
  /** Modo "propriedades" da ferramenta de paredes: o Mestre tocou numa porta (ou no vazio: null). */
  aoSelecionarPorta?: (id: string | null) => void;
  portaSelecionada?: string | null;
  /** Desenhos e notas do mapa (o filtro do que cada um vê é daqui) e o que a ferramenta
   *  "marca" faz: traço livre, linha reta, nota (toca num ponto) ou borracha. */
  marcas?: readonly Marca[];
  /** Armadilhas da cena (todas; aqui se filtra o que cada um enxerga: a escondida é só do Mestre). */
  armadilhas?: readonly Armadilha[];
  modoMarca?: ModoMarca;
  corMarca?: string;
  /** Mestre soltou um traço (já simplificado, em px da imagem). */
  aoCriarTraco?: (pontos: Ponto[]) => void;
  /** Mestre tocou num ponto com o modo nota: abre o campo do texto. */
  aoEscolherNota?: (ponto: Ponto) => void;
  aoApagarMarca?: (id: string) => void;
  /** Modo editar: o desenho selecionado, como selecionar (null = nenhum) e o que fazer quando o Mestre
   *  termina de mover, redimensionar ou girar (os novos pontos, já dentro do mapa). */
  marcaSelecionada?: string | null;
  aoSelecionarMarca?: (id: string | null) => void;
  aoTransformarMarca?: (id: string, pontos: Ponto[]) => void;
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
  /** Ferramenta "grade": o Mestre arrastou a grade e soltou; é onde ela passa a começar (px da imagem). */
  aoAlinharGrade?: (grade_dx: number, grade_dy: number) => void;
  /** Peões da cena (já calculados pro ponto de vista de quem olha). */
  pecas?: readonly PecaNaTela[];
  /** Soltou um peão num lugar novo (já encaixado na grade). */
  aoMoverPeca?: (id: string, x: number, y: number) => void;
  /** Tocou num peão (ou em lugar nenhum: null). */
  aoTocarPeca?: (id: string | null) => void;
  /** Tocou num peão e soltou sem arrastar: abre as ações dele (cartão do peão). */
  aoAbrirPeca?: (id: string) => void;
  ref?: Ref<CenaMapaApi>;
};

type Pintura = {
  ferramenta: Exclude<Ferramenta, "mover" | "ping" | "regua" | "area" | "parede" | "marca" | "colocar" | "grade">;
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
  vistaGuiada = null,
  aoMudarVista,
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
  marcas,
  armadilhas,
  modoMarca = "livre",
  corMarca = "#f0c24b",
  aoCriarTraco,
  aoEscolherNota,
  aoApagarMarca,
  marcaSelecionada,
  aoSelecionarMarca,
  aoTransformarMarca,
  aoAlternarPorta,
  aoSelecionarPorta,
  portaSelecionada,
  verVisaoDosInimigos = false,
  visaoPronta = true,
  aoExplorar,
  aoEscolherPonto,
  aoAlinharGrade,
  pecas,
  aoMoverPeca,
  aoTocarPeca,
  aoAbrirPeca,
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
  // O deslize do foco em andamento; tocar no mapa ou rolar a roda cancela.
  const focoRef = useRef(0);
  /** A última vista avisada por `aoMudarVista` (pra não repetir a mesma). */
  const vistaAvisadaRef = useRef<Vista | null>(null);
  /** A vista que o aparelho tinha quando a Vista Mestre ligou (volta pra ela ao desligar).
   *  `vista` null: abriu já seguindo o Mestre (link `?vista=mestre`), sem vista própria. */
  const vistaPropriaRef = useRef<{ vista: Vista | null; tocou: boolean } | null>(null);
  const pintura = useRef<Pintura | null>(null);
  /** Dedo parado esperando virar ping (toque longo): onde começou e o relógio. */
  const toqueLongo = useRef<{ x: number; y: number; timer: number } | null>(null);
  /** Com a ferramenta ping, ou depois do ping, o dedo não arrasta o mapa. */
  const semArrastar = useRef(false);
  /** Peão sendo arrastado agora (posição em px do mapa; `moveu` = passou da tolerância;
   *  `ox`, `oy` = de onde saiu, pra voltar se não der pra pousar). */
  const arrastoPeca = useRef<{ id: string; tamanho: number; dx: number; dy: number; x: number; y: number; ox: number; oy: number; telaX: number; telaY: number; moveu: boolean } | null>(null);
  /** Onde desenhar o peão mexido, até as propriedades novas chegarem (sem pulo). */
  const arrastoVisual = useRef<{ id: string; x: number; y: number } | null>(null);
  /** Régua sendo arrastada agora (pontos em px do mapa; `telaA` pra saber se é toque ou medida). */
  const areaViva = useRef<{ o: Ponto; d: Ponto; telaA: { x: number; y: number }; telaB: { x: number; y: number } } | null>(null);
  /** Arrastando a grade (ferramenta "grade"): de onde partiu e onde ela começa agora. */
  const gradeViva = useRef<{ inicio: Ponto; dx: number; dy: number } | null>(null);
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
  /** Parede sendo desenhada. No modo curva, `pontos` guarda o caminho do dedo (px do mapa). */
  const paredeViva = useRef<{ a: Ponto; b: Ponto; telaA: { x: number; y: number }; telaB: { x: number; y: number }; pontos: Ponto[] | null } | null>(null);
  /** Modo apagar com o dedo descendo: as paredes por onde ele passa saem (borracha). */
  const apagandoParedes = useRef<Set<string> | null>(null);
  const portaToque = useRef<{ id: string; x: number; y: number } | null>(null);
  /** Traço de marca sendo desenhado (px do mapa): livre guarda o caminho do dedo; as outras formas
   *  guardam a `origem` e refazem os pontos a cada movimento (linha, círculo do centro à borda, retângulo de canto a canto). */
  const marcaViva = useRef<{ origem: Ponto; pontos: Ponto[]; forma: "livre" | "linha" | "circulo" | "retangulo"; telaA: { x: number; y: number }; telaB: { x: number; y: number } } | null>(null);
  /** Borracha de marcas com o dedo descendo: as marcas por onde ele passa saem. */
  const apagandoMarcas = useRef<Set<string> | null>(null);
  /** Modo editar: o desenho que o dedo está movendo, redimensionando ou girando (pontos já com o gesto aplicado). */
  const editandoMarca = useRef<{
    id: string;
    gesto: "mover" | "escala" | "giro";
    inicio: Ponto;
    original: Ponto[];
    centro: Ponto;
    distanciaInicial: number;
    anguloInicial: number;
    pontos: Ponto[];
    telaA: { x: number; y: number };
    telaB: { x: number; y: number };
  } | null>(null);

  const propsRef = useRef({ cena, mestre, interativo, seguirCamera, vistaGuiada, aoMudarVista, ferramenta, modoNevoa, pincel, aoPintar, pings, aoPingar, modoRegua, corRegua, reguas, aoMedir, modeloArea, areas, aoAreaar, paredes, modoParede, aoCriarParedes, aoApagarParede, marcas, armadilhas, modoMarca, corMarca, aoCriarTraco, aoEscolherNota, aoApagarMarca, marcaSelecionada, aoSelecionarMarca, aoTransformarMarca, aoAlternarPorta, aoSelecionarPorta, portaSelecionada, verVisaoDosInimigos, visaoPronta, aoExplorar, aoEscolherPonto, aoAlinharGrade, pecas, aoMoverPeca, aoTocarPeca, aoAbrirPeca });
  useEffect(() => {
    propsRef.current = { cena, mestre, interativo, seguirCamera, vistaGuiada, aoMudarVista, ferramenta, modoNevoa, pincel, aoPintar, pings, aoPingar, modoRegua, corRegua, reguas, aoMedir, modeloArea, areas, aoAreaar, paredes, modoParede, aoCriarParedes, aoApagarParede, marcas, armadilhas, modoMarca, corMarca, aoCriarTraco, aoEscolherNota, aoApagarMarca, marcaSelecionada, aoSelecionarMarca, aoTransformarMarca, aoAlternarPorta, aoSelecionarPorta, portaSelecionada, verVisaoDosInimigos, visaoPronta, aoExplorar, aoEscolherPonto, aoAlinharGrade, pecas, aoMoverPeca, aoTocarPeca, aoAbrirPeca };
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
    // Mapa escuro: cada jogador enxerga até onde a luz dele vai (`visaoPx`); fora disso, o alcance da cena.
    const dosJogadores = pecas.filter((x) => x.observa).map((x) => poligonoDeVisao(onde(x), segmentos, x.visaoPx ?? alcance));
    // Mapa escuro: a luz de cada um (e de marcadores com tocha) ilumina o que a vista dela alcança, e QUALQUER jogador
    // enxerga o que está à vista dele e iluminado. Sem luz acesa por aí, esta lista fica vazia e nada muda.
    const luzes = pecas.filter((x) => x.luzPx !== null).map((x) => poligonoDeVisao(onde(x), segmentos, x.luzPx as number));
    const porLuz =
      luzes.length === 0
        ? []
        : pecas.filter((x) => x.observa && x.visaoPx !== null).map((x) => ({ los: poligonoDeVisao(onde(x), segmentos, alcance), luz: luzes }));
    visaoDosInimigosRef.current = p.mestre && p.verVisaoDosInimigos ? pecas.filter((x) => x.inimigo).map((x) => poligonoDeVisao(onde(x), segmentos, alcance)) : [];
    const memoria = memoriaDaCena();
    // Só vira "já visto" o que a MESA viu: com o mapa ainda sendo preparado, o
    // Mestre pode mexer nos peões à vontade sem gastar a névoa.
    if (c.na_mesa) {
      marcarVistos(memoria, dosJogadores);
      for (const { los, luz } of porLuz) marcarVistosPorLuz(memoria, los, luz);
      // Sempre pergunta se há o que guardar (e não só quando surgiu célula nova): o
      // relógio pode ter sido cancelado, e quem sabe se já foi tudo gravado é a comparação.
      agendarExplorar();
    }
    if (!composicaoRef.current) composicaoRef.current = document.createElement("canvas");
    comporNevoaComVisao(composicaoRef.current, fino, c, dosJogadores, memoria, porLuz);
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
    const gv = gradeViva.current;
    desenharCena(ctx, {
      cena: gv ? { ...p.cena, grade_dx: gv.dx, grade_dy: gv.dy } : p.cena,
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
      portaSelecionada: p.mestre && p.ferramenta === "parede" && p.modoParede === "propriedades" ? (p.portaSelecionada ?? null) : null,
      previaParede:
        !p.mestre || !paredeViva.current
          ? null
          : paredeViva.current.pontos
            ? { tipo: "curva", pontos: paredeViva.current.pontos }
            : { tipo: p.modoParede === "comodo" ? "comodo" : p.modoParede === "porta" ? "porta" : "parede", a: paredeViva.current.a, b: paredeViva.current.b },
      visaoDosInimigos: p.mestre ? visaoDosInimigosRef.current : undefined,
      // Editando um desenho, ele aparece já com o gesto aplicado (os pontos novos só vão ao banco ao soltar).
      marcas: p.marcas
        ? marcasVisiveis(p.marcas, p.mestre).map((m) => (editandoMarca.current?.id === m.id ? { ...m, pontos: editandoMarca.current.pontos } : m))
        : undefined,
      selecaoMarca:
        p.mestre && p.ferramenta === "marca" && p.modoMarca === "editar"
          ? (editandoMarca.current?.pontos ?? p.marcas?.find((m) => m.tipo === "traco" && m.id === p.marcaSelecionada)?.pontos ?? null)
          : null,
      previaMarca: p.mestre && marcaViva.current ? { pontos: marcaViva.current.pontos, cor: p.corMarca } : null,
      armadilhas: p.armadilhas ? armadilhasVisiveis(p.armadilhas, p.mestre) : undefined,
    });
    const agora = performance.now();
    const viva = reguaViva.current;
    const previa: PreviaDeRegua | null = viva ? { a: viva.a, b: viva.b, modo: p.modoRegua, cor: p.corRegua, desloc: viva.desloc } : null;
    const vivaArea = areaViva.current;
    const previaArea: PreviaDeArea | null = vivaArea ? { modelo: p.modeloArea, o: vivaArea.o, d: vivaArea.d, cor: p.corRegua } : null;
    // "Quantas criaturas pega": só conta quem a MESA enxerga (peão oculto ou sob a névoa não
    // entra), igual pra todo mundo. O Mestre, e só ele, vê à parte quantas ocultas estão dentro.
    const criaturas = (p.pecas ?? []).map((c) => ({ x: c.x, y: c.y, raio: c.espacoPx, naMesa: !c.oculto && !cobertaPorNevoa(c.x, c.y) }));
    const contagem = criaturas.length > 0 ? (figura: FormaNoMapa) => rotuloDaContagem(contagemNaArea(figura, criaturas), p.mestre) : undefined;
    return (
      desenharAreas(ctx, p.cena, p.areas ?? [], previaArea, vistaRef.current, w, h, dpr, agora, contagem) +
      desenharPings(ctx, p.pings ?? [], vistaRef.current, w, h, dpr, agora) +
      desenharReguas(ctx, p.cena, p.reguas ?? [], previa, vistaRef.current, w, h, dpr, agora)
    );
  }, [cobertaPorNevoa]);

  const pedirQuadro = useCallback(() => {
    if (quadroRef.current) return;
    const quadro = () => {
      quadroRef.current = 0;
      if (pintar() > 0) quadroRef.current = requestAnimationFrame(quadro);
      // Todo movimento de vista passa por um quadro: aqui dá pra avisar quem
      // conduz a Vista Mestre sem espalhar chamadas por cada gesto.
      const aviso = propsRef.current.aoMudarVista;
      const v = vistaRef.current;
      const u = vistaAvisadaRef.current;
      const { w, h } = tamanhoRef.current;
      if (aviso && w > 0 && (!u || u.escala !== v.escala || u.tx !== v.tx || u.ty !== v.ty)) {
        vistaAvisadaRef.current = v;
        aviso(regiaoVisivel(v, w, h));
      }
    };
    quadroRef.current = requestAnimationFrame(quadro);
  }, [pintar]);

  const aplicarEnquadre = useCallback(() => {
    const { w, h } = tamanhoRef.current;
    const p = propsRef.current;
    if (w === 0 || h === 0 || p.cena.largura <= 0) return;
    const regiao = p.vistaGuiada || (p.seguirCamera && p.cena.camera) || { x: 0, y: 0, w: p.cena.largura, h: p.cena.altura };
    vistaRef.current = enquadrar(regiao, w, h);
    tocouRef.current = false;
    pedirQuadro();
  }, [pedirQuadro]);

  /** Desliza da vista atual até `para` (em vez de pular): foco e Vista Mestre. */
  const deslizarPara = useCallback(
    (para: Vista) => {
      cancelAnimationFrame(focoRef.current);
      const de = vistaRef.current;
      const inicio = performance.now();
      const passo = (agora: number) => {
        const t = (agora - inicio) / FOCO_MS;
        // Sai rápido e chega devagar (ease-out cúbico).
        vistaRef.current = misturarVistas(de, para, 1 - Math.pow(1 - Math.min(1, t), 3));
        pedirQuadro();
        focoRef.current = t < 1 ? requestAnimationFrame(passo) : 0;
      };
      focoRef.current = requestAnimationFrame(passo);
    },
    [pedirQuadro],
  );

  /** Pedido de foco que chegou antes de a tela ter tamanho (o "seguir a vez" ao abrir). */
  const focoPendenteRef = useRef<Ponto | null>(null);
  const focar = useCallback(
    (x: number, y: number) => {
      const { w, h } = tamanhoRef.current;
      const c = propsRef.current.cena;
      if (w === 0 || h === 0 || c.largura <= 0) {
        focoPendenteRef.current = [x, y];
        return;
      }
      focoPendenteRef.current = null;
      const alvo = enquadrar(regiaoDeFoco(c, x, y), w, h, 0);
      tocouRef.current = true;
      deslizarPara(limitarVista({ ...alvo, escala: Math.min(ZOOM_MAXIMO, Math.max(escalaMinima(c, w, h), alvo.escala)) }, c, w, h));
    },
    [deslizarPara],
  );

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
      focar,
      aproximar: (fator) => {
        const { w, h } = tamanhoRef.current;
        const c = propsRef.current.cena;
        if (w === 0 || c.largura <= 0) return;
        const v = zoomEm(vistaRef.current, w / 2, h / 2, fator, escalaMinima(c, w, h), ZOOM_MAXIMO);
        vistaRef.current = limitarVista(v, c, w, h);
        tocouRef.current = true;
        pedirQuadro();
      },
    }),
    [pedirQuadro, aplicarEnquadre, recomporNevoa, focar],
  );

  // Vista Mestre: segue o pedaço que o Mestre mostra; ao desligar, volta à vista
  // própria deste aparelho (guardada quando ligou).
  const chaveGuiada = vistaGuiada ? `${vistaGuiada.x},${vistaGuiada.y},${vistaGuiada.w},${vistaGuiada.h}` : "";
  useEffect(() => {
    const { w, h } = tamanhoRef.current;
    const p = propsRef.current;
    const guiada = p.vistaGuiada;
    if (guiada) {
      if (!vistaPropriaRef.current) vistaPropriaRef.current = { vista: w > 0 ? vistaRef.current : null, tocou: w > 0 && tocouRef.current };
      if (w === 0 || p.cena.largura <= 0) return;
      deslizarPara(limitarVista(enquadrar(guiada, w, h), p.cena, w, h));
      return;
    }
    const propria = vistaPropriaRef.current;
    if (!propria) return;
    vistaPropriaRef.current = null;
    tocouRef.current = propria.tocou;
    if (propria.vista) {
      deslizarPara(propria.vista);
      return;
    }
    // Nunca teve vista própria: volta ao enquadre de partida (a câmera da mesa ou o mapa todo).
    if (w === 0 || p.cena.largura <= 0) return;
    deslizarPara(enquadrar((p.seguirCamera && p.cena.camera) || { x: 0, y: 0, w: p.cena.largura, h: p.cena.altura }, w, h));
  }, [chaveGuiada, deslizarPara]);

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
  }, [paredes, verVisaoDosInimigos, visaoPronta, cena.visao_ligada, cena.visao_alcance, cena.escura, cena.metros, cena.grade_px, cena.na_mesa, recomporNevoa, pedirQuadro]);

  // Desenhos e notas chegaram, mudaram ou saíram (do Mestre ou de outro aparelho).
  useEffect(() => {
    pedirQuadro();
  }, [marcas, armadilhas, marcaSelecionada, modoMarca, ferramenta, portaSelecionada, pedirQuadro]);

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
      if (!tocouRef.current || propsRef.current.vistaGuiada) aplicarEnquadre();
      else {
        vistaRef.current = limitarVista(vistaRef.current, propsRef.current.cena, w, h);
        pedirQuadro();
      }
      const pendente = focoPendenteRef.current;
      if (pendente && w > 0 && h > 0) focar(pendente[0], pendente[1]);
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(caixa);
    return () => {
      obs.disconnect();
      if (quadroRef.current) cancelAnimationFrame(quadroRef.current);
      quadroRef.current = 0;
    };
  }, [aplicarEnquadre, pedirQuadro, focar]);

  // Cena nova, ou câmera nova do Mestre: reenquadra.
  const chaveCamera = cena.camera ? `${cena.camera.x},${cena.camera.y},${cena.camera.w},${cena.camera.h}` : "tudo";
  useEffect(() => {
    aplicarEnquadre();
  }, [cena.id, cena.largura, cena.altura, chaveCamera, seguirCamera, aplicarEnquadre]);

  // Desmontou no meio do deslize do foco: para o quadro.
  useEffect(() => {
    const foco = focoRef;
    return () => cancelAnimationFrame(foco.current);
  }, []);

  // Roda do mouse (notebook): precisa de ouvinte nativo pra poder impedir a
  // rolagem da página.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const aoRolar = (e: WheelEvent) => {
      const p = propsRef.current;
      if (!p.interativo) return;
      e.preventDefault();
      cancelAnimationFrame(focoRef.current);
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
    cancelAnimationFrame(focoRef.current);
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
      gradeViva.current = null;
      areaViva.current = null;
      paredeViva.current = null;
      apagandoParedes.current = null;
      editandoMarca.current = null;
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

    // Alinhar a grade (Mestre): arrastar anda a grade por cima do mapa; ao soltar, guarda onde ela começa.
    if (p.ferramenta === "grade" && p.mestre && p.aoAlinharGrade && p.cena.grade_ligada) {
      gradeViva.current = { inicio: noMapa(pos), dx: p.cena.grade_dx, dy: p.cena.grade_dy };
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
        // Borracha: a parede sob o dedo sai, e as outras por onde ele passar também.
        apagandoParedes.current = new Set();
        const alvo = acharParedeNoPonto(p.paredes ?? [], ponto, TOQUE_NA_PAREDE_PX / escala);
        if (alvo) {
          apagandoParedes.current.add(alvo.id);
          p.aoApagarParede?.(alvo.id);
        }
        return;
      }
      if (p.modoParede === "propriedades") {
        // Tocar numa porta a seleciona (pra editar trancada/secreta e as CDs); tocar no vazio solta a seleção.
        const porta = acharParedeNoPonto(p.paredes ?? [], ponto, (TOQUE_NA_PAREDE_PX * 1.5) / escala, "porta");
        p.aoSelecionarPorta?.(porta?.id ?? null);
        return;
      }
      if (!p.aoCriarParedes) return;
      if (p.modoParede === "curva") {
        // Traço livre: segue o dedo, sem grade. Só a ponta gruda em outra parede que esteja perto.
        const dentro: Ponto = [Math.min(p.cena.largura, Math.max(0, ponto[0])), Math.min(p.cena.altura, Math.max(0, ponto[1]))];
        const inicio = pontaDeParedePerto(p.paredes ?? [], dentro, escala) ?? dentro;
        paredeViva.current = { a: inicio, b: inicio, telaA: pos, telaB: pos, pontos: [inicio] };
        pedirQuadro();
        return;
      }
      const inicio = pontoParaParede(p.cena, p.paredes ?? [], ponto, escala);
      paredeViva.current = { a: inicio, b: inicio, telaA: pos, telaB: pos, pontos: null };
      pedirQuadro();
      return;
    }

    // Marcas (Mestre): arrastar risca; no modo nota, tocar escolhe o ponto; no modo
    // apagar, tocar numa marca a tira (e passar o dedo por outras, também).
    if (p.ferramenta === "marca" && p.mestre && p.modoMarca === "editar") {
      // Editar: tocar num desenho o seleciona e já o arrasta; as alças da caixa redimensionam e giram.
      // Tocar no vazio solta a seleção (e o dedo segue arrastando o mapa).
      const ponto = noMapa(pos);
      const escala = vistaRef.current.escala;
      const tracos = (p.marcas ?? []).filter((m) => m.tipo === "traco");
      const sel = tracos.find((m) => m.id === p.marcaSelecionada) ?? null;
      const alca = sel ? acharAlca(sel.pontos, escala, ponto, TOQUE_NA_ALCA_PX / escala) : null;
      const alvo = alca ? sel : acharMarcaNoPonto(tracos, ponto, (TOQUE_NA_MARCA_PX * 1.5) / escala);
      if (alvo) {
        const centro = centroDaCaixa(caixaDosPontos(alvo.pontos));
        editandoMarca.current = {
          id: alvo.id,
          gesto: alca === "escala" ? "escala" : alca === "giro" ? "giro" : "mover",
          inicio: ponto,
          original: alvo.pontos,
          centro,
          distanciaInicial: Math.max(1e-6, Math.hypot(ponto[0] - centro[0], ponto[1] - centro[1])),
          anguloInicial: Math.atan2(ponto[1] - centro[1], ponto[0] - centro[0]),
          pontos: alvo.pontos,
          telaA: pos,
          telaB: pos,
        };
        semArrastar.current = true;
        if (p.marcaSelecionada !== alvo.id) p.aoSelecionarMarca?.(alvo.id);
        pedirQuadro();
        return;
      }
      p.aoSelecionarMarca?.(null);
    } else if (p.ferramenta === "marca" && p.mestre) {
      const ponto = noMapa(pos);
      const escala = vistaRef.current.escala;
      semArrastar.current = true;
      if (p.modoMarca === "apagar") {
        apagandoMarcas.current = new Set();
        const alvo = acharMarcaNoPonto(p.marcas ?? [], ponto, TOQUE_NA_MARCA_PX / escala);
        if (alvo) {
          apagandoMarcas.current.add(alvo.id);
          p.aoApagarMarca?.(alvo.id);
        }
        return;
      }
      if (p.modoMarca === "nota") {
        // Só no soltar, se o dedo não andou (ver aoSoltar): arrastar com a nota ligada não põe nada.
        marcaViva.current = { origem: [0, 0], pontos: [], forma: "livre", telaA: pos, telaB: pos };
        return;
      }
      if (!p.aoCriarTraco) return;
      const dentro: Ponto = [Math.min(p.cena.largura, Math.max(0, ponto[0])), Math.min(p.cena.altura, Math.max(0, ponto[1]))];
      marcaViva.current = {
        origem: dentro,
        pontos: [dentro],
        forma: p.modoMarca === "linha" || p.modoMarca === "circulo" || p.modoMarca === "retangulo" ? p.modoMarca : "livre",
        telaA: pos,
        telaB: pos,
      };
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
    // Jogador só pega o peão depois de as paredes chegarem do banco: sem elas
    // não haveria o que o segurar (ver `aoMover`).
    if (p.pecas && p.aoMoverPeca && p.ferramenta === "mover" && (p.mestre || p.visaoPronta)) {
      const [mx, my] = noMapa(pos);
      const alvo = acharPecaNoPonto(p.pecas.filter((x) => x.podeMover), mx, my);
      if (alvo) {
        cancelarToqueLongo();
        arrastoPeca.current = { id: alvo.id, tamanho: alvo.tamanho, dx: mx - alvo.x, dy: my - alvo.y, x: alvo.x, y: alvo.y, ox: alvo.x, oy: alvo.y, telaX: pos.x, telaY: pos.y, moveu: false };
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
      p.mestre && ferr !== "mover" && ferr !== "ping" && ferr !== "regua" && ferr !== "area" && ferr !== "parede" && ferr !== "marca" && ferr !== "colocar" && ferr !== "grade" && p.aoPintar && (ferr !== "quadradinhos" || gradeUsavel(p.cena));
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

    // Arrastando a grade: ela anda o mesmo tanto que o dedo, e volta pro intervalo de um quadradinho.
    const gv = gradeViva.current;
    if (gv) {
      const ponto = noMapa(agora);
      const base = { grade_px: p.cena.grade_px, grade_dx: p.cena.grade_dx, grade_dy: p.cena.grade_dy };
      const nova = deslocarGrade(base, ponto[0] - gv.inicio[0], ponto[1] - gv.inicio[1]);
      gv.dx = nova.grade_dx;
      gv.dy = nova.grade_dy;
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
      if (pw.pontos) {
        const [mx, my] = noMapa(agora);
        const ponto: Ponto = [Math.min(p.cena.largura, Math.max(0, mx)), Math.min(p.cena.altura, Math.max(0, my))];
        const ultimo = pw.pontos[pw.pontos.length - 1];
        // Um ponto a cada ~1,5 px de tela (e um teto, pra um traço sem fim não pesar).
        if (Math.hypot(ponto[0] - ultimo[0], ponto[1] - ultimo[1]) * vistaRef.current.escala >= 1.5 && pw.pontos.length < 4000) pw.pontos.push(ponto);
        pw.b = ponto;
      } else {
        pw.b = pontoParaParede(p.cena, p.paredes ?? [], noMapa(agora), vistaRef.current.escala);
      }
      pw.telaB = agora;
      pedirQuadro();
      return;
    }

    // Editando um desenho: mover, redimensionar (em torno do centro) ou girar.
    const em = editandoMarca.current;
    if (em) {
      const [mx, my] = noMapa(agora);
      em.telaB = agora;
      let novos: Ponto[];
      if (em.gesto === "mover") novos = moverPontos(em.original, mx - em.inicio[0], my - em.inicio[1]);
      else if (em.gesto === "escala") {
        const fator = fatorPermitido(em.original, Math.hypot(mx - em.centro[0], my - em.centro[1]) / em.distanciaInicial);
        novos = escalarPontos(em.original, em.centro, fator);
      } else novos = girarPontos(em.original, em.centro, Math.atan2(my - em.centro[1], mx - em.centro[0]) - em.anguloInicial);
      em.pontos = manterNoMapa(novos, p.cena.largura, p.cena.altura);
      pedirQuadro();
      return;
    }

    // Arrastando um traço de marca (a nota só espera o soltar).
    const mv = marcaViva.current;
    if (mv) {
      mv.telaB = agora;
      if (mv.pontos.length > 0) {
        const [mx, my] = noMapa(agora);
        const ponto: Ponto = [Math.min(p.cena.largura, Math.max(0, mx)), Math.min(p.cena.altura, Math.max(0, my))];
        if (mv.forma === "linha") mv.pontos = [mv.origem, ponto];
        else if (mv.forma === "circulo") mv.pontos = circuloDe(mv.origem, ponto) ?? [mv.origem];
        else if (mv.forma === "retangulo") mv.pontos = retanguloDe(mv.origem, ponto) ?? [mv.origem];
        else {
          const ultimo = mv.pontos[mv.pontos.length - 1];
          // Um ponto a cada ~1,5 px de tela (e um teto, pra um rabisco sem fim não pesar).
          if (Math.hypot(ponto[0] - ultimo[0], ponto[1] - ultimo[1]) * vistaRef.current.escala >= 1.5 && mv.pontos.length < 4000) mv.pontos.push(ponto);
        }
        pedirQuadro();
      }
      return;
    }

    // Borracha de marcas: cada marca por onde o dedo passa sai (uma vez só).
    const apagadasM = apagandoMarcas.current;
    if (apagadasM) {
      const alvo = acharMarcaNoPonto(
        (p.marcas ?? []).filter((m) => !apagadasM.has(m.id)),
        noMapa(agora),
        TOQUE_NA_MARCA_PX / vistaRef.current.escala,
      );
      if (alvo) {
        apagadasM.add(alvo.id);
        p.aoApagarMarca?.(alvo.id);
      }
      return;
    }

    // Borracha de paredes: cada parede por onde o dedo passa sai (uma vez só).
    const apagadas = apagandoParedes.current;
    if (apagadas) {
      const alvo = acharParedeNoPonto(
        (p.paredes ?? []).filter((w) => !apagadas.has(w.id)),
        noMapa(agora),
        TOQUE_NA_PAREDE_PX / vistaRef.current.escala,
      );
      if (alvo) {
        apagadas.add(alvo.id);
        p.aoApagarParede?.(alvo.id);
      }
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
      const alvoX = Math.min(p.cena.largura, Math.max(0, mx - ar.dx));
      const alvoY = Math.min(p.cena.altura, Math.max(0, my - ar.dy));
      if (p.mestre) {
        ar.x = alvoX;
        ar.y = alvoY;
      } else {
        // Jogador não atravessa parede nem porta fechada: o peão encosta e
        // desliza por ela. Senão bastava arrastar o peão pra dentro de uma sala
        // fechada e a visão automática abria a névoa de lá (o Mestre põe o
        // peão onde quiser — é ele quem abre a porta).
        [ar.x, ar.y] = andarComParedes([ar.x, ar.y], [alvoX, alvoY], segmentosQueBloqueiam(p.paredes ?? []));
      }
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
      apagandoParedes.current = null;
      apagandoMarcas.current = null;
      const em = editandoMarca.current;
      if (em) {
        editandoMarca.current = null;
        // Um toque sem arrastar só seleciona; arrastou de verdade, grava os pontos novos.
        if (!cancelado && Math.hypot(em.telaB.x - em.telaA.x, em.telaB.y - em.telaA.y) >= 3) propsRef.current.aoTransformarMarca?.(em.id, em.pontos);
        pedirQuadro();
        return;
      }
      const mv = marcaViva.current;
      if (mv) {
        marcaViva.current = null;
        const p = propsRef.current;
        const arrastou = Math.hypot(mv.telaB.x - mv.telaA.x, mv.telaB.y - mv.telaA.y) >= TRACO_MINIMO_PX;
        if (!cancelado) {
          if (mv.pontos.length === 0) {
            // Modo nota: um toque (sem arrastar) abre o campo do texto naquele ponto.
            if (!arrastou) {
              const [mx, my] = noMapa(mv.telaB);
              p.aoEscolherNota?.([Math.min(p.cena.largura, Math.max(0, mx)), Math.min(p.cena.altura, Math.max(0, my))]);
            }
          } else if (arrastou) {
            // Círculo e retângulo já saem prontos da prévia; sem o arrasto ter dado forma (raio ou lado zero), nada.
            const pontos =
              mv.forma === "linha"
                ? linhaReta(mv.origem, mv.pontos[mv.pontos.length - 1])
                : mv.forma === "livre"
                  ? simplificarDesenho(mv.pontos, vistaRef.current.escala)
                  : mv.pontos.length > 2
                    ? mv.pontos
                    : null;
            if (pontos) p.aoCriarTraco?.(pontos);
          }
        }
        pedirQuadro();
        return;
      }
      const gv = gradeViva.current;
      if (gv) {
        gradeViva.current = null;
        const p = propsRef.current;
        if (!cancelado && (gv.dx !== p.cena.grade_dx || gv.dy !== p.cena.grade_dy)) p.aoAlinharGrade?.(gv.dx, gv.dy);
        pedirQuadro();
        return;
      }
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
        if (!cancelado && pw.pontos) {
          // Curva: o caminho do dedo vira trechos retos curtos. A última ponta
          // gruda em outra parede perto; voltando ao começo, a volta fecha.
          const escala = vistaRef.current.escala;
          const fim = pw.pontos[pw.pontos.length - 1];
          const grudado = pontaDeParedePerto(p.paredes ?? [], fim, escala);
          const caminho = grudado ? [...pw.pontos, grudado] : pw.pontos;
          const novas = paredesDoTraco(caminho, TOLERANCIA_DA_CURVA_PX / escala, ENCAIXE_NA_PONTA_PX / escala);
          if (novas.length > 0) p.aoCriarParedes?.(novas);
        } else if (!cancelado && arrastou) {
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
          // Toque sem arrasto: abre as ações do peão (dano, condição, a vez).
          if (!cancelado) propsRef.current.aoAbrirPeca?.(ar.id);
        } else {
          const p = propsRef.current;
          const tamanho = ar.tamanho as 1 | 2 | 3 | 4;
          let [x, y] = encaixarNaGrade(p.cena, ar.x, ar.y, tamanho);
          if (!p.mestre) {
            // O encaixe no quadradinho também não pode pular uma parede (uma
            // que corte o quadradinho ao meio): pousa no vizinho mais perto a
            // que dê pra chegar, e sem nenhum o peão volta pra onde estava.
            const g = gradeUsavel(p.cena) ? p.cena.grade_px : 0;
            const candidatos = [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => encaixarNaGrade(p.cena, ar.x + i * g, ar.y + j * g, tamanho)));
            [x, y] = pousoLivre([ar.x, ar.y], candidatos, segmentosQueBloqueiam(p.paredes ?? [])) ?? [ar.ox, ar.oy];
          }
          if (x === ar.ox && y === ar.oy) {
            arrastoVisual.current = null;
          } else {
            // Fica desenhado no lugar novo até a lista de peões chegar com ele.
            arrastoVisual.current = { id: ar.id, x, y };
            p.aoMoverPeca?.(ar.id, x, y);
          }
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

  const pintando = mestre && ferramenta !== "mover" && ferramenta !== "ping" && ferramenta !== "regua" && ferramenta !== "area" && ferramenta !== "parede" && ferramenta !== "marca" && ferramenta !== "colocar" && ferramenta !== "grade";
  return (
    <div ref={caixaRef} className="cena-caixa" data-pronto={visaoPronta ? "sim" : "nao"}>
      <canvas
        ref={canvasRef}
        className="cena-canvas"
        style={{ cursor: !interativo ? "default" : pintando || ferramenta === "regua" || ferramenta === "area" || ferramenta === "parede" || ferramenta === "marca" || ferramenta === "colocar" ? "crosshair" : ferramenta === "ping" ? "pointer" : "grab", pointerEvents: interativo ? "auto" : "none" }}
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
