"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { HabilidadeClasse } from "@/lib/classesSrd";
import { NOME_CLASSE } from "@/lib/classesNomes";
import { mudancaDe, textoDesfeito } from "@/lib/desfazer";
import {
  ATRIBUTO_MAXIMO,
  DADO_DE_VIDA,
  ganhaAumentoDeAtributo,
  subirDeNivel,
  type EscolhaAtributos,
  type PedidoSubida,
} from "@/lib/subirDeNivel";
import type { Atributo, Personagem } from "@/lib/tipos";
import { registrarUso } from "@/lib/registrarUso";

const ATRIBUTOS: { chave: Atributo; nome: string }[] = [
  { chave: "for", nome: "Força" },
  { chave: "des", nome: "Destreza" },
  { chave: "con", nome: "Constituição" },
  { chave: "int", nome: "Inteligência" },
  { chave: "sab", nome: "Sabedoria" },
  { chave: "car", nome: "Carisma" },
];

type ModoAtributo = "mais2" | "mais1" | "talento";

/**
 * "⬆ Subir para o nível N": aplica de uma vez o que um nível muda na ficha — PV máximo (valor fixo ou
 * o que o jogador rolou), dado de vida, espaços de magia, aumento de atributo e as habilidades novas —,
 * mostrando antes exatamente o que vai mudar. Grava como as outras ações da ficha: confirma o banco,
 * escreve no log e entra no botão de desfazer. As contas são de `lib/subirDeNivel.ts`.
 */
