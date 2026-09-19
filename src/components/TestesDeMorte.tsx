"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Personagem } from "@/lib/tipos";
import { rolarDado } from "@/lib/dados";
import { mudancaDe, textoDesfeito } from "@/lib/desfazer";
import {
  ajustarPV,
  alternarPips,
  estaCaido,
  limitarTesteMorte,
  resolverTesteMorte,
  situacaoMorte,
  TESTES_MORTE_MAX,
} from "@/lib/regras";

/**
 * Testes de resistência contra a morte: as marcas de sucesso e falha (que dá
 * pra ligar na mão, como sempre) e o botão que rola pra valer — 10 ou mais
 * passa, 20 natural acorda com 1 PV, 1 natural conta duas falhas (ver
 * `resolverTesteMorte`). A mesma peça serve a ficha e o painel da linha da
 * iniciativa, que é onde a vez de quem está caído acontece.
 *
 * Só pra jogador: monstro não rola morte nas regras de 2024.
 */
export function TestesDeMorte({
  sala,
  personagem: p,
  editavel,
  titulo,
}: {
  sala: Sala;
  personagem: Personagem;
  editavel: boolean;
  titulo: string;
}) {
  const [rolando, setRolando] = useState(false);
  // O resultado guarda a contagem que ele produziu: desfeito (ou mudado de
  // outro aparelho), some em vez de contar uma história que não vale mais.
  const [ultimo, setUltimo] = useState<{ texto: string; dss: number; dsf: number } | null>(null);
  const morte = situacaoMorte(p.dss, p.dsf);
  const mostrarUltimo = ultimo && ultimo.dss === p.dss && ultimo.dsf === p.dsf;

  async function rolar() {
    if (rolando) return;
    setRolando(true);
    const r = resolverTesteMorte(p.name, p.dss, p.dsf, rolarDado(20));
    // Acordar com 1 PV passa pelo ajustarPV: é ele que zera os testes e
    // arruma o resto de quem sai do 0 PV.
    const patch: Partial<Personagem> = r.acordou ? { ...ajustarPV(p, 1), dss: 0, dsf: 0 } : { dss: r.dss, dsf: r.dsf };
    const deuCerto = await sala.atualizarVariosPersonagens([{ id: p.id, patch }]);
    setRolando(false);
    if (!deuCerto) return;
    // Teste de morte é da mesa inteira: vai pro log com nome (jogador nunca
    // é escondido nele).
    sala.registrarVariosLogs([r.texto]);
    sala.lembrarDesfazer({
      rotulo: r.texto,
      textoLog: textoDesfeito([r.texto], ""),
      personagens: [mudancaDe(p, patch)],
      combate: null,
      criados: [],
    });
    setUltimo({ texto: r.texto, dss: r.acordou ? 0 : r.dss, dsf: r.acordou ? 0 : r.dsf });
  }

  return (
    <div className="testesmorte">
      <div className="subrow">
        <span className="sectitle">{titulo}</span>
        {/* Teste de morte só existe a 0 PV — de pé, ficam só as marcas. */}
        {editavel && morte === "em-jogo" && estaCaido(p.hp) && (
          <button type="button" className="btn" onClick={rolar} disabled={rolando}>
            {rolando ? "rolando…" : "🎲 Rolar teste de morte"}
          </button>
        )}
      </div>
      <div className="deathsaves">
        <div className="dsblock">
          <span className="lbl">Sucessos</span>
          <div className="pips">
            {Array.from({ length: TESTES_MORTE_MAX }, (_, i) => (
              <button
                key={i}
                type="button"
                className="pip death"
                aria-label={`Sucesso ${i + 1}`}
                aria-pressed={i < p.dss}
                disabled={!editavel}
                onClick={() => sala.atualizarPersonagem(p.id, { dss: limitarTesteMorte(alternarPips(i, p.dss)) })}
              />
            ))}
          </div>
        </div>
        <div className="dsblock">
          <span className="lbl">Falhas</span>
          <div className="pips">
            {Array.from({ length: TESTES_MORTE_MAX }, (_, i) => (
              <button
                key={i}
                type="button"
                className="pip fail"
                aria-label={`Falha ${i + 1}`}
                aria-pressed={i < p.dsf}
                disabled={!editavel}
                onClick={() => sala.atualizarPersonagem(p.id, { dsf: limitarTesteMorte(alternarPips(i, p.dsf)) })}
              />
            ))}
          </div>
        </div>
      </div>
      {morte !== "em-jogo" && (
        <div className={`dsnote ${morte}`}>{morte === "estavel" ? "Estável (3 sucessos)" : "Morto (3 falhas)"}</div>
      )}
      {mostrarUltimo && morte === "em-jogo" && (
        <p className="dsultimo" role="status">
          {ultimo.texto}
        </p>
      )}
    </div>
  );
}
