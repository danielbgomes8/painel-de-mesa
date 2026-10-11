"use client";

import { useState } from "react";
import type { Armadilhas } from "@/hooks/useArmadilhas";
import type { Pisada } from "@/lib/armadilhas";
import {
  ARMADILHAS_MAXIMAS,
  ARMADILHAS_PRONTAS,
  PERIGOS_PRONTOS,
  CD_MAXIMA,
  DANO_MAXIMO,
  NOME_MAXIMO,
  NOTA_MAXIMA,
  RAIO_PADRAO_M,
  cdValida,
  linhaDeDesarme,
  linhaDeDisparo,
  linhaDePerigo,
  nomeDaArmadilha,
  raioValido,
  rolarDanoDoTexto,
  rotuloDoEstado,
  sugestaoDaArmadilha,
  type Armadilha,
  type DanoRolado,
  type NovaArmadilha,
  type TipoArmadilha,
} from "@/lib/armadilhas";

/** O que o Mestre preenche antes de tocar no mapa: o lugar vem do toque. */
export type RascunhoDeArmadilha = Omit<NovaArmadilha, "x" | "y">;

const SALVAGUARDAS = ["", "FOR", "DES", "CON", "INT", "SAB", "CAR"] as const;
const RAIOS_PRONTOS: readonly { rotulo: string; metros: number }[] = [
  { rotulo: "1 quadradinho", metros: RAIO_PADRAO_M },
  { rotulo: "3 m", metros: 3 },
  { rotulo: "4,5 m", metros: 4.5 },
  { rotulo: "6 m", metros: 6 },
];

/**
 * Preparar e cuidar das armadilhas do mapa (só o Mestre). A armadilha nasce escondida: a mesa só a vê depois
 * que o Mestre revela, dispara ou desarma. Quem pisar nela avisa SÓ o Mestre (ver `AvisosDePisada`).
 */
