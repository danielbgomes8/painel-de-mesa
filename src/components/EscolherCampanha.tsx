"use client";

import { useState } from "react";
import { useSalasDoAparelho } from "@/hooks/useIdentidade";
import { campanhasParaEscolher, codigoDigitado, irParaSala } from "@/lib/sala";

/**
 * Lista de campanhas pra trocar sem mexer em link: as do grupo (`CAMPANHAS`
 * em `sala.ts`), as que este aparelho já abriu por código, e um campo pra
 * digitar o código de outra. Aparece na tela de entrada e no botão
 * "trocar campanha" do topo.
 */
export function EscolherCampanha({ atual }: { atual: string }) {
  const salasDoAparelho = useSalasDoAparelho();
  const campanhas = campanhasParaEscolher(salasDoAparelho, atual);
  const [digitando, setDigitando] = useState(false);
  const [texto, setTexto] = useState("");
  const codigo = codigoDigitado(texto);

  function ir(destino: string) {
    if (destino !== atual) irParaSala(destino);
  }
  function abrirDigitado() {
    if (codigo) ir(codigo);
  }

  return (
    <div className="campanhas">
      <div className="campanhalista">
        {campanhas.map((c) => {
          const aqui = c.codigo === atual;
          const info = [c.mestre && `mestre: ${c.mestre}`, aqui && "aberta agora"].filter(Boolean);
          return (
            <button
              key={c.codigo}
              type="button"
              className="campanhabtn"
              aria-pressed={aqui}
              onClick={() => ir(c.codigo)}
            >
              <span className="cnome">{c.nome}</span>
              {info.length > 0 && <span className="cinfo">{info.join(" · ")}</span>}
            </button>
          );
        })}
      </div>

      {digitando ? (
        <form
          className="addrow campanhacodigo"
          onSubmit={(e) => {
            e.preventDefault();
            abrirDigitado();
          }}
        >
          <input
            type="text"
            value={texto}
            maxLength={40}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Código que o Mestre passou"
            aria-label="Código da campanha"
            onChange={(e) => setTexto(e.target.value)}
            // Enter tratado aqui, como no nome do personagem do Portão: não
            // depende do envio implícito do form (que exige o `keypress`).
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                abrirDigitado();
              }
            }}
          />
          <button type="submit" disabled={!codigo}>
            Abrir
          </button>
        </form>
      ) : (
        <button type="button" className="linkbtn campanhaoutra" onClick={() => setDigitando(true)}>
          + outra campanha (com código)
        </button>
      )}
    </div>
  );
}
