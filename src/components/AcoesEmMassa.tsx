"use client";

import { useMemo, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Personagem } from "@/lib/tipos";
import { CONDICOES } from "@/lib/condicoes";
import { condicaoComLog, curaComLog, danoComLog } from "@/lib/regras";

/** Área de efeito: seleciona vários personagens/NPCs e aplica dano, cura ou
 *  uma condição em todos de uma vez. Só o Mestre vê. */
export function AcoesEmMassa({ sala }: { sala: Sala }) {
  const [alvos, setAlvos] = useState<Record<string, boolean>>({});
  const [valor, setValor] = useState("");
  const [cond, setCond] = useState<string>(CONDICOES[0]);

  const selecionados = useMemo(
    () => sala.personagens.filter((p) => alvos[p.id]),
    [sala.personagens, alvos],
  );

  function alternar(id: string) {
    setAlvos((a) => ({ ...a, [id]: !a[id] }));
  }

  async function aplicarPV(sinal: 1 | -1) {
    const n = Number.parseInt(valor, 10);
    if (Number.isNaN(n) || n <= 0) return;
    // Uma escrita só pros personagens todos, uma escrita só pro log —
    // antes disparava até duas requisições por alvo selecionado.
    const alvos: { id: string; patch: Partial<Personagem> }[] = [];
    const textos: string[] = [];
    for (const p of selecionados) {
      // As duas escondem nome de NPC oculto e PV de NPC no log (é público);
      // danoComLog ainda avisa o teste de concentração (ou a perda dela a 0 PV).
      const { patch, texto }: { patch: Partial<Personagem>; texto: string | null } =
        sinal > 0 ? curaComLog(p, n) : danoComLog(p, n);
      alvos.push({ id: p.id, patch });
      if (texto) textos.push(texto);
    }
    // Só loga depois que a escrita das fichas confirmar — senão o log jura
    // uma cura que não aconteceu se a escrita falhar (achado ao testar).
    const deuCerto = await sala.atualizarVariosPersonagens(alvos);
    if (deuCerto) sala.registrarVariosLogs(textos);
    setValor("");
  }

  async function aplicarCondicao(ligar: boolean) {
    const alvos: { id: string; patch: Partial<Personagem> }[] = [];
    const textos: string[] = [];
    for (const p of selecionados) {
      const jaEstava = Boolean(p.cond?.[cond]);
      if (jaEstava === ligar) continue;
      // Mesma regra do toggle individual na ficha (limpa o prazo ao tirar,
      // quebra a concentração ao ligar Atordoado/Inconsciente/...).
      const { patch, texto } = condicaoComLog(p, cond, ligar);
      alvos.push({ id: p.id, patch });
      textos.push(texto);
    }
    const deuCerto = await sala.atualizarVariosPersonagens(alvos);
    if (deuCerto) sala.registrarVariosLogs(textos);
  }

  const n = selecionados.length;

  return (
    <div className="combat">
      <div className="combat-head">
        <h2>Ações em massa</h2>
      </div>

      <div className="chips" style={{ marginBottom: 12 }}>
        {sala.personagens.length === 0 && (
          <span className="empty-note">Nenhum personagem na sala ainda.</span>
        )}
        {sala.personagens.map((p) => (
          <button
            key={p.id}
            type="button"
            className="chip alvo"
            aria-pressed={Boolean(alvos[p.id])}
            onClick={() => alternar(p.id)}
          >
            {p.name}
            {p.is_npc ? " · NPC" : ""}
          </button>
        ))}
      </div>

      <div className="masstools">
        <input
          className="num"
          type="number"
          inputMode="numeric"
          placeholder="valor"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        <button type="button" className="btn" disabled={n === 0} onClick={() => aplicarPV(-1)}>
          Aplicar dano
        </button>
        <button type="button" className="btn" disabled={n === 0} onClick={() => aplicarPV(1)}>
          Aplicar cura
        </button>
        <select value={cond} onChange={(e) => setCond(e.target.value)}>
          {CONDICOES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="button" className="btn" disabled={n === 0} onClick={() => aplicarCondicao(true)}>
          Adicionar condição
        </button>
        <button type="button" className="btn" disabled={n === 0} onClick={() => aplicarCondicao(false)}>
          Remover condição
        </button>
      </div>

      <p className="empty-note">
        {n === 0
          ? "Selecione um ou mais alvos acima."
          : `${n} alvo${n > 1 ? "s" : ""} selecionado${n > 1 ? "s" : ""}.`}
      </p>
    </div>
  );
}
