"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { ModeloNpc, NovoModeloNpc } from "@/lib/tipos";
import { CampoNumero } from "@/components/CampoNumero";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";
import { MONSTROS_SRD, buscarMonstros } from "@/lib/monstrosSrd";

/** Prep de mesa: NPCs/monstros que podem aparecer ou não, com ficha básica e
 *  notas de tática, prontos pra puxar no rastreador de combate quando
 *  entrarem em cena de verdade. Só o Mestre vê. */
export function BibliotecaNpcs({ sala }: { sala: Sala }) {
  return (
    <div className="combat">
      <div className="combat-head">
        <h2>Biblioteca de NPCs</h2>
      </div>

      {sala.modelosNpc.length === 0 && (
        <p className="empty-note">
          Nenhum NPC preparado ainda — cadastre abaixo, ou use um do catálogo.
        </p>
      )}

      <div className="npclib">
        {sala.modelosNpc.map((m) => (
          <LinhaModelo key={m.id} modelo={m} sala={sala} />
        ))}
      </div>

      <FormNovoModelo sala={sala} />

      <CatalogoSrd sala={sala} />
    </div>
  );
}

function CatalogoSrd({ sala }: { sala: Sala }) {
  const [busca, setBusca] = useState("");
  const [verTodos, setVerTodos] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; falhou: boolean } | null>(null);

  const procurando = busca.trim().length > 0;
  const achados = procurando ? buscarMonstros(busca) : verTodos ? MONSTROS_SRD : [];

  async function copiar(m: Required<NovoModeloNpc>) {
    const deuCerto = await sala.criarModeloNpc(m);
    setAviso(
      deuCerto
        ? { texto: `✓ ${m.name} copiado pra sua biblioteca, lá em cima.`, falhou: false }
        : { texto: `Não deu pra copiar ${m.name}. Confira a conexão e toque de novo.`, falhou: true },
    );
  }

  return (
    <div className="npccatalogo">
      <span className="sectitle">
        Catálogo D&amp;D (SRD 5.2) — busque e toque pra copiar pra sua biblioteca
      </span>

      <div className="catbusca">
        <input
          type="search"
          aria-label="Buscar monstro no catálogo do SRD"
          placeholder={`buscar entre ${MONSTROS_SRD.length} monstros (ex.: goblin, morto-vivo)…`}
          value={busca}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button type="button" className="btn" onClick={() => setVerTodos(!verTodos)}>
          {verTodos ? "esconder lista" : `ver todos (${MONSTROS_SRD.length})`}
        </button>
      </div>

      <p className={aviso?.falhou ? "catcopiado falhou" : "catcopiado"} aria-live="polite">
        {aviso ? aviso.texto : ""}
      </p>

      {procurando && achados.length === 0 ? (
        <p className="empty-note">Nenhum monstro com esse nome no catálogo.</p>
      ) : null}

      <div className="catresultados">
        {achados.map((m) => (
          <button key={m.name} type="button" className="catitem" onClick={() => copiar(m)}>
            <span className="catnome">{m.name}</span>
            <span className="catstats">
              CA {m.ac} · {m.hp_max} PV · {m.speed}m · inic. {m.init_mod >= 0 ? "+" : ""}
              {m.init_mod} · {m.cls}
            </span>
            {m.notes ? <span className="catnota">{m.notes}</span> : null}
          </button>
        ))}
      </div>

      <p className="fine">
        Números de partida do SRD 5.2 (licença CC-BY-4.0, Wizards of the Coast) — confira contra
        o livro antes de uma luta importante; depois de copiado é só editar à vontade.
      </p>
    </div>
  );
}

