"use client";

import { useMemo } from "react";
import type { Cena } from "@/lib/cenas";
import type { Sala } from "@/hooks/useSala";
import { useArmadilhas } from "@/hooks/useArmadilhas";
import { usePecas } from "@/hooks/usePecas";
import { useParedes } from "@/hooks/useParedes";
import { usePisadas } from "@/hooks/usePisadas";
import { montarPecasNaTela } from "@/lib/pecas";
import { AvisosDeAchado, AvisosDePisada } from "@/components/ArmadilhasDoMapa";

/**
 * O vigia do Mestre: fica ligado em qualquer aba (Combate, Fichas, Campanha...) e avisa quando alguém pisa
 * numa armadilha do mapa que está na mesa. Só o Mestre o monta (ver `Painel`). Tem leituras próprias das
 * armadilhas e dos peões (canal `guarda`, pra não brigar com as do editor do mapa, que pode estar aberto ao
 * mesmo tempo); o que ele escreve chega no editor pelo tempo real, como se viesse de outro aparelho.
 */
export function GuardaDeArmadilhas({ cena, codigo, sala }: { cena: Cena; codigo: string; sala: Sala }) {
  const arm = useArmadilhas(cena.id, codigo, "guarda");
  const banco = usePecas(cena.id, codigo, "guarda");
  const muros = useParedes(cena.id, codigo, "guarda");
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
  // e a Percepção passiva da ficha de cada jogador (só jogador repara; inimigo e marcador não têm `pp`).
  const pecasComSlug = useMemo(
    () =>
      pecas.map((p) => {
        const slug = banco.pecas.find((b) => b.id === p.id)?.slug ?? null;
        const ficha = slug ? sala.personagens.find((f) => f.slug === slug) : undefined;
        return { ...p, slug, pp: ficha && !ficha.is_npc && typeof ficha.pp === "number" ? ficha.pp : null };
      }),
    [pecas, banco.pecas, sala.personagens],
  );
  const pisadas = usePisadas(cena, arm.armadilhas, pecasComSlug, sala.combate.order[sala.combate.turn]?.slug ?? null, muros.paredes);
  const registrar = (texto: string) => void sala.registrarLog(texto);
  return (
    <>
      <AvisosDePisada pendentes={pisadas.pendentes} armadilhas={arm.armadilhas} arm={arm} aoResolver={pisadas.resolver} registrar={registrar} />
      <AvisosDeAchado
        achados={pisadas.achados}
        armadilhas={arm.armadilhas}
        paredes={muros.paredes}
        arm={arm}
        muros={muros}
        aoResolver={pisadas.resolverAchado}
        registrar={registrar}
      />
    </>
  );
}
