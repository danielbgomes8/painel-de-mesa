"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Identidade } from "@/lib/identidade";

export function Portao({
  sala,
  rotulo,
  onEntrar,
}: {
  sala: Sala;
  rotulo: string;
  onEntrar: (id: Identidade) => void;
}) {
  const [nome, setNome] = useState("");
  const [criando, setCriando] = useState(false);

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
      <p className="lead">
        Escolha quem você é nesta sessão. Fica salvo só neste navegador — cada
        pessoa escolhe o seu, uma vez.
      </p>

      <div className="rosterlist">
        <button
          type="button"
          className="rolebtn dm"
          onClick={() => onEntrar({ tipo: "mestre" })}
        >
          <span>
            <span className="rname">Sou o Mestre</span>
            <br />
            <span className="rclass">Painel completo, todas as fichas e o combate</span>
          </span>
          <span className="go">→</span>
        </button>

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
          placeholder="Nome do seu personagem (se ainda não está na lista)"
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
