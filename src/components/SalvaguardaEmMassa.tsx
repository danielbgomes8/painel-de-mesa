"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Atributo, Personagem } from "@/lib/tipos";
import type { ParteDano } from "@/lib/regras";
import { danoComLog } from "@/lib/regras";
import { rolarDado } from "@/lib/dados";
import { contarAlvos, mudancaDe, textoDesfeito, type MudancaPersonagem } from "@/lib/desfazer";
import { registrarUso } from "@/lib/registrarUso";
import {
  ATRIBUTOS_DA_SALVAGUARDA,
  CD_MAXIMA,
  CD_MINIMA,
  bonusDaSalvaguarda,
  danoNoAlvo,
  lerDanoDaSalvaguarda,
  linhaDaSalvaguarda,
  rolarDanoDoEfeito,
  rolarSalvaguardas,
  rotuloDoDano,
  type AoPassar,
} from "@/lib/salvaguarda";

type Linha = { id: string; nome: string; d20: number; bonus: number; total: number; passou: boolean; dano: string };

type Resultado = {
  atributo: Atributo;
  cd: number;
  partes: ParteDano[];
  /** Quanto o efeito rolou (igual pra todos); null = efeito sem dano. */
  danoRolado: number | null;
  dados: number[];
  aoPassar: AoPassar;
  linhas: Linha[];
};

const SINAL = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

/**
 * Salvaguarda em massa (bola de fogo contra seis goblins): rola o d20 de cada
 * alvo selecionado, rola o dano UMA vez, e mostra quem passou e quanto cada um
 * leva. O Mestre confere e corrige antes de aplicar — o jogador pode ter rolado
 * o próprio dado na mesa, e resistência/imunidade é texto livre na ficha, que o
 * app não lê. Só o Mestre vê. As contas moram em `lib/salvaguarda.ts`.
 */
