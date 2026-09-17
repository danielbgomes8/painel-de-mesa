"use client";

import { useState } from "react";
import { separarAtaques } from "@/lib/regras";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";

/** Ataques do personagem de jogador, no topo da ficha — é o que se lê no
 *  próprio turno, então aparece como lista legível e não como campo de texto
 *  que rola por dentro (a ficha do jogador está sempre em modo de edição pra
 *  ele e pro Mestre). Editar é raro — subiu de nível, pegou arma nova —, por
 *  isso fica atrás de "editar". Usa a mesma coluna `ataque` do NPC (migration
 *  0008), uma linha por ataque; antes ela só aparecia pra NPC e os ataques do
 *  jogador acabavam escondidos na ficha completa. */
export function AtaquesPersonagem({
  texto,
  editavel,
  onSalvar,
}: {
  texto: string;
  editavel: boolean;
  onSalvar: (texto: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const linhas = separarAtaques(texto);

  if (editando && editavel) {
    return (
      <div className="ataquebloco pc">
        <div className="subrow">
          <span className="sectitle">Ataques</span>
          {/* Tocar aqui tira o foco do campo antes do clique, e o
           *  CampoTextoAdiado grava no blur — não perde o que foi digitado. */}
          <button type="button" className="minilink" onClick={() => setEditando(false)}>
            pronto
          </button>
        </div>
        <div className="notesbox">
          <CampoTextoAdiado
            valor={texto}
            maxLength={600}
            placeholder={"uma linha por ataque, ex.:\nMalho +1: +7, 2d6+9 contundente"}
            onSalvar={onSalvar}
          />
        </div>
      </div>
    );
  }

  if (linhas.length === 0) {
    return editavel ? (
      <button type="button" className="minilink ataquenovo" onClick={() => setEditando(true)}>
        + ataques
      </button>
    ) : null;
  }

  return (
    <div className="ataquebloco pc">
      <div className="subrow">
        <span className="sectitle">Ataques</span>
        {editavel && (
          <button type="button" className="minilink" onClick={() => setEditando(true)}>
            editar
          </button>
        )}
      </div>
      <ul className="ataquelista">
        {linhas.map((linha, i) => (
          <li key={i}>
            {linha.nome && <b>{linha.nome}</b>}
            {linha.detalhe}
          </li>
        ))}
      </ul>
    </div>
  );
}
