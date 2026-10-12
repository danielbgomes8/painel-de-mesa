"use client";

import { useState } from "react";
import type { Cena } from "@/lib/cenas";
import { avaliarPisadas, vigia, type Armadilha, type EstadoDePisadas, type Pisada } from "@/lib/armadilhas";
import { avaliarPercepcao, type Achado, type EstadoDePercepcao } from "@/lib/percepcao";
import type { Parede } from "@/lib/paredes";

type PecaParaPisar = { id: string; x: number; y: number; espacoPx: number; nome: string; slug?: string | null; /** Percepção passiva da ficha (só jogador). */ pp?: number | null };

type Memoria = {
  pecas: readonly PecaParaPisar[];
  armadilhas: readonly Armadilha[];
  paredes: readonly Parede[];
  estado: EstadoDePisadas | null;
  percepcao: EstadoDePercepcao | null;
  cenaId: string | null;
  vezDe: string | null;
  pendentes: Pisada[];
  achados: Achado[];
};

const chaveDe = (p: Pick<Pisada, "pecaId" | "armadilhaId">) => `${p.pecaId}:${p.armadilhaId}`;
const chaveDoAchado = (a: Pick<Achado, "pecaId" | "alvo" | "alvoId">) => `${a.pecaId}:${a.alvo}:${a.alvoId}`;

const VAZIA: Memoria = { pecas: [], armadilhas: [], paredes: [], estado: null, percepcao: null, cenaId: null, vezDe: null, pendentes: [], achados: [] };
const SEM_PAREDES: readonly Parede[] = [];

/**
 * O que o Mestre precisa saber do que os peões fazem perto de armadilhas e portas:
 * - **pisadas**: alguém acabou de pisar numa armadilha (ou, num perigo, de entrar ou começar o turno dentro);
 * - **achados**: alguém com Percepção passiva alta o bastante repara numa armadilha escondida ou numa porta secreta.
 * Roda a cada mudança de peão, de armadilha ou de parede (peão arrastado aqui, jogador andando no celular dele,
 * armadilha posta) e junta os avisos até o Mestre resolver cada um.
 *
 * Sem efeito: o lint do projeto proíbe `setState` dentro de `useEffect`, então o estado é ajustado durante a
 * própria renderização, que é o jeito que o React recomenda pra "derivar do que mudou". As contas
 * (`avaliarPisadas`, `avaliarPercepcao`) são puras, então renderizar duas vezes dá o mesmo resultado.
 */
export function usePisadas(
  cena: Cena | null,
  armadilhas: readonly Armadilha[],
  pecas: readonly PecaParaPisar[],
  vezDe: string | null = null,
  paredes: readonly Parede[] = SEM_PAREDES,
) {
  const [m, setM] = useState<Memoria>(VAZIA);
  let atual = m;
  if (cena && (m.pecas !== pecas || m.armadilhas !== armadilhas || m.paredes !== paredes || m.cenaId !== cena.id || m.vezDe !== vezDe)) {
    // Outra cena: recomeça do zero (a primeira conferência só aprende o terreno).
    const base = m.cenaId === cena.id ? m : { ...m, estado: null, percepcao: null, pendentes: [], achados: [] };
    const r = avaliarPisadas(base.estado, { cena, armadilhas, pecas, vezDe });
    const jaTem = new Set(base.pendentes.map(chaveDe));
    const novas = r.pisadas.filter((p) => !jaTem.has(chaveDe(p)));
    const p = avaliarPercepcao(base.percepcao, { cena, armadilhas, paredes, pecas });
    const jaAchou = new Set(base.achados.map(chaveDoAchado));
    const achadosNovos = p.achados.filter((a) => !jaAchou.has(chaveDoAchado(a)));
    atual = {
      pecas,
      armadilhas,
      paredes,
      estado: r.estado,
      percepcao: p.estado,
      cenaId: cena.id,
      vezDe,
      pendentes: [...base.pendentes, ...novas],
      achados: [...base.achados, ...achadosNovos],
    };
    setM(atual);
  }
  // Só vale o aviso de quem ainda existe, ainda está no peão certo e numa armadilha que ainda vigia.
  const pendentes = atual.pendentes.filter((p) => {
    const a = armadilhas.find((x) => x.id === p.armadilhaId);
    return a !== undefined && vigia(a) && pecas.some((x) => x.id === p.pecaId);
  });
  // Achado vale enquanto o alvo ainda está escondido/secreto e o peão ainda existe (se o Mestre já revelou, o aviso some).
  const achados = atual.achados.filter((a) => {
    if (!pecas.some((x) => x.id === a.pecaId)) return false;
    return a.alvo === "armadilha"
      ? armadilhas.some((x) => x.id === a.alvoId && x.estado === "armada")
      : paredes.some((x) => x.id === a.alvoId && x.tipo === "porta" && x.secreta);
  });

  function resolver(p: Pick<Pisada, "pecaId" | "armadilhaId">) {
    const k = chaveDe(p);
    setM((antes) => ({ ...antes, pendentes: antes.pendentes.filter((x) => chaveDe(x) !== k) }));
  }

  function resolverAchado(a: Pick<Achado, "pecaId" | "alvo" | "alvoId">) {
    const k = chaveDoAchado(a);
    setM((antes) => ({ ...antes, achados: antes.achados.filter((x) => chaveDoAchado(x) !== k) }));
  }

  return { pendentes, resolver, achados, resolverAchado };
}
