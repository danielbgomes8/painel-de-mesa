"use client";

import { useEffect, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import { EncontrosPreparados } from "@/components/EncontrosPreparados";
import { BibliotecaNpcs } from "@/components/BibliotecaNpcs";
import { NotasDoMestre } from "@/components/NotasDoMestre";
import { BackupSala } from "@/components/BackupSala";
import { UsoDaMesa } from "@/components/UsoDaMesa";
import { registrarUso } from "@/lib/registrarUso";

type Secao = "encontros" | "npcs" | "notas" | "sala";

/** Aba Mestre: uma tela por assunto, com um seletor no topo. Antes eram quatro
 *  blocos empilhados (o catálogo de monstros sozinho já ocupava uma rolagem).
 *  Os componentes de cada assunto são os mesmos de antes. */
export function AbaMestre({
  sala,
  codigo,
  rotulo,
  aoAbrirTelao,
}: {
  sala: Sala;
  codigo: string;
  rotulo: string;
  aoAbrirTelao: () => void;
}) {
  const [secao, setSecao] = useState<Secao>("encontros");
  useEffect(() => {
    registrarUso(`mestre:${secao}`);
  }, [secao]);

  const secoes: { id: Secao; rotulo: string; qtd?: number }[] = [
    { id: "encontros", rotulo: "Encontros", qtd: sala.encontros.length },
    { id: "npcs", rotulo: "NPCs", qtd: sala.modelosNpc.length },
    { id: "notas", rotulo: "Notas" },
    { id: "sala", rotulo: "Sala" },
  ];

  return (
    <>
      <div className="segmentos" role="tablist" aria-label="Seções do Mestre">
        {secoes.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={secao === s.id}
            onClick={() => setSecao(s.id)}
          >
            {s.rotulo}
            <em>{s.qtd !== undefined ? s.qtd : " "}</em>
          </button>
        ))}
      </div>

      {secao === "encontros" && <EncontrosPreparados sala={sala} />}
      {secao === "npcs" && <BibliotecaNpcs sala={sala} />}
      {secao === "notas" && <NotasDoMestre valor={sala.notasMestre} onSalvar={sala.definirNotasMestre} />}
      {secao === "sala" && (
        <>
          <div className="combat">
            <div className="combat-head">
              <h2>Telão</h2>
            </div>
            <p className="bkpexplica">Uma tela só pra mesa olhar, num outro aparelho ou numa TV.</p>
            <button type="button" className="btn" onClick={aoAbrirTelao}>
              📺 abrir o modo telão
            </button>
          </div>
          <UsoDaMesa codigo={codigo} />
          <BackupSala sala={sala} codigo={codigo} rotulo={rotulo} />
        </>
      )}
    </>
  );
}