export function SalvaguardaEmMassa({
  sala,
  selecionados,
  aoSelecionar,
}: {
  sala: Sala;
  selecionados: Personagem[];
  aoSelecionar: (ids: string[]) => void;
}) {
  const [atributo, setAtributo] = useState<Atributo>("des");
  const [cd, setCd] = useState("");
  const [danoTexto, setDanoTexto] = useState("");
  const [aoPassar, setAoPassar] = useState<AoPassar>("metade");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const n = selecionados.length;

  function rolar() {
    setAviso(null);
    const cdNum = Number.parseInt(cd, 10);
    if (!Number.isFinite(cdNum) || cdNum < CD_MINIMA || cdNum > CD_MAXIMA) {
      setAviso(`Digite a CD (de ${CD_MINIMA} a ${CD_MAXIMA}).`);
      return;
    }
    const dano = lerDanoDaSalvaguarda(danoTexto);
    if (!dano.ok) {
      setAviso(dano.motivo);
      return;
    }
    registrarUso("acao:salvaguarda-massa");
    const rolagens = rolarSalvaguardas(
      selecionados.map((p) => ({ id: p.id, bonus: bonusDaSalvaguarda(p, atributo) })),
      cdNum,
      rolarDado,
    );
    const rolado = dano.partes.length > 0 ? rolarDanoDoEfeito(dano.partes, rolarDado) : null;
    const nomes = new Map(selecionados.map((p) => [p.id, p.name]));
    setResultado({
      atributo,
      cd: cdNum,
      partes: dano.partes,
      danoRolado: rolado ? rolado.total : null,
      dados: rolado ? rolado.dados : [],
      aoPassar,
      linhas: rolagens.map((r) => ({
        ...r,
        nome: nomes.get(r.id) ?? "?",
        dano: rolado ? String(danoNoAlvo(rolado.total, r.passou, aoPassar)) : "",
      })),
    });
  }

  function trocarResultado(id: string) {
    setResultado((r) => {
      if (!r) return r;
      return {
        ...r,
        linhas: r.linhas.map((l) => {
          if (l.id !== id) return l;
          const passou = !l.passou;
          return { ...l, passou, dano: r.danoRolado === null ? "" : String(danoNoAlvo(r.danoRolado, passou, r.aoPassar)) };
        }),
      };
    });
  }

  function mudarDano(id: string, dano: string) {
    setResultado((r) => (r ? { ...r, linhas: r.linhas.map((l) => (l.id === id ? { ...l, dano } : l)) } : r));
  }

  async function aplicar() {
    if (!resultado || aplicando) return;
    setAviso(null);
    const mudancas: MudancaPersonagem[] = [];
    const textos: string[] = [];
    for (const l of resultado.linhas) {
      const p = sala.personagens.find((x) => x.id === l.id);
      const dano = Number.parseInt(l.dano, 10);
      if (!p || !Number.isFinite(dano) || dano <= 0) continue;
      const { patch, texto } = danoComLog(p, dano);
      mudancas.push(mudancaDe(p, patch));
      if (texto) textos.push(texto);
    }
    if (mudancas.length === 0) {
      setAviso("Ninguém levou dano, então não há o que aplicar.");
      return;
    }
    setAplicando(true);
    const deuCerto = await sala.atualizarVariosPersonagens(mudancas.map((m) => ({ id: m.id, patch: m.depois })));
    setAplicando(false);
    // Só loga depois que a escrita das fichas confirmar (mesma regra do dano em massa).
    if (!deuCerto) return;
    const passaram = resultado.linhas.filter((l) => l.passou).length;
    // A linha da salvaguarda vai por último: o log mostra a mais nova no topo.
    sala.registrarVariosLogs([...textos, linhaDaSalvaguarda(resultado.atributo, resultado.cd, passaram, resultado.linhas.length - passaram)]);
    const nomeDoAtributo = ATRIBUTOS_DA_SALVAGUARDA.find((a) => a.id === resultado.atributo)?.nome ?? "";
    const oQue = `Salvaguarda de ${nomeDoAtributo}: dano em ${contarAlvos(mudancas.length)}`;
    sala.lembrarDesfazer({ rotulo: oQue, textoLog: textoDesfeito(textos, oQue), personagens: mudancas, combate: null, criados: [] });
    setResultado(null);
  }

  /** Sem dano (ou depois de conferir): joga só o resultado no log e deixa quem falhou selecionado pra pôr a condição. */
  function selecionarQuemFalhou() {
    if (!resultado) return;
    aoSelecionar(resultado.linhas.filter((l) => !l.passou).map((l) => l.id));
  }

  async function registrarSoOResultado() {
    if (!resultado) return;
    const passaram = resultado.linhas.filter((l) => l.passou).length;
    await sala.registrarLog(linhaDaSalvaguarda(resultado.atributo, resultado.cd, passaram, resultado.linhas.length - passaram));
    setResultado(null);
  }

  const semDano = resultado !== null && resultado.danoRolado === null;
  const passaram = resultado ? resultado.linhas.filter((l) => l.passou).length : 0;

  return (
    <div className="salvaguarda">
      <p className="bkptitulo">🎲 Salvaguarda em massa</p>
      <div className="masstools">
        <select aria-label="Atributo da salvaguarda" value={atributo} onChange={(e) => setAtributo(e.target.value as Atributo)}>
          {ATRIBUTOS_DA_SALVAGUARDA.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
        <input className="num" type="number" inputMode="numeric" placeholder="CD" aria-label="CD da salvaguarda" value={cd} onChange={(e) => setCd(e.target.value)} />
        <input
          type="text"
          className="salvdano"
          placeholder="8d6 fogo"
          aria-label="Dano do efeito (vazio = sem dano)"
          value={danoTexto}
          onChange={(e) => setDanoTexto(e.target.value)}
        />
        <select aria-label="Quem passa leva" value={aoPassar} onChange={(e) => setAoPassar(e.target.value as AoPassar)}>
          <option value="metade">passou: metade</option>
          <option value="nada">passou: nada</option>
          <option value="tudo">passou: tudo</option>
        </select>
        <button type="button" className="btn" disabled={n === 0} onClick={rolar}>
          Rolar por {n} {n === 1 ? "alvo" : "alvos"}
        </button>
      </div>

      {aviso && (
        <p className="inv-alerta" role="status" aria-live="polite">
          {aviso}
        </p>
      )}

      {resultado && (
        <div className="salvresultado" aria-live="polite">
          <p className="bkpexplica">
            {ATRIBUTOS_DA_SALVAGUARDA.find((a) => a.id === resultado.atributo)?.nome}, CD {resultado.cd}:{" "}
            <b>{passaram} {passaram === 1 ? "passou" : "passaram"}</b>, {resultado.linhas.length - passaram}{" "}
            {resultado.linhas.length - passaram === 1 ? "falhou" : "falharam"}.
            {resultado.danoRolado !== null && (
              <>
                {" "}
                O efeito rolou <b>{resultado.danoRolado}</b>
                {rotuloDoDano(resultado.partes) ? ` de ${rotuloDoDano(resultado.partes)}` : ""}
                {resultado.dados.length > 0 ? ` (${resultado.dados.join("+")})` : ""}. Toque em passou/falhou ou mude o dano pra corrigir (resistência, imunidade, dado rolado na mesa).
              </>
            )}
          </p>
          <ul className="salvlista">
            {resultado.linhas.map((l) => (
              <li key={l.id}>
                <span className="salvnome">{l.nome}</span>
                <span className="salvconta">
                  🎲 {l.d20} {SINAL(l.bonus)} = {l.total}
                </span>
                <button
                  type="button"
                  className={`chip alvo salvbotao ${l.passou ? "passou" : "falhou"}`}
                  aria-pressed={l.passou}
                  aria-label={`${l.nome}: ${l.passou ? "passou" : "falhou"}. Tocar para trocar`}
                  onClick={() => trocarResultado(l.id)}
                >
                  {l.passou ? "passou" : "falhou"}
                </button>
                {!semDano && (
                  <input
                    className="num salvvalor"
                    type="number"
                    inputMode="numeric"
                    aria-label={`Dano em ${l.nome}`}
                    value={l.dano}
                    onChange={(e) => mudarDano(l.id, e.target.value)}
                  />
                )}
              </li>
            ))}
          </ul>
          <div className="masstools">
            {!semDano ? (
              <button type="button" className="btn primary" disabled={aplicando} onClick={() => void aplicar()}>
                Aplicar o dano
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => void registrarSoOResultado()}>
                Registrar no log
              </button>
            )}
            <button type="button" className="btn" onClick={selecionarQuemFalhou}>
              Selecionar quem falhou
            </button>
            <button type="button" className="btn ghost" onClick={() => setResultado(null)}>
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
