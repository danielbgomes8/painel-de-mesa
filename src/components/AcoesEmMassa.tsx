"use client";

import { useMemo, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Personagem } from "@/lib/tipos";
import { CONDICOES } from "@/lib/condicoes";
import { aplicarDescansoLongo, condicaoComLog, curaComLog, danoComLog } from "@/lib/regras";
import type { Tempo } from "@/hooks/useTempo";
import { XP_MAXIMO, dividirXp, formatarXp, linhaDeXp, normalizarXp } from "@/lib/experiencia";
import { efeitosQueVenceram, linhasDoAvanco, plural } from "@/lib/tempoCampanha";
import { contarAlvos, mudancaDe, textoDesfeito, type MudancaPersonagem } from "@/lib/desfazer";

/** Área de efeito: seleciona vários personagens/NPCs e aplica dano, cura ou
 *  uma condição em todos de uma vez. Só o Mestre vê. */
export function AcoesEmMassa({ sala, tempo }: { sala: Sala; tempo: Tempo }) {
  const [alvos, setAlvos] = useState<Record<string, boolean>>({});
  const [valor, setValor] = useState("");
  const [cond, setCond] = useState<string>(CONDICOES[0]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [descansando, setDescansando] = useState(false);
  const [xpValor, setXpValor] = useState("");

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
    const mudancas: MudancaPersonagem[] = [];
    const textos: string[] = [];
    for (const p of selecionados) {
      // As duas escondem nome de NPC oculto e PV de NPC no log (é público);
      // danoComLog ainda avisa o teste de concentração (ou a perda dela a 0 PV).
      const { patch, texto }: { patch: Partial<Personagem>; texto: string | null } =
        sinal > 0 ? curaComLog(p, n) : danoComLog(p, n);
      mudancas.push(mudancaDe(p, patch));
      if (texto) textos.push(texto);
    }
    // Só loga depois que a escrita das fichas confirmar — senão o log jura
    // uma cura que não aconteceu se a escrita falhar (achado ao testar).
    const deuCerto = await sala.atualizarVariosPersonagens(mudancas.map((m) => ({ id: m.id, patch: m.depois })));
    setValor("");
    if (!deuCerto) return;
    sala.registrarVariosLogs(textos);
    const oQue = `${sinal > 0 ? "cura" : "dano"} de ${n} em ${contarAlvos(mudancas.length)}`;
    sala.lembrarDesfazer({
      rotulo: oQue.charAt(0).toUpperCase() + oQue.slice(1),
      textoLog: textoDesfeito(textos, oQue),
      personagens: mudancas,
      combate: null,
      criados: [],
    });
  }

  async function aplicarCondicao(ligar: boolean) {
    const mudancas: MudancaPersonagem[] = [];
    const textos: string[] = [];
    for (const p of selecionados) {
      const jaEstava = Boolean(p.cond?.[cond]);
      if (jaEstava === ligar) continue;
      // Mesma regra do toggle individual na ficha (limpa o prazo ao tirar,
      // quebra a concentração ao ligar Atordoado/Inconsciente/...).
      const { patch, texto } = condicaoComLog(p, cond, ligar);
      mudancas.push(mudancaDe(p, patch));
      textos.push(texto);
    }
    const deuCerto = await sala.atualizarVariosPersonagens(mudancas.map((m) => ({ id: m.id, patch: m.depois })));
    if (!deuCerto) return;
    sala.registrarVariosLogs(textos);
    const oQue = `${ligar ? cond : `fim de ${cond}`} em ${contarAlvos(mudancas.length)}`;
    sala.lembrarDesfazer({
      rotulo: oQue.charAt(0).toUpperCase() + oQue.slice(1),
      textoLog: textoDesfeito(textos, oQue),
      personagens: mudancas,
      combate: null,
      criados: [],
    });
  }

  /** Descanso longo de quem está selecionado — nem todo mundo descansa junto, então o Mestre escolhe. Com a
   *  campanha contando os dias, o descanso passa 1 dia (uma vez, qualquer que seja o número de selecionados). */
  async function descansoLongo() {
    if (descansando || selecionados.length === 0) return;
    const nomes = selecionados.map((p) => p.name).join(", ");
    const passaODia = tempo.tempo !== null;
    if (
      !confirm(
        `Descanso longo em ${plural(selecionados.length, "personagem", "personagens")} (${nomes})? Cura tudo, tira 1 de exaustão, recupera dados de vida e recursos.${passaODia ? ` Passa 1 dia da campanha (Dia ${tempo.tempo!.dia} → Dia ${tempo.tempo!.dia + 1}).` : ""}`,
      )
    )
      return;
    setDescansando(true);
    setAviso(null);
    const ok = await sala.atualizarVariosPersonagens(selecionados.map((p) => ({ id: p.id, patch: aplicarDescansoLongo(p) })));
    if (!ok) {
      setAviso("Não consegui aplicar o descanso nas fichas, então o dia não passou.");
    } else if (passaODia) {
      const r = await tempo.mudarDia(1);
      if (!r) {
        setAviso("As fichas descansaram, mas não consegui passar o dia. Use \"+ 1 dia\" em Campanha → Dia.");
      } else {
        sala.registrarVariosLogs(linhasDoAvanco(tempo.efeitos, r.antes, r.depois, nomes));
        const venceram = efeitosQueVenceram(tempo.efeitos, r.antes.dia, r.depois.dia);
        setAviso(venceram.length > 0 ? `Venceu: ${venceram.map((e) => e.nome).join(", ")}.` : null);
      }
    }
    setDescansando(false);
  }

  /** Dá XP aos jogadores selecionados: o mesmo valor pra cada um ("cada") ou um prêmio dividido entre eles
   *  ("dividir"; o que não divide certo sobra e o aviso diz quanto). Valor negativo só no "cada" (corrigir
   *  um erro). NPC não tem XP. Vai pro log e dá pra desfazer. */
  async function darXp(modo: "cada" | "dividir") {
    const total = Number.parseInt(xpValor, 10);
    setAviso(null);
    if (!Number.isFinite(total) || total === 0) return;
    const jogadores = selecionados.filter((p) => !p.is_npc);
    if (jogadores.length === 0) {
      setAviso("Selecione ao menos um personagem de jogador: NPC não tem XP.");
      return;
    }
    if (modo === "dividir" && total < 0) {
      setAviso("Pra tirar XP use \"XP pra cada\" com valor negativo.");
      return;
    }
    const { cada, sobra } = modo === "cada" ? { cada: total, sobra: 0 } : dividirXp(total, jogadores.length);
    if (cada === 0) {
      setAviso(`${formatarXp(total)} XP dividido entre ${jogadores.length} dá menos de 1 pra cada um.`);
      return;
    }
    const mudancas: MudancaPersonagem[] = [];
    const textos: string[] = [];
    for (const p of jogadores) {
      const antes = normalizarXp(p.xp);
      const depois = Math.max(0, Math.min(XP_MAXIMO, antes + cada));
      if (depois === antes) continue;
      mudancas.push(mudancaDe(p, { xp: depois }));
      textos.push(linhaDeXp(p.name, depois - antes, depois));
    }
    if (mudancas.length === 0) return;
    const deuCerto = await sala.atualizarVariosPersonagens(mudancas.map((m) => ({ id: m.id, patch: m.depois })));
    if (!deuCerto) return;
    sala.registrarVariosLogs(textos);
    const oQue = `${cada > 0 ? "+" : "−"}${formatarXp(Math.abs(cada))} XP em ${contarAlvos(mudancas.length)}`;
    sala.lembrarDesfazer({
      rotulo: oQue,
      textoLog: textoDesfeito(textos, oQue),
      personagens: mudancas,
      combate: null,
      criados: [],
    });
    setXpValor("");
    if (sobra > 0) setAviso(`Sobraram ${formatarXp(sobra)} XP que não dividem certo; ninguém levou.`);
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
        <button type="button" className="btn" disabled={n === 0 || descansando} onClick={descansoLongo}>
          🌙 Descanso longo{tempo.tempo ? " (passa 1 dia)" : ""}
        </button>
      </div>
      <div className="masstools">
        <input
          className="num"
          type="number"
          inputMode="numeric"
          placeholder="XP"
          aria-label="XP a dar"
          value={xpValor}
          onChange={(e) => setXpValor(e.target.value)}
        />
        <button type="button" className="btn" disabled={n === 0} onClick={() => darXp("cada")}>
          🏅 XP pra cada
        </button>
        <button type="button" className="btn" disabled={n === 0} onClick={() => darXp("dividir")}>
          🏅 Dividir XP
        </button>
      </div>
      {aviso && (
        <p className="inv-alerta" role="status" aria-live="polite">
          {aviso}
        </p>
      )}

      <p className="empty-note">
        {n === 0
          ? "Selecione um ou mais alvos acima."
          : `${n} alvo${n > 1 ? "s" : ""} selecionado${n > 1 ? "s" : ""}.`}
      </p>
    </div>
  );
}