export function SubirDeNivel({
  personagem: p,
  indiceClasse,
  habilidadesNovas,
  sala,
}: {
  personagem: Personagem;
  indiceClasse: number;
  /** As habilidades da classe no nível novo (vazio enquanto o catálogo não baixou). */
  habilidadesNovas: HabilidadeClasse[];
  sala: Sala;
}) {
  const classe = p.classes[indiceClasse];
  const [aberto, setAberto] = useState(false);
  const [pvRolado, setPvRolado] = useState(false);
  const [rolado, setRolado] = useState("");
  const [modo, setModo] = useState<ModoAtributo>("mais2");
  const [a1, setA1] = useState<Atributo>("for");
  const [a2, setA2] = useState<Atributo>("con");
  const [anotar, setAnotar] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<{ linhas: string[]; avisos: string[] } | null>(null);

  if (!classe) return null;
  const novoNivel = classe.nivel + 1;
  const faces = DADO_DE_VIDA[classe.classe];
  const pedeAtributo = ganhaAumentoDeAtributo(classe.classe, novoNivel);

  let atributos: EscolhaAtributos | undefined;
  if (pedeAtributo) {
    if (modo === "talento") atributos = { tipo: "talento" };
    else if (modo === "mais2") atributos = { tipo: "atributos", aumentos: { [a1]: 2 } };
    else atributos = { tipo: "atributos", aumentos: a1 === a2 ? { [a1]: 2 } : { [a1]: 1, [a2]: 1 } };
  }
  const pedido: PedidoSubida = {
    indiceClasse,
    pv: pvRolado ? { tipo: "rolado", valor: Number.parseInt(rolado, 10) } : { tipo: "fixo" },
    atributos,
    anotarHabilidades: anotar && habilidadesNovas.length > 0,
  };
  const previa = subirDeNivel(p, pedido, habilidadesNovas);

  async function confirmar() {
    registrarUso("acao:subir-nivel");
    if (!previa.ok || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const gravou = await sala.atualizarVariosPersonagens([{ id: p.id, patch: previa.patch }]);
      if (!gravou) {
        setErro("Não gravou. Confira a conexão e tente de novo.");
        return;
      }
      sala.registrarVariosLogs([previa.textoLog]);
      sala.lembrarDesfazer({
        rotulo: previa.textoLog,
        textoLog: textoDesfeito([previa.textoLog], ""),
        personagens: [mudancaDe(p, previa.patch)],
        combate: null,
        criados: [],
      });
      setFeito({ linhas: previa.linhas, avisos: previa.avisos });
      setAberto(false);
      setPvRolado(false);
      setRolado("");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="sn">
      {feito && (
        <div className="sn-feito" role="status" aria-live="polite">
          <b>Subiu de nível.</b> Dá pra desfazer no botão ↩ lá embaixo.
          <ul>
            {feito.linhas.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {feito.avisos.length > 0 && (
            <>
              <span className="sectitle">Falta fazer</span>
              <ul>
                {feito.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </>
          )}
          <button type="button" className="minilink" onClick={() => setFeito(null)}>
            fechar
          </button>
        </div>
      )}

      {!aberto ? (
        <button type="button" className="btn primary" onClick={() => { setFeito(null); setAberto(true); }}>
          ⬆ Subir para o nível {novoNivel} de {NOME_CLASSE[classe.classe]}
        </button>
      ) : (
        <div className="sn-painel" role="group" aria-label={`Subir ${NOME_CLASSE[classe.classe]} para o nível ${novoNivel}`}>
          <span className="sectitle">Pontos de vida</span>
          <label className="inv-mag">
            <input type="radio" name={`pv-${indiceClasse}`} checked={!pvRolado} onChange={() => setPvRolado(false)} /> valor fixo do d{faces}
            {" "}(metade do dado + 1)
          </label>
          <label className="inv-mag">
            <input type="radio" name={`pv-${indiceClasse}`} checked={pvRolado} onChange={() => setPvRolado(true)} /> rolei o d{faces}:
            <input
              className="num sn-num"
              type="number"
              inputMode="numeric"
              min={1}
              max={faces}
              aria-label={`resultado do d${faces}`}
              value={rolado}
              disabled={!pvRolado}
              onChange={(e) => setRolado(e.target.value)}
            />
          </label>

          {pedeAtributo && (
            <>
              <span className="sectitle">Aumento de atributo ou talento</span>
              <label className="inv-mag">
                <input type="radio" name={`atr-${indiceClasse}`} checked={modo === "mais2"} onChange={() => setModo("mais2")} /> +2 em um atributo:
                <select aria-label="atributo que ganha +2" value={a1} disabled={modo !== "mais2"} onChange={(e) => setA1(e.target.value as Atributo)}>
                  {ATRIBUTOS.map((a) => (
                    <option key={a.chave} value={a.chave} disabled={p.atributos[a.chave] + 2 > ATRIBUTO_MAXIMO}>
                      {a.nome} ({p.atributos[a.chave]})
                    </option>
                  ))}
                </select>
              </label>
              <label className="inv-mag">
                <input type="radio" name={`atr-${indiceClasse}`} checked={modo === "mais1"} onChange={() => setModo("mais1")} /> +1 em dois:
                <select aria-label="primeiro atributo que ganha +1" value={a1} disabled={modo !== "mais1"} onChange={(e) => setA1(e.target.value as Atributo)}>
                  {ATRIBUTOS.map((a) => (
                    <option key={a.chave} value={a.chave} disabled={p.atributos[a.chave] + 1 > ATRIBUTO_MAXIMO}>
                      {a.nome} ({p.atributos[a.chave]})
                    </option>
                  ))}
                </select>
                <select aria-label="segundo atributo que ganha +1" value={a2} disabled={modo !== "mais1"} onChange={(e) => setA2(e.target.value as Atributo)}>
                  {ATRIBUTOS.map((a) => (
                    <option key={a.chave} value={a.chave} disabled={p.atributos[a.chave] + 1 > ATRIBUTO_MAXIMO}>
                      {a.nome} ({p.atributos[a.chave]})
                    </option>
                  ))}
                </select>
              </label>
              <label className="inv-mag">
                <input type="radio" name={`atr-${indiceClasse}`} checked={modo === "talento"} onChange={() => setModo("talento")} /> um talento (eu anoto na ficha)
              </label>
            </>
          )}

          {habilidadesNovas.length > 0 && (
            <label className="inv-mag">
              <input type="checkbox" checked={anotar} onChange={(e) => setAnotar(e.target.checked)} /> copiar as habilidades novas para a ficha completa
            </label>
          )}

          <span className="sectitle">O que vai mudar</span>
          {previa.ok ? (
            <>
              <ul className="sn-linhas">
                {previa.linhas.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {previa.avisos.length > 0 && (
                <ul className="sn-avisos">
                  {previa.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="inv-alerta">{previa.motivo}</p>
          )}
          {erro && (
            <p className="inv-alerta" role="status">
              {erro}
            </p>
          )}
          <div className="inv-acoes">
            <button type="button" className="btn primary" disabled={!previa.ok || ocupado} onClick={() => void confirmar()}>
              Confirmar
            </button>
            <button type="button" className="btn ghost" onClick={() => setAberto(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
