"use client";

import { useEffect, useRef } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Eventos } from "@/hooks/useEventos";
import { testeDeConcentracao } from "@/lib/eventosCombate";

type Vida = { hp: number; hp_temp: number; concentration: boolean; concentration_on: string };

/**
 * No aparelho do Mestre: quando quem está concentrado perde PV (de qualquer jeito — o Mestre no painel, o jogador no
 * −/+ da própria ficha, as Ações em Massa), cria o aviso fixo de teste de Constituição (`tipo = 'concentracao'`
 * em `combate_eventos`, ver migration 0039). Olha a mudança que CHEGA na tela em vez de cada caminho de escrita,
 * então um caminho novo de dano não precisa lembrar de avisar. O app não rola nada: só diz a CD.
 *
 * Limite conhecido: quem avisa é o aparelho do Mestre aberto no momento do dano. O log público continua trazendo a
 * CD de qualquer jeito (ver `danoComLog`).
 */
export function useAvisoDeConcentracao(sala: Sala, souMestre: boolean, { criar, indisponivel }: Eventos): void {
  const vistos = useRef<Map<string, Vida> | null>(null);

  useEffect(() => {
    if (!souMestre) {
      vistos.current = null;
      return;
    }
    const anteriores = vistos.current;
    const agora = new Map<string, Vida>();
    for (const p of sala.personagens) {
      agora.set(p.id, { hp: p.hp, hp_temp: p.hp_temp, concentration: p.concentration, concentration_on: p.concentration_on });
    }
    vistos.current = agora;
    // Primeira leitura (ou volta de uma lista vazia): só memoriza, senão abrir o app avisaria de dano velho.
    if (!anteriores || anteriores.size === 0 || indisponivel) return;

    const novos = [];
    for (const p of sala.personagens) {
      const antes = anteriores.get(p.id);
      if (!antes) continue;
      const teste = testeDeConcentracao(antes, agora.get(p.id)!);
      if (!teste) continue;
      novos.push({ tipo: "concentracao" as const, rodada: null, slugs: [p.slug], pct: null, texto: teste.texto, publico: false });
    }
    if (novos.length > 0) void criar(novos);
  }, [sala.personagens, souMestre, criar, indisponivel]);
}
