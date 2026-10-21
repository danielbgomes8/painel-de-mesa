"use client";

import { useEffect, useRef, useState } from "react";
import { type Quadro } from "@/hooks/useQuadro";
import { LIMITE_COLUNA, SEM_COLUNA, agruparPorColuna, type Cartao } from "@/lib/quadro";

export const BORDA_DA_ROLAGEM = 56;

export const velocidadeDaRolagem = (dentro: number) => Math.round(4 + 16 * Math.min(1, Math.max(0, dentro / BORDA_DA_ROLAGEM)));

/** Com o dedo perto da borda, rola o quadro (de lado, se houver `lista`, e a página pra baixo/cima).
 *  Devolve se rolou: aí o que está sob o dedo mudou e o chamador refaz a conta. Roda a cada quadro
 *  da animação: no celular não dá pra "rolar com outro dedo" no meio do arrasto. */
export function rolarPelaBorda(x: number, y: number, lista: HTMLElement | null): boolean {
  let rolou = false;
  if (lista) {
    const r = lista.getBoundingClientRect();
    if (x < r.left + BORDA_DA_ROLAGEM && lista.scrollLeft > 0) {
      lista.scrollLeft -= velocidadeDaRolagem(r.left + BORDA_DA_ROLAGEM - x);
      rolou = true;
    } else if (x > r.right - BORDA_DA_ROLAGEM && lista.scrollLeft < lista.scrollWidth - lista.clientWidth) {
      lista.scrollLeft += velocidadeDaRolagem(x - (r.right - BORDA_DA_ROLAGEM));
      rolou = true;
    }
  }
  const altura = window.innerHeight;
  if (y < BORDA_DA_ROLAGEM + 40 && window.scrollY > 0) {
    window.scrollBy(0, -velocidadeDaRolagem(BORDA_DA_ROLAGEM + 40 - y));
    rolou = true;
  } else if (y > altura - BORDA_DA_ROLAGEM && window.scrollY < document.documentElement.scrollHeight - altura) {
    window.scrollBy(0, velocidadeDaRolagem(y - (altura - BORDA_DA_ROLAGEM)));
    rolou = true;
  }
  return rolou;
}

/** Arrastar pela alça 🔗 até outro cartão. Soltar em cima de um cartão devolve
 *  `solto` ({ de, para }); a tela então pergunta o tipo da ligação. */
export function useArrastoDeLigacao(listaRef: React.RefObject<HTMLDivElement | null>) {
  const [estado, setEstado] = useState<{ de: string; titulo: string; x: number; y: number; sobre: string | null } | null>(null);
  const [solto, setSolto] = useState<{ de: string; para: string } | null>(null);
  const deRef = useRef<string | null>(null);
  const posRef = useRef({ x: 0, y: 0 });

  const comecar = (e: React.PointerEvent<HTMLSpanElement>, c: Cartao) => {
    e.preventDefault();
    deRef.current = c.id;
    posRef.current = { x: e.clientX, y: e.clientY };
    setSolto(null);
    setEstado({ de: c.id, titulo: c.titulo || "Sem nome", x: e.clientX, y: e.clientY, sobre: null });
  };

  const ativo = estado !== null;
  useEffect(() => {
    if (!ativo) return;
    const cartaoEm = (x: number, y: number): string | null => {
      const id = (document.elementFromPoint(x, y)?.closest("[data-cartao-id]") as HTMLElement | null)?.dataset.cartaoId ?? null;
      return id && id !== deRef.current ? id : null;
    };
    function mover(e: PointerEvent) {
      posRef.current = { x: e.clientX, y: e.clientY };
      setEstado((a) => (a ? { ...a, x: e.clientX, y: e.clientY, sobre: cartaoEm(e.clientX, e.clientY) } : a));
    }
    // Perto da borda o quadro rola sozinho: o cartão de destino pode estar fora da tela.
    let quadro = 0;
    function rolar() {
      const { x, y } = posRef.current;
      if (rolarPelaBorda(x, y, listaRef.current)) {
        const sobre = cartaoEm(x, y);
        setEstado((a) => (a && a.sobre !== sobre ? { ...a, sobre } : a));
      }
      quadro = requestAnimationFrame(rolar);
    }
    quadro = requestAnimationFrame(rolar);
    function soltar(e: PointerEvent) {
      const de = deRef.current;
      const para = cartaoEm(e.clientX, e.clientY);
      deRef.current = null;
      setEstado(null);
      if (de && para) setSolto({ de, para });
    }
    function cancelar() {
      deRef.current = null;
      setEstado(null);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") cancelar();
    }
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", cancelar);
    window.addEventListener("keydown", tecla);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", cancelar);
      window.removeEventListener("keydown", tecla);
    };
  }, [ativo, listaRef]);

  return {
    comecar,
    de: estado?.de ?? null,
    sobre: estado?.sobre ?? null,
    solto,
    limpar: () => setSolto(null),
    fantasma: estado ? { x: estado.x, y: estado.y, titulo: estado.titulo } : null,
  };
}

