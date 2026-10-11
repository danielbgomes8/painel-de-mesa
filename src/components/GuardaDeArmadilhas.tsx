"use client";

import { useMemo } from "react";
import type { Cena } from "@/lib/cenas";
import type { Sala } from "@/hooks/useSala";
import { useArmadilhas } from "@/hooks/useArmadilhas";
import { usePecas } from "@/hooks/usePecas";
import { usePisadas } from "@/hooks/usePisadas";
import { montarPecasNaTela } from "@/lib/pecas";
import { AvisosDePisada } from "@/components/ArmadilhasDoMapa";

/**
 * O vigia do Mestre: fica ligado em qualquer aba (Combate, Fichas, Campanha...) e avisa quando alguém pisa
 * numa armadilha do mapa que está na mesa. Só o Mestre o monta (ver `Painel`). Tem leituras próprias das
 * armadilhas e dos peões (canal `guarda`, pra não brigar com as do editor do mapa, que pode estar aberto ao
 * mesmo tempo); o que ele escreve chega no editor pelo tempo real, como se viesse de outro aparelho.
 */
export function GuardaDeArmadilhas({ cena, codigo, sala }: { cena: Cena; codigo: string; sala: Sala }) {
  const arm = useArmadilhas(cena.id, codigo, "guarda");
  const banco = usePecas(cena.id, codigo, "guarda");
  const pecas = useMemo(
    () =>
      montarPecasNaTela({
        pecas: banco.pecas,
        cena,
        fichas: sala.personagens,
        vezDe: sala.combate.order[sala.combate.turn]?.slug ?? null,
        slugsDosJogadores: sala.personagens.filter((p) => !p.is_npc).map((p) => p.slug),
        visao: { mestre: true, meuSlug: null },
        selecionadaId: null,
      }),
    [banco.pecas, cena, sala.personagens, sala.combate],
  );
  // O `slug` de cada peão (quem é na iniciativa) pra os perigos saberem de quem é o início do turno.
  const pecasComSlug = useMemo(() => pecas.map((p) => ({ ...p, slug: banco.pecas.find((b) => b.id === p.id)?.slug ?? null })), [pecas, banco.pecas]);
  const pisadas = usePisadas(cena, arm.armadilhas, pecasComSlug, sala.combate.order[sala.combate.turn]?.slug ?? null);
  return (
    <AvisosDePisada
      pendentes={pisadas.pendentes}
      armadilhas={arm.armadilhas}
      arm={arm}
      aoResolver={pisadas.resolver}
      registrar={(texto) => void sala.registrarLog(texto)}
    />
  );
}
