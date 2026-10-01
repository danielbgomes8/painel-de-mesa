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
import { desenharCena, desenharNevoa, type FormaDesenhavel } from "@/lib/desenharCena";

export type Ferramenta = "mover" | "quadradinhos" | "pincel" | "retangulo";

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
  ref?: Ref<CenaMapaApi>;
};

type Pintura = {
  ferramenta: Exclude<Ferramenta, "mover">;
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

  const propsRef = useRef({ cena, mestre, interativo, seguirCamera, ferramenta, modoNevoa, pincel, aoPintar });
  useEffect(() => {
    propsRef.current = { cena, mestre, interativo, seguirCamera, ferramenta, modoNevoa, pincel, aoPintar };
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

  const pintar = useCallback(() => {
    const canvas = canvasRef.current;
    const { w, h, dpr } = tamanhoRef.current;
    if (!canvas || w === 0 || h === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
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
    });
  }, []);

  const pedirQuadro = useCallback(() => {
    if (quadroRef.current) return;
    quadroRef.current = requestAnimationFrame(() => {
      quadroRef.current = 0;
      pintar();
    });
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

  // Névoa: redesenhada por inteiro a cada mudança das pinceladas.
  useEffect(() => {
    if (!nevoaRef.current) nevoaRef.current = document.createElement("canvas");
    if (cena.largura > 0 && cena.altura > 0) desenharNevoa(nevoaRef.current, cena, regras);
    pedirQuadro();
  }, [cena, regras, pedirQuadro]);

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

  function aoPressionar(e: React.PointerEvent) {
    const p = propsRef.current;
    if (!p.interativo) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = posicao(e);
    dedos.current.set(e.pointerId, pos);

    if (dedos.current.size >= 2) {
      // Segundo dedo: cancela a pincelada e vira pinça.
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

    const pintavel =
      p.mestre && p.ferramenta !== "mover" && p.aoPintar && (p.ferramenta !== "quadradinhos" || gradeUsavel(p.cena));
    if (pintavel && p.ferramenta !== "mover") {
      const ponto = noMapa(pos);
      pintura.current = {
        ferramenta: p.ferramenta,
        modo: p.modoNevoa,
        raio: raioDoPincel(p.cena, p.pincel),
        pontos: [ponto],
        inicio: ponto,
        ultimo: ponto,
        celulas: p.ferramenta === "quadradinhos" ? celulasNoSegmento(p.cena, ponto, ponto) : [],
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
    if (dedos.current.size < 2) pinca.current = null;
    if (dedos.current.size === 0) {
      if (cancelado) {
        pintura.current = null;
        previaRef.current = null;
        pedirQuadro();
      } else confirmarPintura();
    }
  }

  const pintando = mestre && ferramenta !== "mover";
  return (
    <div ref={caixaRef} className="cena-caixa">
      <canvas
        ref={canvasRef}
        className="cena-canvas"
        style={{ cursor: !interativo ? "default" : pintando ? "crosshair" : "grab", pointerEvents: interativo ? "auto" : "none" }}
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
