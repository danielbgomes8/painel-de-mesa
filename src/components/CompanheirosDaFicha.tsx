"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Personagem } from "@/lib/tipos";
import { companheirosDe, linhaDeCompanheiro } from "@/lib/companheiros";
import { entrarNaOrdem } from "@/lib/regras";
import { BotaoRemover } from "@/components/BotaoRemover";
import { porPecasDosCompanheiros } from "@/lib/pecasNoBanco";

/** Companheiros e invocações do personagem (familiar, montaria, animal companheiro, criatura invocada), na
 *  ficha de quem joga: o dono e o Mestre criam e controlam. Cada um é uma ficha de NPC já revelada, ligada ao
 *  dono; na iniciativa ele entra logo depois do dono, com a mesma contagem, e sai junto (ver
 *  `lib/companheiros.ts`). */
export function CompanheirosDaFicha({ sala, personagem: dono }: { sala: Sala; personagem: Personagem }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [pv, setPv] = useState("");
  const [ca, setCa] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const companheiros = companheirosDe(sala.personagens, dono.slug);
  const naOrdem = new Set(sala.combate.order.map((o) => o.slug));
  const donoNaOrdem = sala.combate.order.find((o) => o.slug === dono.slug) ?? null;

  /** Põe o companheiro na ordem logo depois do dono, com a mesma contagem. */
  async function pelaOrdem(c: Personagem) {
    if (!donoNaOrdem) return;
    await sala.definirCombate((atual) => {
      const meu = atual.order.find((o) => o.slug === dono.slug);
      if (!meu || atual.order.some((o) => o.slug === c.slug)) return {};
      const r = entrarNaOrdem(atual.order, [{ slug: c.slug, name: c.name, init: meu.init }]);
      return { order: r.ordem };
    });
    void sala.registrarLog(linhaDeCompanheiro(c.name, dono.name));
    // Com um mapa na mesa, o peão dele nasce encostado no do dono (sem mapa na mesa, nada acontece).
    if (!sala.semInternet) await porPecasDosCompanheiros(dono.room_code, [{ slug: c.slug, cls: c.cls, dono: dono.slug }]);
  }

  async function criar() {
    const n = nome.trim();
    if (!n || ocupado) return;
    const hp = Number.parseInt(pv, 10);
    const ac = Number.parseInt(ca, 10);
    setOcupado(true);
    setAviso(null);
    const criado = await sala.criarPersonagem({
      name: n,
      cls: "Companheiro",
      is_npc: true,
      revealed: true,
      dono: dono.slug,
      hp: Number.isNaN(hp) ? 10 : hp,
      hp_max: Number.isNaN(hp) ? 10 : hp,
      ac: Number.isNaN(ac) ? 12 : ac,
    });
    if (!criado) {
      setAviso("Não consegui criar o companheiro. Se for a primeira vez, falta rodar a migration 0031.");
    } else {
      setNome("");
      setPv("");
      setCa("");
      // Com o dono já na ordem, o companheiro entra junto logo de cara.
      await pelaOrdem(criado);
    }
    setOcupado(false);
  }

  return (
    <div className="comp">
      <div className="subrow">
        <span className="sectitle">Companheiros</span>
        <button type="button" className="minilink" onClick={() => setAberto(!aberto)}>
          {aberto ? "fechar" : companheiros.length > 0 ? "gerenciar" : "+ companheiro"}
        </button>
      </div>

      {companheiros.length > 0 && (
        <ul className="comp-lista">
          {companheiros.map((c) => (
            <li key={c.id} className="comp-item">
              <span className="comp-nome">
                🐾 <b>{c.name}</b> · {c.hp}/{c.hp_max} PV · CA {c.ac}
              </span>
              {aberto && (
                <span className="comp-acoes">
                  {donoNaOrdem && !naOrdem.has(c.slug) && (
                    <button type="button" className="chip alvo" onClick={() => pelaOrdem(c)}>
                      pôr na ordem
                    </button>
                  )}
                  <BotaoRemover
                    aria={`apagar ${c.name}`}
                    confirmar={`Apagar o companheiro "${c.name}"? A ficha dele some.`}
                    onConfirmar={() => void sala.removerPersonagem(c.id)}
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {aberto && (
        <div className="comp-novo">
          <input type="text" placeholder="nome (ex.: Pip, o corvo)" aria-label="nome do companheiro" maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} />
          <div className="comp-linha">
            <input type="number" inputMode="numeric" placeholder="PV" aria-label="PV do companheiro" value={pv} onChange={(e) => setPv(e.target.value)} />
            <input type="number" inputMode="numeric" placeholder="CA" aria-label="CA do companheiro" value={ca} onChange={(e) => setCa(e.target.value)} />
            <button type="button" className="btn" disabled={!nome.trim() || ocupado} onClick={criar}>
              + criar
            </button>
          </div>
          <p className="empty-note">Entra na iniciativa logo depois de {dono.name}, com a mesma contagem, e sai junto.</p>
          {aviso && <p className="inv-alerta">{aviso}</p>}
        </div>
      )}
    </div>
  );
}
