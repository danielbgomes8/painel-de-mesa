"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Ligacao, CartaoVisto } from "@/lib/quadro";
import { TITULO_DA_SILHUETA, emojiDoTipo } from "@/lib/quadro";
import {
  RAIO_DO_NO,
  chaveDoMapa,
  desenharLinhas,
  foiToque,
  posicionarNos,
  separarConectados,
  tamanhoDoMapa,
  type PosicaoDoNo,
} from "@/lib/grafo";

function cortar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

/** O Quadro visto como mapa: cada cartão é um círculo e cada ligação, uma seta com o tipo
 *  escrito em cima. A posição sai de uma simulação de forças (igual em todo aparelho);
 *  dá pra arrastar um círculo pra desembaraçar (só na sua tela). Tocar abre o cartão. */
export function MapaDeLigacoes({
  vistos,
  ligacoes,
  urlDaFoto,
  aoAbrir,
}: {
  vistos: CartaoVisto[];
  ligacoes: Ligacao[];
  urlDaFoto: (c: CartaoVisto["cartao"]) => string | null;
  aoAbrir: (id: string) => void;
}) {
  const porId = useMemo(() => new Map(vistos.map((v) => [v.cartao.id, v])), [vistos]);
  // Só ligações cujos dois cartões esta pessoa enxerga (senão entregaria que o outro existe).
  const arestas = useMemo(
    () => ligacoes.filter((l) => porId.has(l.de) && porId.has(l.para)),
    [ligacoes, porId],
  );
  const { conectados, soltos } = useMemo(
    () => separarConectados(vistos.map((v) => ({ id: v.cartao.id })), arestas),
    [vistos, arestas],
  );
  // O desenho muda (cartão ou ligação nova): remonta e refaz as posições.
  const chave = chaveDoMapa(conectados, arestas);

  return (
    <div className="qd-mapa">
      {conectados.length === 0 ? (
        <p className="empty-note">
          Ainda não há ligações. Arraste a alça 🔗 de um cartão até outro (na galeria ou nas colunas) para ligar os dois.
        </p>
      ) : (
        <Desenho key={chave} ids={conectados.map((n) => n.id)} arestas={arestas} porId={porId} urlDaFoto={urlDaFoto} aoAbrir={aoAbrir} />
      )}
      {soltos.length > 0 && (
        <div className="qd-soltos">
          <span className="qd-rotulo">Sem ligações:</span>
          {soltos.map((n) => {
            const v = porId.get(n.id)!;
            return (
              <button key={n.id} type="button" className="chip" onClick={() => aoAbrir(n.id)}>
                {emojiDoTipo(v.cartao.tipo)} {v.visao === "silhueta" ? TITULO_DA_SILHUETA : v.cartao.titulo || "Sem nome"}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Desenho({
  ids,
  arestas,
  porId,
  urlDaFoto,
  aoAbrir,
}: {
  ids: string[];
  arestas: Ligacao[];
  porId: Map<string, CartaoVisto>;
  urlDaFoto: (c: CartaoVisto["cartao"]) => string | null;
  aoAbrir: (id: string) => void;
}) {
  // Calculado uma vez: o pai remonta este componente quando cartões ou ligações mudam.
  const [base] = useState(() => posicionarNos(ids.map((id) => ({ id })), arestas));
  const [ajustes, setAjustes] = useState<Map<string, PosicaoDoNo>>(new Map());
  const [zoom, setZoom] = useState<number | null>(null); // null = cabe na largura
  const [puxando, setPuxando] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);

  const pos = useMemo(() => {
    const m = new Map(base);
    for (const [id, p] of ajustes) m.set(id, p);
    return m;
  }, [base, ajustes]);
  const { largura, altura } = tamanhoDoMapa(ids.length);
  const linhas = useMemo(() => desenharLinhas(arestas, pos), [arestas, pos]);
  const rotuloDe = new Map(arestas.map((a) => [a.id, a]));

  // Arrastar um círculo: a conta é no sistema de coordenadas do desenho (o zoom não entra).
  // Os ouvintes são ligados NA HORA do toque (não depois do React redesenhar): se o dedo
  // levantar antes, o círculo não pode ficar grudado no ponteiro.
  const abrirRef = useRef(aoAbrir);
  const encerrarRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    abrirRef.current = aoAbrir;
  }, [aoAbrir]);
  useEffect(() => () => encerrarRef.current?.(), []);

  function comecarArrasto(e: React.PointerEvent<SVGGElement>, id: string) {
    e.preventDefault();
    encerrarRef.current?.();
    const ini = { x: e.clientX, y: e.clientY };
    setPuxando(id);
    function mover(ev: PointerEvent) {
      if (foiToque(ini, { x: ev.clientX, y: ev.clientY })) return;
      const m = svgRef.current?.getScreenCTM();
      if (!m) return;
      const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
      const margem = RAIO_DO_NO + 4;
      const x = Math.min(largura - margem, Math.max(margem, p.x));
      const y = Math.min(altura - margem, Math.max(margem, p.y));
      setAjustes((a) => new Map(a).set(id, { x, y }));
    }
    function soltar(ev: PointerEvent) {
      const toque = foiToque(ini, { x: ev.clientX, y: ev.clientY });
      encerrar();
      if (toque) abrirRef.current(id);
    }
    function encerrar() {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", encerrar);
      encerrarRef.current = null;
      setPuxando(null);
    }
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", encerrar);
    encerrarRef.current = encerrar;
  }

  function escalaAtual(): number {
    return zoom ?? (caixaRef.current ? caixaRef.current.clientWidth / largura : 1);
  }

  return (
    <>
      <div className="qd-mapabarra" role="group" aria-label="Zoom do mapa">
        <button type="button" className="chip" onClick={() => setZoom(Math.min(3, escalaAtual() * 1.3))} aria-label="Aproximar o mapa">
          ＋
        </button>
        <button type="button" className="chip" onClick={() => setZoom(Math.max(0.3, escalaAtual() / 1.3))} aria-label="Afastar o mapa">
          －
        </button>
        <button type="button" className="chip" onClick={() => setZoom(null)} aria-pressed={zoom === null}>
          ajustar
        </button>
        {ajustes.size > 0 && (
          <button type="button" className="chip" onClick={() => setAjustes(new Map())}>
            desfazer arrastos
          </button>
        )}
        <span className="qd-formdica">Toque num círculo para abrir. Arraste para desembaraçar.</span>
      </div>
      <div className="qd-mapacaixa" ref={caixaRef}>
        <svg
          ref={svgRef}
          className="qd-mapasvg"
          viewBox={`0 0 ${largura} ${altura}`}
          style={zoom === null ? { width: "100%", maxWidth: largura * 1.7 } : { width: largura * zoom }}
          role="group"
          aria-label="Mapa de ligações entre os cartões"
        >
          <defs>
            <marker id="qd-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" className="qd-setacor" />
            </marker>
            {ids.map((id) => (
              <clipPath key={id} id={`qd-clip-${id}`}>
                <circle r={RAIO_DO_NO - 2} />
              </clipPath>
            ))}
          </defs>

          {linhas.map((l) => {
            const a = rotuloDe.get(l.id)!;
            const de = porId.get(a.de)!;
            const para = porId.get(a.para)!;
            // Em silhueta, o tipo da ligação também é segredo.
            const texto = de.visao === "silhueta" || para.visao === "silhueta" ? "?" : a.rotulo || "";
            return (
              <g key={l.id} className="qd-aresta">
                <path d={`M ${l.x1} ${l.y1} Q ${l.cx} ${l.cy} ${l.x2} ${l.y2}`} fill="none" className="qd-linha-svg" markerEnd="url(#qd-seta)" />
                {texto && (
                  <text x={l.rx} y={l.ry} textAnchor="middle" dominantBaseline="middle" className="qd-rotulo-svg">
                    {cortar(texto, 22)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Os nomes ficam numa camada própria, por baixo dos círculos e sem captar toque:
              o nome de um cartão não pode tapar o círculo do vizinho. */}
          <g className="qd-nomes" pointerEvents="none">
            {ids.map((id) => {
              const v = porId.get(id)!;
              const p = pos.get(id)!;
              const titulo = v.visao === "silhueta" ? TITULO_DA_SILHUETA : v.cartao.titulo || "Sem nome";
              return (
                <text key={id} x={p.x} y={p.y + RAIO_DO_NO + 14} textAnchor="middle" className="qd-no-nome">
                  {cortar(titulo, 16)}
                </text>
              );
            })}
          </g>

          {ids.map((id) => {
            const v = porId.get(id)!;
            const p = pos.get(id)!;
            const silhueta = v.visao === "silhueta";
            const url = silhueta ? null : urlDaFoto(v.cartao);
            const titulo = silhueta ? TITULO_DA_SILHUETA : v.cartao.titulo || "Sem nome";
            return (
              <g
                key={id}
                className="qd-no"
                data-cartao-no={id}
                data-puxando={puxando === id || undefined}
                transform={`translate(${p.x} ${p.y})`}
                role="button"
                tabIndex={0}
                aria-label={`Abrir ${titulo}`}
                onPointerDown={(e) => comecarArrasto(e, id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") aoAbrir(id);
                }}
              >
                <circle r={RAIO_DO_NO} className="qd-no-fundo" data-silhueta={silhueta || undefined} />
                {url ? (
                  <image href={url} x={-(RAIO_DO_NO - 2)} y={-(RAIO_DO_NO - 2)} width={2 * (RAIO_DO_NO - 2)} height={2 * (RAIO_DO_NO - 2)} preserveAspectRatio="xMidYMid slice" clipPath={`url(#qd-clip-${id})`} />
                ) : (
                  <text textAnchor="middle" dominantBaseline="central" className="qd-no-emoji">
                    {silhueta ? "?" : emojiDoTipo(v.cartao.tipo)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}
