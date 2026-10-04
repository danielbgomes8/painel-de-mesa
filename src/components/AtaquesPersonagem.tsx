"use client";

import { useState } from "react";
import { modificador, separarAtaques } from "@/lib/regras";
import { ataqueNovo, calcularAtaque, dadoValido, MAX_ATAQUES } from "@/lib/ataquesFicha";
import type { AtaqueFicha, Atributo, Atributos } from "@/lib/tipos";
import { BotaoRemover } from "@/components/BotaoRemover";
import { CampoNumero } from "@/components/CampoNumero";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";

const ATRIBUTOS: { chave: Atributo; sigla: string }[] = [
  { chave: "for", sigla: "FOR" },
  { chave: "des", sigla: "DES" },
  { chave: "con", sigla: "CON" },
  { chave: "int", sigla: "INT" },
  { chave: "sab", sigla: "SAB" },
  { chave: "car", sigla: "CAR" },
];

function comSinal(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** Ataques do personagem de jogador, no topo da ficha — é o que se lê no
 *  próprio turno, então aparece como lista legível e não como campo de texto
 *  que rola por dentro (a ficha do jogador está sempre em modo de edição pra
 *  ele e pro Mestre). Editar é raro — subiu de nível, pegou arma nova —, por
 *  isso fica atrás de "editar".
 *
 *  Dois jeitos de ter um ataque, que aparecem juntos na lista:
 *   - **calculado** (`ataques`, migration 0027): o jogador diz o atributo, se tem
 *     proficiência, o dado e os bônus extras, e o app tira acerto e dano dos atributos e
 *     do nível — subiu a Força, muda sozinho (contas em `lib/ataquesFicha.ts`);
 *   - **texto livre** (`ataque`, migration 0008, uma linha por ataque): pra o que não
 *     cabe na conta (magia de ataque, ataque especial). Ficha antiga só tem este. */
export function AtaquesPersonagem({
  textoEfetivo,
  textoLivre,
  ataques,
  atributos,
  nivel,
  editavel,
  onSalvarTexto,
  onSalvarAtaques,
}: {
  /** O que a lista mostra: os calculados e depois o texto livre (`textoEfetivoDeAtaques`). */
  textoEfetivo: string;
  textoLivre: string;
  ataques: AtaqueFicha[];
  atributos: Atributos;
  nivel: number;
  editavel: boolean;
  onSalvarTexto: (texto: string) => void;
  onSalvarAtaques: (ataques: AtaqueFicha[]) => void;
}) {
  const [editando, setEditando] = useState(false);
  const linhas = separarAtaques(textoEfetivo);

  function alterar(i: number, mudanca: Partial<AtaqueFicha>) {
    onSalvarAtaques(ataques.map((a, idx) => (idx === i ? { ...a, ...mudanca } : a)));
  }

  if (editando && editavel) {
    return (
      <div className="ataquebloco pc">
        <div className="subrow">
          <span className="sectitle">Ataques</span>
          {/* Tocar aqui tira o foco do campo antes do clique, e os campos
           *  gravam no blur — não perde o que foi digitado. */}
          <button type="button" className="minilink" onClick={() => setEditando(false)}>
            pronto
          </button>
        </div>

        {ataques.map((a, i) => {
          const { acerto, dano } = calcularAtaque(a, atributos, nivel);
          return (
            <div key={i} className="atq-card">
              <CampoTexto valor={a.nome} maxLength={60} placeholder="nome (ex.: Espada longa)" onCommit={(t) => alterar(i, { nome: t })} />
              <div className="atq-linha">
                <select
                  aria-label={`atributo de ${a.nome || "ataque"}`}
                  value={a.atributo ?? ""}
                  onChange={(e) => alterar(i, { atributo: (e.target.value || null) as Atributo | null })}
                >
                  <option value="">sem atributo</option>
                  {ATRIBUTOS.map((t) => (
                    <option key={t.chave} value={t.chave}>
                      {t.sigla} {comSinal(modificador(atributos[t.chave]))}
                    </option>
                  ))}
                </select>
                <label className="inv-mag">
                  <input type="checkbox" checked={a.proficiente} onChange={(e) => alterar(i, { proficiente: e.target.checked })} />
                  proficiente
                </label>
              </div>
              <div className="atq-linha">
                <label className="atq-campo">
                  dado
                  <CampoTexto
                    valor={a.dado}
                    maxLength={8}
                    placeholder="1d8"
                    onCommit={(t) => alterar(i, { dado: dadoValido(t) ? t.trim().toLowerCase() : "" })}
                  />
                </label>
                <label className="atq-campo">
                  tipo
                  <CampoTexto valor={a.tipo} maxLength={30} placeholder="cortante" onCommit={(t) => alterar(i, { tipo: t })} />
                </label>
              </div>
              <div className="atq-linha">
                <label className="atq-campo">
                  acerto extra
                  <CampoNumero valor={a.bonusAcerto} onCommit={(n) => alterar(i, { bonusAcerto: n })} />
                </label>
                <label className="atq-campo">
                  dano extra
                  <CampoNumero valor={a.bonusDano} onCommit={(n) => alterar(i, { bonusDano: n })} />
                </label>
              </div>
              <div className="atq-linha">
                <span className="atq-previa" aria-live="polite">
                  {comSinal(acerto)} para acertar{dano ? ` · ${dano}` : " · sem dado"}
                </span>
                <BotaoRemover
                  aria={`remover ${a.nome || "ataque"}`}
                  confirmar={`Tirar "${a.nome || "ataque"}" da lista?`}
                  onConfirmar={() => onSalvarAtaques(ataques.filter((_, idx) => idx !== i))}
                  className="removechar"
                >
                  remover
                </BotaoRemover>
              </div>
            </div>
          );
        })}

        {ataques.length < MAX_ATAQUES && (
          <button type="button" className="btn" onClick={() => onSalvarAtaques([...ataques, ataqueNovo()])}>
            + ataque calculado
          </button>
        )}

        <span className="sectitle atq-livre">Texto livre</span>
        <div className="notesbox">
          <CampoTextoAdiado
            valor={textoLivre}
            maxLength={600}
            placeholder={"o que não cabe na conta, uma linha por ataque, ex.:\nRaio de Fogo: +7, 2d10 fogo"}
            onSalvar={onSalvarTexto}
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