export const COLUNA_NOVA = "__nova__";

/** Na vista em colunas o Mestre mostra "Sem coluna" mesmo vazia, pra ter onde soltar. */
export function comSemColuna(colunas: ReturnType<typeof agruparPorColuna>) {
  return colunas.some((c) => c.valor === "") ? colunas : [...colunas, { nome: SEM_COLUNA, valor: "", cartoes: [] }];
}

/** Arrastar pela alça (⠿) com o dedo ou o mouse: o cartão acompanha o ponteiro e a
 *  coluna por baixo acende; soltar grava a coluna. Soltar em "nova coluna" pergunta o nome.
 *  A alça tem `touch-action: none`, então arrastar nela não rola a página. */
export function useArrastoDeColuna(quadro: Quadro, habilitado: boolean, listaRef: React.RefObject<HTMLDivElement | null>) {
  const [estado, setEstado] = useState<{ id: string; titulo: string; x: number; y: number; sobre: string | null } | null>(null);
  const idRef = useRef<string | null>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const quadroRef = useRef(quadro);
  useEffect(() => {
    quadroRef.current = quadro;
  }, [quadro]);

  const comecar = (e: React.PointerEvent<HTMLSpanElement>, c: Cartao) => {
    if (!habilitado) return;
    e.preventDefault();
    idRef.current = c.id;
    posRef.current = { x: e.clientX, y: e.clientY };
    // Uma batidinha avisa que o cartão "pegou" (celulares sem vibração não ligam).
    try {
      navigator.vibrate?.(15);
    } catch {
      // sem vibração: o cartão acompanhando o dedo já mostra
    }
    setEstado({ id: c.id, titulo: c.titulo || "Sem nome", x: e.clientX, y: e.clientY, sobre: null });
  };

  const ativo = estado !== null;
  useEffect(() => {
    if (!ativo) return;
    function colunaEm(x: number, y: number): string | null {
      const alvo = document.elementFromPoint(x, y)?.closest("[data-coluna]") as HTMLElement | null;
      return alvo ? alvo.dataset.coluna ?? "" : null;
    }
    function mover(e: PointerEvent) {
      posRef.current = { x: e.clientX, y: e.clientY };
      setEstado((a) => (a ? { ...a, x: e.clientX, y: e.clientY, sobre: colunaEm(e.clientX, e.clientY) } : a));
    }
    // Perto da borda o quadro rola sozinho, mesmo com o dedo parado.
    let quadro = 0;
    function rolar() {
      const { x, y } = posRef.current;
      if (rolarPelaBorda(x, y, listaRef.current)) {
        // O que está sob o dedo mudou porque o quadro andou.
        const sobre = colunaEm(x, y);
        setEstado((a) => (a && a.sobre !== sobre ? { ...a, sobre } : a));
      }
      quadro = requestAnimationFrame(rolar);
    }
    quadro = requestAnimationFrame(rolar);
    function soltar(e: PointerEvent) {
      const id = idRef.current;
      idRef.current = null;
      setEstado(null);
      const destino = colunaEm(e.clientX, e.clientY);
      if (!id || destino === null) return;
      const cartao = quadroRef.current.cartoes.find((c) => c.id === id);
      if (!cartao) return;
      let coluna = destino;
      if (destino === COLUNA_NOVA) {
        const nome = window.prompt("Nome da nova coluna:", "")?.trim().slice(0, LIMITE_COLUNA);
        if (!nome) return;
        coluna = nome;
      }
      if (coluna !== cartao.coluna.trim()) void quadroRef.current.atualizar(id, { coluna });
    }
    function cancelar() {
      idRef.current = null;
      setEstado(null);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") cancelar();
    }
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", cancelar);
    window.addEventListener("keydown", tecla);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", cancelar);
      window.removeEventListener("keydown", tecla);
    };
  }, [ativo, listaRef]);

  return {
    comecar,
    ativo,
    id: estado?.id ?? null,
    sobre: estado?.sobre ?? null,
    fantasma: estado ? { x: estado.x, y: estado.y, titulo: estado.titulo } : null,
  };
}