export function PainelDeArmadilhas({
  arm,
  colocando,
  aoColocar,
  aoCancelarColocar,
}: {
  arm: Armadilhas;
  /** Esperando um toque no mapa pra dizer onde a armadilha fica. */
  colocando: boolean;
  aoColocar: (rascunho: RascunhoDeArmadilha) => void;
  aoCancelarColocar: () => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  /** O que se prepara: uma armadilha (dispara uma vez) ou um perigo (zona que continua: fogo, gás...). */
  const [tipo, setTipo] = useState<TipoArmadilha>("armadilha");
  const [nome, setNome] = useState("");
  const [salvaguarda, setSalvaguarda] = useState<string>("DES");
  const [cd, setCd] = useState("");
  const [dano, setDano] = useState("");
  const [raio, setRaio] = useState<number>(RAIO_PADRAO_M);
  /** O que está escrito no campo "outro (m)" (o raio só muda quando o texto vale). */
  const [outroRaio, setOutroRaio] = useState("");
  const [nota, setNota] = useState("");

  const cdOk = cd.trim() === "" || cdValida(cd) !== null;
  const raioOk = raioValido(raio) !== null;
  const rascunho: RascunhoDeArmadilha = {
    nome: nome.trim().slice(0, NOME_MAXIMO),
    salvaguarda,
    cd: cd.trim() === "" ? null : cdValida(cd),
    dano: dano.trim().slice(0, DANO_MAXIMO),
    raio: raioValido(raio) ?? RAIO_PADRAO_M,
    nota: nota.trim().slice(0, NOTA_MAXIMA),
    tipo,
    // Perigo nasce à vista (a mesa vê o fogo); armadilha nasce escondida.
    estado: tipo === "perigo" ? "revelada" : "armada",
  };
  const prontas = tipo === "perigo" ? PERIGOS_PRONTOS : ARMADILHAS_PRONTAS;
  const cheio = arm.armadilhas.length >= ARMADILHAS_MAXIMAS;

  function limpar() {
    setEditando(null);
    setNome("");
    setCd("");
    setDano("");
    setNota("");
    setRaio(RAIO_PADRAO_M);
    setOutroRaio("");
    setSalvaguarda("DES");
  }

  function editar(a: Armadilha) {
    setEditando(a.id);
    setTipo(a.tipo);
    setNome(a.nome);
    setSalvaguarda(a.salvaguarda);
    setCd(a.cd === null ? "" : String(a.cd));
    setDano(a.dano);
    setRaio(a.raio);
    setOutroRaio("");
    setNota(a.nota);
  }

  async function salvarEdicao() {
    if (!editando || !cdOk || !raioOk) return;
    const ok = await arm.atualizar(editando, {
      nome: rascunho.nome ?? "",
      salvaguarda: rascunho.salvaguarda ?? "",
      cd: rascunho.cd ?? null,
      dano: rascunho.dano ?? "",
      raio: rascunho.raio ?? RAIO_PADRAO_M,
      nota: rascunho.nota ?? "",
    });
    if (ok) limpar();
  }

  return (
    <>
      <div className="mapa-ferr" role="group" aria-label="O que preparar">
        <button type="button" className="chip alvo" aria-pressed={tipo === "armadilha"} disabled={editando !== null} onClick={() => setTipo("armadilha")}>
          ⚠️ Armadilha
        </button>
        <button type="button" className="chip alvo" aria-pressed={tipo === "perigo"} disabled={editando !== null} onClick={() => setTipo("perigo")}>
          ☠️ Perigo
        </button>
      </div>
      <p className="fc-sub">
        {tipo === "perigo" ? (
          <>
            Um <b>perigo</b> é uma zona que continua ali: fogo, gás, ácido, água gelada. A mesa <b>vê</b> a zona. Você é avisado (só você) quando alguém{" "}
            <b>entra</b> e no <b>início do turno</b> de quem está dentro, com a salvaguarda e o dano à mão. Você decide e aplica; ele segue até você extinguir.
          </>
        ) : (
          <>
            Prepare a armadilha e toque no mapa onde ela fica. Ela nasce <b>escondida</b>: a mesa só a vê depois que você revelar, disparar ou
            desarmar. Quando um peão pisar, <b>só você</b> recebe o aviso (em qualquer aba), com a salvaguarda e o dano já à mão.
          </>
        )}
      </p>

      <div className="mapa-ferr" role="group" aria-label={tipo === "perigo" ? "Perigos prontos" : "Armadilhas prontas"}>
        {prontas.map((p) => (
          <button
            key={p.nome}
            type="button"
            className="chip alvo"
            onClick={() => {
              setNome(p.nome);
              setSalvaguarda(p.salvaguarda);
              setCd(p.cd === null ? "" : String(p.cd));
              setDano(p.dano);
              setRaio(p.raio);
              setOutroRaio("");
            }}
          >
            {p.nome}
          </button>
        ))}
      </div>

      <div className="arm-form">
        <input
          type="text"
          className="mapa-aura-campo arm-nome"
          aria-label={tipo === "perigo" ? "Nome do perigo" : "Nome da armadilha"}
          placeholder={tipo === "perigo" ? "nome (ex.: fogo no corredor)" : "nome (ex.: poço escondido)"}
          maxLength={NOME_MAXIMO}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <select aria-label="Salvaguarda" className="mapa-aura-campo luz-select" value={salvaguarda} onChange={(e) => setSalvaguarda(e.target.value)}>
          {SALVAGUARDAS.map((s) => (
            <option key={s} value={s}>
              {s === "" ? "sem salvaguarda" : `salvaguarda ${s}`}
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="numeric"
          className="mapa-aura-campo"
          aria-label="CD da salvaguarda"
          placeholder="CD"
          min={1}
          max={CD_MAXIMA}
          value={cd}
          onChange={(e) => setCd(e.target.value)}
        />
        <input
          type="text"
          className="mapa-aura-campo arm-dano"
          aria-label="Dano"
          placeholder="dano (ex.: 2d6 contundente)"
          maxLength={DANO_MAXIMO}
          value={dano}
          onChange={(e) => setDano(e.target.value)}
        />
      </div>
      <div className="mapa-ferr" role="group" aria-label="Tamanho da zona que dispara">
        <span className="mapa-aura-titulo">Zona</span>
        {RAIOS_PRONTOS.map((r) => (
          <button key={r.rotulo} type="button" className="chip alvo" aria-pressed={raio === r.metros} onClick={() => {
            setRaio(r.metros);
            setOutroRaio("");
          }}>
            {r.rotulo}
          </button>
        ))}
        <input
          type="text"
          inputMode="decimal"
          className="mapa-aura-campo"
          aria-label="Outro raio da zona, em metros"
          placeholder="outro (m)"
          value={outroRaio}
          onChange={(e) => {
            setOutroRaio(e.target.value);
            const v = raioValido(e.target.value);
            if (v !== null) setRaio(v);
          }}
        />
      </div>
      <input
        type="text"
        className="mapa-aura-campo arm-nota"
        aria-label="Anotação do Mestre"
        placeholder="anotação sua (só você vê)"
        maxLength={NOTA_MAXIMA}
        value={nota}
        onChange={(e) => setNota(e.target.value)}
      />
      {!cdOk && <p className="mapa-aura-aviso erro">Use uma CD de 1 a {CD_MAXIMA}.</p>}
      {outroRaio.trim() !== "" && raioValido(outroRaio) === null && <p className="mapa-aura-aviso erro">Use um raio de 0,1 a 60 m.</p>}

      <div className="mapa-ferr">
        {editando ? (
          <>
            <button type="button" className="btn primary" disabled={!cdOk || !raioOk} onClick={() => void salvarEdicao()}>
              salvar alterações
            </button>
            <button type="button" className="btn" onClick={limpar}>
              cancelar
            </button>
          </>
        ) : colocando ? (
          // O "toque no mapa onde fica" vive só na dica flutuante (dois avisos iguais confundem leitor de tela).
          <button type="button" className="btn" onClick={aoCancelarColocar}>
            cancelar (esperando o toque no mapa)
          </button>
        ) : (
          <button type="button" className="btn primary" disabled={!cdOk || !raioOk || cheio} onClick={() => aoColocar(rascunho)}>
            📍 colocar no mapa
          </button>
        )}
      </div>
      {cheio && <p className="inv-alerta">Este mapa já tem {ARMADILHAS_MAXIMAS} armadilhas, que é o máximo.</p>}
      {arm.aviso && (
        <p className="mapa-erro" role="alert">
          {arm.aviso}
        </p>
      )}

      <h5 className="luz-subtitulo">No mapa</h5>
      {arm.armadilhas.length === 0 ? (
        <p className="fc-sub">Nenhuma armadilha neste mapa.</p>
      ) : (
        <ul className="luz-lista">
          {arm.armadilhas.map((a) => (
            <LinhaDaArmadilha key={a.id} a={a} arm={arm} aoEditar={() => editar(a)} />
          ))}
        </ul>
      )}
    </>
  );
}

function LinhaDaArmadilha({ a, arm, aoEditar }: { a: Armadilha; arm: Armadilhas; aoEditar: () => void }) {
  const nome = nomeDaArmadilha(a);
  const sugestao = sugestaoDaArmadilha(a);
  const perigo = a.tipo === "perigo";
  const vigiando = a.estado === "armada" || a.estado === "revelada";
  return (
    <li className={vigiando ? "luz-item" : "luz-item luz-item--apagada"}>
      <span className="luz-texto">
        <span aria-hidden="true">{perigo ? "☠️" : "⚠️"}</span> <b>{nome}</b> · {rotuloDoEstado(a.estado, a.tipo)}
        {sugestao && <span className="fc-sub"> — {sugestao}</span>}
        {a.nota && <span className="fc-sub"> · {a.nota}</span>}
      </span>
      <span className="luz-acoes">
        {a.estado === "armada" && (
          <button type="button" className="minilink" aria-label={`Revelar ${nome} pra mesa`} onClick={() => void arm.atualizar(a.id, { estado: "revelada" })}>
            {perigo ? "mostrar" : "revelar"}
          </button>
        )}
        {a.estado === "revelada" && (
          <button type="button" className="minilink" aria-label={`Esconder ${nome} da mesa`} onClick={() => void arm.atualizar(a.id, { estado: "armada" })}>
            esconder
          </button>
        )}
        {vigiando && !perigo && (
          <button type="button" className="minilink" aria-label={`Disparar ${nome}`} onClick={() => void arm.atualizar(a.id, { estado: "disparada" })}>
            disparar
          </button>
        )}
        {vigiando && (
          <button type="button" className="minilink" aria-label={`${perigo ? "Extinguir" : "Desarmar"} ${nome}`} onClick={() => void arm.atualizar(a.id, { estado: "desarmada" })}>
            {perigo ? "extinguir" : "desarmar"}
          </button>
        )}
        {!vigiando && (
          <button
            type="button"
            className="minilink"
            aria-label={perigo ? `Reacender ${nome}` : `Armar ${nome} de novo, escondida`}
            onClick={() => void arm.atualizar(a.id, { estado: perigo ? "revelada" : "armada" })}
          >
            {perigo ? "reacender" : "rearmar"}
          </button>
        )}
        <button type="button" className="minilink" aria-label={`Editar ${nome}`} onClick={aoEditar}>
          editar
        </button>
        <button type="button" className="minilink" aria-label={`Apagar ${nome}`} onClick={() => void arm.remover(a.id)}>
          apagar
        </button>
      </span>
    </li>
  );
}

/**
 * O aviso de que alguém pisou: aparece só pro Mestre, em cima do mapa. **Armadilha**: disparar (a mesa passa a ver
 * e o log conta), desarmar (idem, como neutralizada) ou deixar passar (continua escondida e vigiando).
 * **Perigo** (fogo, gás...): registrar no log (o perigo pegou), extinguir ou deixar passar; o Mestre aplica o dano.
 */
export function AvisosDePisada({
  pendentes,
  armadilhas,
  arm,
  aoResolver,
  registrar,
}: {
  pendentes: readonly Pisada[];
  armadilhas: readonly Armadilha[];
  arm: Armadilhas;
  aoResolver: (p: Pisada) => void;
  registrar: (texto: string) => void;
}) {
  if (pendentes.length === 0) return null;
  return (
    <div className="arm-avisos" role="alert" aria-label="Alguém pisou numa armadilha ou perigo">
      {pendentes.map((p) => {
        const a = armadilhas.find((x) => x.id === p.armadilhaId);
        if (!a) return null;
        return (
          <AvisoDePisada
            key={`${p.pecaId}:${p.armadilhaId}`}
            quem={p.peca || "Alguém"}
            a={a}
            motivo={p.motivo}
            aoDisparar={async () => {
              const ok = a.tipo === "perigo" ? true : await arm.atualizar(a.id, { estado: "disparada" });
              if (!ok) return;
              registrar(a.tipo === "perigo" ? linhaDePerigo(p.peca || "Alguém", a, p.motivo) : linhaDeDisparo(p.peca || "Alguém", a));
              aoResolver(p);
            }}
            aoDesarmar={async () => {
              const ok = await arm.atualizar(a.id, { estado: "desarmada" });
              if (!ok) return;
              registrar(linhaDeDesarme(p.peca || null, a));
              aoResolver(p);
            }}
            aoDeixarPassar={() => aoResolver(p)}
          />
        );
      })}
    </div>
  );
}

function AvisoDePisada({
  quem,
  a,
  motivo,
  aoDisparar,
  aoDesarmar,
  aoDeixarPassar,
}: {
  quem: string;
  a: Armadilha;
  motivo: "entrou" | "turno";
  aoDisparar: () => void | Promise<void>;
  aoDesarmar: () => void | Promise<void>;
  aoDeixarPassar: () => void;
}) {
  const [rolado, setRolado] = useState<DanoRolado | null>(null);
  const sugestao = sugestaoDaArmadilha(a);
  const perigo = a.tipo === "perigo";
  return (
    <div className="arm-aviso">
      <p className="arm-aviso-titulo">
        <span aria-hidden="true">{perigo ? "☠️" : "⚠️"}</span> <b>{quem}</b> {perigo ? (motivo === "turno" ? "começou o turno em" : "entrou em") : "pisou em"}{" "}
        <b>{nomeDaArmadilha(a)}</b>
      </p>
      {sugestao && <p className="arm-aviso-sugestao">{sugestao}</p>}
      {a.nota && <p className="fc-sub">{a.nota}</p>}
      {rolado && (
        <p className="arm-aviso-dano" role="status">
          🎲 Dano: <b>{rolado.total}</b> <span className="fc-sub">({rolado.conta})</span>
        </p>
      )}
      <div className="mapa-ferr">
        {rolarDanoDoTexto(a.dano) && (
          <button type="button" className="btn" onClick={() => setRolado(rolarDanoDoTexto(a.dano))}>
            🎲 {rolado ? "rolar de novo" : "rolar o dano"}
          </button>
        )}
        <button type="button" className="btn primary" onClick={() => void aoDisparar()}>
          {perigo ? "registrar no log" : "disparar"}
        </button>
        <button type="button" className="btn" onClick={() => void aoDesarmar()}>
          {perigo ? "extinguir" : "desarmar"}
        </button>
        <button type="button" className="btn" onClick={aoDeixarPassar}>
          deixar passar
        </button>
      </div>
    </div>
  );
}
