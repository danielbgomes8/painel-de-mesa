"use client";

import { useState } from "react";
import type { Cena } from "@/lib/cenas";
import { avaliarPisadas, vigia, type Armadilha, type EstadoDePisadas, type Pisada } from "@/lib/armadilhas";

type PecaParaPisar = { id: string; x: number; y: number; espacoPx: number; nome: string; slug?: string | null };

type Memoria = {
  pecas: readonly PecaParaPisar[];
  armadilhas: readonly Armadilha[];
  estado: EstadoDePisadas | null;
  cenaId: string | null;
  vezDe: string | null;
  pendentes: Pisada[];
};

const chaveDe = (p: Pick<Pisada, "pecaId" | "armadilhaId">) => `${p.pecaId}:${p.armadilhaId}`;

/**
 * Quem acabou de pisar numa armadilha (ou, num perigo, de entrar nele ou começar o turno dentro), pro Mestre. Roda a cada mudança de peão ou de armadilha (peão arrastado
 * aqui, jogador andando no celular dele, armadilha posta) e junta os avisos até o Mestre resolver cada um.
 *
 * Sem efeito: o lint do projeto proíbe `setState` dentro de `useEffect`, então o estado é ajustado durante a
 * própria renderização, que é o jeito que o React recomenda pra "derivar do que mudou". A conta
 * (`avaliarPisadas`) é pura, então renderizar duas vezes dá o mesmo resultado.
 *
 * Só avisa enquanto a aba do Mapa do Mestre está aberta: é ela que enxerga os peões e as armadilhas.
 */
export function usePisadas(cena: Cena | null, armadilhas: readonly Armadilha[], pecas: readonly PecaParaPisar[], vezDe: string | null = null) {
  const [m, setM] = useState<Memoria>({ pecas: [], armadilhas: [], estado: null, cenaId: null, vezDe: null, pendentes: [] });
  let atual = m;
  if (cena && (m.pecas !== pecas || m.armadilhas !== armadilhas || m.cenaId !== cena.id || m.vezDe !== vezDe)) {
    // Outra cena: recomeça do zero (a primeira conferência só aprende o terreno).
    const base = m.cenaId === cena.id ? m : { ...m, estado: null, pendentes: [] };
    const r = avaliarPisadas(base.estado, { cena, armadilhas, pecas, vezDe });
    const jaTem = new Set(base.pendentes.map(chaveDe));
    const novas = r.pisadas.filter((p) => !jaTem.has(chaveDe(p)));
    atual = { pecas, armadilhas, estado: r.estado, cenaId: cena.id, vezDe, pendentes: [...base.pendentes, ...novas] };
    setM(atual);
  }
  // Só vale o aviso de quem ainda existe, ainda está no peão certo e numa armadilha que ainda vigia.
  const pendentes = atual.pendentes.filter((p) => {
    const a = armadilhas.find((x) => x.id === p.armadilhaId);
    return a !== undefined && vigia(a) && pecas.some((x) => x.id === p.pecaId);
  });

  function resolver(p: Pick<Pisada, "pecaId" | "armadilhaId">) {
    const k = chaveDe(p);
    setM((antes) => ({ ...antes, pendentes: antes.pendentes.filter((x) => chaveDe(x) !== k) }));
  }

  return { pendentes, resolver };
}
