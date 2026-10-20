"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Identidade } from "@/lib/identidade";
import { mestreDaSala } from "@/lib/sala";
import { EscolherCampanha } from "@/components/EscolherCampanha";
import { limparPin, pinConfere, pinValido } from "@/lib/pinMestre";
import { lerPinDaSala } from "@/lib/pinMestreBanco";

export function Portao({
  sala,
  codigo,
  rotulo,
  onEntrar,
}: {
  sala: Sala;
  codigo: string;
  rotulo: string;
  onEntrar: (id: Identidade) => void;
}) {
  const mestre = mestreDaSala(codigo);
  const [nome, setNome] = useState("");
  const [criando, setCriando] = useState(false);
  // PIN do Mestre: `guardado` só existe depois de perguntar ao banco; com ele
  // preenchido, o botão vira o campo de PIN.
  const [conferindo, setConferindo] = useState(false);
  const [pinGuardado, setPinGuardado] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [avisoPin, setAvisoPin] = useState("");

  async function tocarMestre() {
    if (conferindo) return;
    setConferindo(true);
    setAvisoPin("");
    const leitura = await lerPinDaSala(codigo);
    setConferindo(false);
    if (!leitura.ok) {
      setAvisoPin(
        leitura.semRede
          ? "Sem conexão: não consigo conferir o PIN. Tente de novo quando a internet voltar."
          : "Não consegui conferir o PIN agora. Tente de novo.",
      );
      return;
    }
    if (!leitura.guardado) return onEntrar({ tipo: "mestre" });
    setPinGuardado(leitura.guardado);
  }

  async function entrarComPin() {
    if (!pinGuardado || conferindo) return;
    if (!pinValido(pin)) {
      setAvisoPin("O PIN tem de 4 a 6 números.");
      return;
    }
    setConferindo(true);
    const confere = await pinConfere(codigo, pin, pinGuardado);
    setConferindo(false);
    if (confere) return onEntrar({ tipo: "mestre" });
    setPin("");
    setAvisoPin("PIN errado.");
  }

  const jogadores = sala.personagens.filter((p) => !p.is_npc);

  async function entrarComNovo() {
    const limpo = nome.trim();
    if (!limpo || criando) return;

    const existente = jogadores.find(
      (p) => p.name.toLowerCase() === limpo.toLowerCase(),
    );
    if (existente) {
      onEntrar({ tipo: "jogador", slug: existente.slug });
      return;
    }

    setCriando(true);
    const criado = await sala.criarPersonagem({ name: limpo });
    setCriando(false);
    if (criado) onEntrar({ tipo: "jogador", slug: criado.slug });
  }

  return (
    <div className="gate">
      <div className="eyebrow">{rotulo} · mesa</div>
      <h1>Painel de Mesa</h1>

      {/* Quem abre o link puro cai na última campanha do aparelho (ou na
          Salamina): daqui dá pra ir pra outra antes de escolher quem é. */}
      <div className="gatecampanha">
        <div className="gatecampanharotulo">Campanha</div>
        <EscolherCampanha atual={codigo} />
      </div>

      <p className="lead">
        Escolha quem você é nesta sessão. Fica salvo só neste navegador — cada
        pessoa escolhe o seu, uma vez.
      </p>

      <div className="rosterlist">
        {pinGuardado ? (
          <div className="rolebtn dm pinmestre">
            <span className="rname">PIN do Mestre{mestre ? ` · ${mestre}` : ""}</span>
            <div className="pinlinha">
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                maxLength={6}
                value={pin}
                placeholder="4 a 6 números"
                aria-label="PIN do Mestre"
                onChange={(e) => {
                  setPin(limparPin(e.target.value));
                  setAvisoPin("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") entrarComPin();
                }}
              />
              <button type="button" onClick={entrarComPin} disabled={conferindo}>
                {conferindo ? "…" : "Entrar"}
              </button>
              <button
                type="button"
                className="pinvoltar"
                onClick={() => {
                  setPinGuardado(null);
                  setPin("");
                  setAvisoPin("");
                }}
              >
                voltar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="rolebtn dm" onClick={tocarMestre} disabled={conferindo}>
            <span>
              <span className="rname">Sou o Mestre</span>
              <br />
              <span className="rclass">
                {mestre ? `${mestre} · ` : ""}Painel completo, todas as fichas e o combate
              </span>
            </span>
            <span className="go">{conferindo ? "…" : "→"}</span>
          </button>
        )}
        <div className="pinaviso" role="status" aria-live="polite">
          {avisoPin}
        </div>

        {jogadores.map((p) => (
          <button
            key={p.id}
            type="button"
            className="rolebtn"
            onClick={() => onEntrar({ tipo: "jogador", slug: p.slug })}
          >
            <span>
              <span className="rname">{p.name}</span>
              <br />
              <span className="rclass">{p.cls || "Personagem"}</span>
            </span>
            <span className="go">→</span>
          </button>
        ))}
      </div>

      <div className="addrow">
        <input
          type="text"
          value={nome}
          maxLength={40}
          placeholder="Novo personagem: nome"
          aria-label="Nome do seu personagem, se ele ainda não está na lista"
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") entrarComNovo();
          }}
        />
        <button type="button" onClick={entrarComNovo} disabled={criando}>
          {criando ? "…" : "Entrar"}
        </button>
      </div>

      <p className="fine">
        Sincroniza sozinho entre celular, tablet e notebook. O Mestre enxerga
        tudo; cada jogador só a própria ficha.
      </p>
    </div>
  );
}
