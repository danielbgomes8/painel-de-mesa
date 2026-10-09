"use client";

import { useMemo, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Encontro } from "@/lib/tipos";
import { rolarDado } from "@/lib/dados";
import { registrarUso } from "@/lib/registrarUso";
import {
  NUM_DE_LUTAS,
  RODADAS_MAXIMAS,
  ROTULO_DA_DIFICULDADE,
  combatentesDoGrupo,
  dificuldade,
  inimigosDoEncontro,
  porCento,
  simular,
  type Resultado,
} from "@/lib/simulador";

/**
 * "Quanto esse encontro machuca?": luta o encontro preparado contra o grupo de
 * verdade 1000 vezes e mostra a chance de alguém cair, de perder todos e quanto
 * dura (regras e limites em `lib/simulador.ts`). É um termômetro pra preparar a
 * sessão, não uma previsão — a tela diz isso. Só o Mestre vê; não grava nada.
 */
export function SimuladorDeEncontro({ encontro, sala }: { encontro: Encontro; sala: Sala }) {
  const [aberto, setAberto] = useState(false);
  const [pvCheio, setPvCheio] = useState(false);
  const [fora, setFora] = useState<Record<string, boolean>>({});
  const [resultado, setResultado] = useState<{ r: Resultado; nomes: string[]; semAtaqueGrupo: string[]; semAtaqueInimigos: string[] } | null>(null);

  const inimigos = useMemo(() => inimigosDoEncontro(encontro.grupos), [encontro.grupos]);
  const { grupo, semAtaque, deFora } = useMemo(() => combatentesDoGrupo(sala.personagens, pvCheio), [sala.personagens, pvCheio]);
  const entram = grupo.filter((g) => !fora[g.id]);

  if (inimigos.length === 0) return null;
  if (!aberto) {
    return (
      <button type="button" className="minilink" onClick={() => setAberto(true)}>
        🎲 simular este encontro
      </button>
    );
  }

  function simularAgora() {
    registrarUso("acao:simulador");
    const r = simular(entram, inimigos, rolarDado, NUM_DE_LUTAS);
    setResultado({
      r,
      nomes: entram.map((g) => g.nome),
      semAtaqueGrupo: semAtaque.filter((n) => entram.some((g) => g.nome === n)),
      semAtaqueInimigos: [...new Set(inimigos.filter((i) => i.turno.length === 0).map((i) => i.nome.replace(/ \d+$/, "")))],
    });
  }

  const d = resultado ? dificuldade(resultado.r) : null;
  return (
    <div className="simulador">
      <p className="bkpexplica">
        🎲 Luta este encontro {NUM_DE_LUTAS} vezes contra o grupo e mostra o que costuma acontecer. É um termômetro, não uma previsão.
      </p>
      <div className="chips">
        {grupo.map((g) => (
          <button
            key={g.id}
            type="button"
            className="chip alvo"
            aria-pressed={!fora[g.id]}
            onClick={() => {
              setFora((f) => ({ ...f, [g.id]: !f[g.id] }));
              setResultado(null);
            }}
          >
            {g.nome} · {g.hp} PV
          </button>
        ))}
        {grupo.length === 0 && <span className="empty-note">Nenhum jogador pronto pra lutar na sala.</span>}
      </div>
      {deFora.length > 0 && <p className="empty-note">A 0 PV agora, fora da conta: {deFora.join(", ")}.</p>}
      <div className="masstools">
        <label className="inv-mag">
          <input
            type="checkbox"
            checked={pvCheio}
            onChange={(e) => {
              setPvCheio(e.target.checked);
              setResultado(null);
            }}
          />
          grupo descansado (PV cheio)
        </label>
        <button type="button" className="btn" disabled={entram.length === 0} onClick={simularAgora}>
          Simular
        </button>
        <button type="button" className="btn ghost" onClick={() => setAberto(false)}>
          fechar
        </button>
      </div>

      {resultado && d && (
        <div className="simresultado" aria-live="polite">
          <p className={`simveredito simveredito--${d}`}>
            <b>{ROTULO_DA_DIFICULDADE[d]}</b> — o grupo vence em {porCento(resultado.r.grupoVence)} das lutas, em cerca de{" "}
            {Math.max(1, Math.round(resultado.r.rodadasMediana))} {Math.round(resultado.r.rodadasMediana) <= 1 ? "rodada" : "rodadas"}.
          </p>
          <ul className="simnumeros">
            <li>
              <span>Alguém cai a 0 PV</span>
              <b>{porCento(resultado.r.alguemCai)}</b>
            </li>
            <li>
              <span>O grupo inteiro cai</span>
              <b>{porCento(resultado.r.grupoPerdeTodos)}</b>
            </li>
            {resultado.r.empate > 0 && (
              <li>
                <span>Ninguém vence em {RODADAS_MAXIMAS} rodadas</span>
                <b>{porCento(resultado.r.empate)}</b>
              </li>
            )}
            <li>
              <span>PV do grupo gastos (média)</span>
              <b>{porCento(Math.min(1, resultado.r.pvGasto))}</b>
            </li>
          </ul>
          <p className="bkptitulo">Chance de cada um cair</p>
          <ul className="simbarras">
            {resultado.r.caiPorPessoa.map((p) => (
              <li key={p.id}>
                <span className="simnome">{p.nome}</span>
                <span className="simbarra" aria-hidden="true">
                  <span style={{ width: `${Math.round(p.chance * 100)}%` }} />
                </span>
                <b>{porCento(p.chance)}</b>
              </li>
            ))}
          </ul>
          {(resultado.semAtaqueGrupo.length > 0 || resultado.semAtaqueInimigos.length > 0) && (
            <p className="inv-alerta">
              Sem ataque legível (causa 0 de dano na conta):{" "}
              {[...resultado.semAtaqueGrupo, ...resultado.semAtaqueInimigos].join(", ")}. Escreva o ataque na ficha, como &quot;Espada +5, 1d8+3&quot;.
            </p>
          )}
          <p className="empty-note">
            Não entram: magias, Ataque Extra, ações bônus, reações, terreno, resistências, condições nem cura. Sopro, magia e ações lendárias dos monstros só
            contam se estiverem escritos no campo de ataque deles (ex.: &quot;Sopro: CD 15, 12d6 veneno&quot;); sem isso a conta subestima o perigo. Cada um do grupo
            ataca o inimigo de menos PV, e os monstros, um do grupo ao acaso.
          </p>
        </div>
      )}
    </div>
  );
}
