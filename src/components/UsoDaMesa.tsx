"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ehTabelaAusente } from "@/lib/cenas";
import { relatarErro } from "@/lib/relatarErro";
import { DIAS_DO_RESUMO, quandoFoi, resumirUso, type LinhaDeUso, type ResumoDeUso } from "@/lib/uso";

type Estado =
  | { fase: "fechado" }
  | { fase: "lendo" }
  | { fase: "pronto"; resumo: ResumoDeUso }
  | { fase: "sem-tabela" }
  | { fase: "erro" };

/** Quantas linhas lê no máximo: a conta é por tela, e 5 mil cobrem muitos meses de uma mesa. */
const MAXIMO_DE_LINHAS = 5000;

/**
 * "O que a mesa usa": quais telas e ações foram abertas nos últimos 30 dias,
 * da mais usada pra menos, e as que ninguém abriu. Só o Mestre vê (fica em
 * Mestre → Sala). Os dados vêm de `lib/registrarUso.ts`; só o site publicado
 * registra, então no `npm run dev` isto fica vazio.
 */
export function UsoDaMesa({ codigo }: { codigo: string }) {
  const [estado, setEstado] = useState<Estado>({ fase: "fechado" });

  async function ler() {
    setEstado({ fase: "lendo" });
    const desde = new Date(Date.now() - DIAS_DO_RESUMO * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("uso")
      .select("tela,papel,abertura,created_at")
      .eq("room_code", codigo)
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(MAXIMO_DE_LINHAS);
    if (error) {
      if (ehTabelaAusente(error)) setEstado({ fase: "sem-tabela" });
      else {
        relatarErro("lerUso", error);
        setEstado({ fase: "erro" });
      }
      return;
    }
    setEstado({ fase: "pronto", resumo: resumirUso((data ?? []) as LinhaDeUso[], Date.now()) });
  }

  return (
    <details
      className="gavetacombate"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open && estado.fase === "fechado") void ler();
      }}
    >
      <summary>
        <span>📊 O que a mesa usa</span>
        <span className="dica">últimos {DIAS_DO_RESUMO} dias</span>
      </summary>
      <div className="gavetacorpo" aria-live="polite">
        {estado.fase === "lendo" && <p className="bkpexplica">Lendo…</p>}
        {estado.fase === "sem-tabela" && (
          <p className="bkpexplica">Falta rodar a migration 0033 (tabela de uso) no Supabase.</p>
        )}
        {estado.fase === "erro" && (
          <p className="bkpexplica">
            Não consegui ler.{" "}
            <button type="button" className="minilink" onClick={() => void ler()}>
              tentar de novo
            </button>
          </p>
        )}
        {estado.fase === "pronto" && <Resumo resumo={estado.resumo} />}
      </div>
    </details>
  );
}

function Resumo({ resumo }: { resumo: ResumoDeUso }) {
  const agora = new Date();
  if (resumo.aberturasNoTotal === 0) {
    return (
      <p className="bkpexplica">
        Ainda sem registro. O app só começa a contar depois da migration 0033 e da próxima versão publicada, e só no
        site de verdade (não no teste local).
      </p>
    );
  }
  return (
    <>
      <p className="bkpexplica">
        {resumo.aberturasNoTotal} {resumo.aberturasNoTotal === 1 ? "abertura" : "aberturas"} do app. O número ao lado de
        cada tela é em quantas aberturas ela foi usada.
      </p>
      <ul className="usolista">
        {resumo.usadas.map((t) => (
          <li key={t.tela}>
            <span className="usonome">{t.rotulo}</span>
            <span className="usonum">{t.aberturas}</span>
            <span className="usodetalhe">
              {[
                t.porPapel.mestre > 0 ? `Mestre ${t.porPapel.mestre}` : null,
                t.porPapel.jogador > 0 ? `jogadores ${t.porPapel.jogador}` : null,
                t.porPapel.telao > 0 ? `telão ${t.porPapel.telao}` : null,
                t.ultimo ? `última vez ${quandoFoi(t.ultimo, agora)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
      {resumo.nuncaUsadas.length > 0 && (
        <>
          <p className="bkptitulo">Ninguém abriu</p>
          <p className="bkpexplica">{resumo.nuncaUsadas.map((t) => t.rotulo).join(" · ")}</p>
        </>
      )}
    </>
  );
}
