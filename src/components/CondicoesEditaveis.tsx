"use client";

import type { Sala } from "@/hooks/useSala";
import type { Personagem } from "@/lib/tipos";
import { CONDICOES, condicoesAtivas } from "@/lib/condicoes";
import { mudancaDe, textoDesfeito } from "@/lib/desfazer";
import { comPrazoCondicao, condicaoComLog, mensagemCondicao } from "@/lib/regras";
import { CampoNumero } from "@/components/CampoNumero";

/**
 * Liga ou desliga uma condição: grava, e só depois que a escrita confirmar
 * loga (o log é público — NPC oculto sai como "Um inimigo") e guarda pro
 * desfazer. Ligar Atordoado/Inconsciente/... ainda quebra a concentração
 * (ver `condicaoComLog`). Serve a ficha e o painel da linha da iniciativa.
 */
export async function alternarCondicaoComLog(sala: Sala, p: Personagem, nome: string, ligar: boolean) {
  const { patch, texto } = condicaoComLog(p, nome, ligar);
  const deuCerto = await sala.atualizarVariosPersonagens([{ id: p.id, patch }]);
  if (!deuCerto) return;
  sala.registrarVariosLogs([texto]);
  sala.lembrarDesfazer({
    rotulo: mensagemCondicao(p.name, nome, ligar),
    textoLog: textoDesfeito([texto], ""),
    personagens: [mudancaDe(p, patch)],
    combate: null,
    criados: [],
  });
}

/** Os 14 chips de condição: tocar liga/desliga. */
export function ChipsCondicao({
  sala,
  personagem: p,
  editavel,
}: {
  sala: Sala;
  personagem: Personagem;
  editavel: boolean;
}) {
  return (
    <div className="chips">
      {CONDICOES.map((nome) => {
        const ativa = Boolean(p.cond?.[nome]);
        return (
          <button
            key={nome}
            type="button"
            className="chip"
            aria-pressed={ativa}
            disabled={!editavel}
            onClick={() => alternarCondicaoComLog(sala, p, nome, !ativa)}
          >
            {nome}
          </button>
        );
      })}
    </div>
  );
}

/** "Atordoado dura [2] rodada(s)" pra cada condição ligada — com prazo, ela
 *  sai sozinha na virada da rodada (ver `reduzirPrazosCondicao`). */
export function PrazosCondicao({ sala, personagem: p }: { sala: Sala; personagem: Personagem }) {
  const ativas = condicoesAtivas(p.cond);
  if (ativas.length === 0) return null;
  return (
    <div className="condprazos">
      {ativas.map((nome) => (
        <label key={nome} className="condprazo">
          {nome} dura
          <CampoNumero
            className="campnum"
            valor={p.cond_prazo[nome] ?? 0}
            onCommit={(n) => sala.atualizarPersonagem(p.id, { cond_prazo: comPrazoCondicao(p.cond_prazo, nome, n) })}
          />
          rodada(s) — 0 = tira à mão
        </label>
      ))}
    </div>
  );
}