function LinhaModelo({ modelo: m, sala }: { modelo: ModeloNpc; sala: Sala }) {
  const patch = (mudanca: Partial<ModeloNpc>) => sala.atualizarModeloNpc(m.id, mudanca);

  return (
    <div className="npclibrow">
      <div className="npclibhead">
        <CampoTexto valor={m.name} maxLength={40} placeholder="nome" onCommit={(v) => patch({ name: v })} />
        <button
          type="button"
          className="rm"
          aria-label={`remover ${m.name} da biblioteca`}
          onClick={() => {
            if (confirm(`Remover "${m.name}" da biblioteca?`)) sala.removerModeloNpc(m.id);
          }}
        >
          ✕
        </button>
      </div>
      <div className="npclibstats">
        <label>
          classe/tipo
          <CampoTexto valor={m.cls} maxLength={60} placeholder="ex.: morto-vivo médio" onCommit={(v) => patch({ cls: v })} />
        </label>
        <label>
          PV
          <CampoNumero className="campnum" valor={m.hp_max} onCommit={(n) => patch({ hp_max: Math.max(0, n) })} />
        </label>
        <label>
          CA
          <CampoNumero className="campnum" valor={m.ac} onCommit={(n) => patch({ ac: Math.max(0, n) })} />
        </label>
        <label>
          desl. (m)
          <CampoNumero className="campnum" valor={m.speed} onCommit={(n) => patch({ speed: Math.max(0, n) })} />
        </label>
        <label>
          iniciativa
          <CampoNumero className="campnum" valor={m.init_mod} onCommit={(n) => patch({ init_mod: n })} />
        </label>
      </div>
      <div className="notesbox">
        <CampoTextoAdiado
          valor={m.notes}
          maxLength={500}
          onSalvar={(texto) => patch({ notes: texto })}
          placeholder="tática, resistências, gatilho de fuga…"
        />
      </div>
    </div>
  );
}

function FormNovoModelo({ sala }: { sala: Sala }) {
  const [nome, setNome] = useState("");
  const [cls, setCls] = useState("");
  const [pv, setPv] = useState("");
  const [ca, setCa] = useState("");
  const [desl, setDesl] = useState("");
  const [ini, setIni] = useState("");
  const [notas, setNotas] = useState("");

  function adicionar() {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return;
    sala.criarModeloNpc({
      name: nomeLimpo,
      cls: cls.trim(),
      hp_max: Number.parseInt(pv, 10) || 10,
      ac: Number.parseInt(ca, 10) || 12,
      speed: Number.parseInt(desl, 10) || 9,
      init_mod: Number.parseInt(ini, 10) || 0,
      notes: notas.trim(),
    });
    setNome("");
    setCls("");
    setPv("");
    setCa("");
    setDesl("");
    setIni("");
    setNotas("");
  }

  return (
    <div className="npclibform">
      <div className="addcombatant">
        <input
          type="text"
          placeholder="nome do NPC/monstro"
          maxLength={40}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <input
          type="text"
          placeholder="classe/tipo (opcional)"
          maxLength={60}
          value={cls}
          onChange={(e) => setCls(e.target.value)}
        />
        <input
          className="num"
          type="number"
          inputMode="numeric"
          placeholder="PV máx"
          value={pv}
          onChange={(e) => setPv(e.target.value)}
        />
        <input
          className="num"
          type="number"
          inputMode="numeric"
          placeholder="CA"
          value={ca}
          onChange={(e) => setCa(e.target.value)}
        />
        <input
          className="num"
          type="number"
          inputMode="numeric"
          placeholder="desl. (m)"
          value={desl}
          onChange={(e) => setDesl(e.target.value)}
        />
        <input
          className="num"
          type="number"
          inputMode="numeric"
          placeholder="iniciativa"
          value={ini}
          onChange={(e) => setIni(e.target.value)}
        />
      </div>
      <div className="notesbox">
        <textarea
          placeholder="tática, resistências, gatilho de fuga… (opcional)"
          maxLength={500}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>
      <button type="button" className="btn" disabled={!nome.trim()} onClick={adicionar}>
        + adicionar à biblioteca
      </button>
    </div>
  );
}
