"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { ModeloNpc } from "@/lib/tipos";
import { CampoNumero } from "@/components/CampoNumero";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoTextoAdiado } from "@/components/CampoTextoAdiado";
import { BotaoRemover } from "@/components/BotaoRemover";
import { useCatalogoMonstros } from "@/hooks/useCatalogoMonstros";
import type { MonstroCatalogo } from "@/lib/monstrosSrd";
import { FichaClassicaMonstro } from "@/components/FichaClassicaMonstro";

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

/** Acima disso a busca mostra a linha compacta (ver `detalhado`). */
const MAX_DETALHADOS = 8;

function CatalogoSrd({ sala }: { sala: Sala }) {
  const { catalogo, falhou, tentarDeNovo } = useCatalogoMonstros();
  const [busca, setBusca] = useState("");
  // Faixa de ND aberta no "ver todos" (índice em FAIXAS_ND); null = fechado.
  // São 331 monstros: a lista inteira de uma vez dava metros de rolagem.
  const [faixa, setFaixa] = useState<number | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; falhou: boolean } | null>(null);
  // Monstro com a ficha clássica aberta (nome do livro); um por vez.
  const [fichaAberta, setFichaAberta] = useState<string | null>(null);

  const procurando = busca.trim().length > 0;
  const achados = !catalogo
    ? []
    : procurando
      ? catalogo.buscarMonstros(busca)
      : faixa !== null
        ? catalogo.monstrosDaFaixa(catalogo.FAIXAS_ND[faixa])
        : [];

  // Ataque e notas só quando a lista é curta: "ver todos" e busca larga
  // ("fera" = 91) ficam na linha compacta (~50px em vez de ~125px).
  const detalhado = procurando && achados.length <= MAX_DETALHADOS;

  async function copiar(m: MonstroCatalogo): Promise<boolean> {
    // Nome do livro (inglês) é o que fica pro personagem — só a classe/tipo,
    // as notas e o resto continuam em português (pedido do Daniel, 30/09/2026:
    // "Ursopar" não agradou, ele quer "Owlbear" mesmo).
    const deuCerto = await sala.criarModeloNpc({ ...m, name: m.en });
    setAviso(
      deuCerto
        ? { texto: `✓ ${m.en} copiado pra sua biblioteca, lá em cima.`, falhou: false }
        : { texto: `Não deu pra copiar ${m.en}. Confira a conexão e toque de novo.`, falhou: true },
    );
    return deuCerto;
  }

  return (
    <div className="npccatalogo">
      <span className="sectitle">
        Catálogo D&amp;D (SRD 5.2) — busque e toque pra copiar pra sua biblioteca
      </span>

      <div className="catbusca">
        <input
          type="search"
          aria-label="Buscar monstro no catálogo do SRD: nome, tipo, nome em inglês ou nd 2"
          placeholder="ex.: goblin, morto-vivo, nd 2"
          value={busca}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button type="button" className="btn" disabled={!catalogo} onClick={() => setFaixa(faixa === null ? 0 : null)}>
          {faixa !== null ? "esconder lista" : `ver todos${catalogo ? ` (${catalogo.MONSTROS_SRD.length})` : ""}`}
        </button>
      </div>

      {falhou && (
        <p className="catcopiado falhou">
          Não deu pra carregar o catálogo — sem internet?{" "}
          <button type="button" className="linkbtn" onClick={tentarDeNovo}>
            tentar de novo
          </button>
        </p>
      )}

      {catalogo && faixa !== null && !procurando && (
        <div className="chips" role="group" aria-label="Nível de desafio">
          {catalogo.FAIXAS_ND.map((f, i) => (
            <button key={f.rotulo} type="button" className="chip" aria-pressed={i === faixa} onClick={() => setFaixa(i)}>
              ND {f.rotulo} ({catalogo.monstrosDaFaixa(f).length})
            </button>
          ))}
        </div>
      )}

      <p className={aviso?.falhou ? "catcopiado falhou" : "catcopiado"} aria-live="polite">
        {aviso ? aviso.texto : ""}
      </p>

      {procurando && achados.length === 0 ? (
        <p className="empty-note">Nenhum monstro com esse nome no catálogo.</p>
      ) : null}

      {achados.length > 0 && !detalhado && (
        <p className="empty-note">
          {procurando
            ? `${achados.length} monstros — refine a busca (ex.: "dragão vermelho") pra ver ataques e notas.`
            : "Toque pra copiar. Buscando pelo nome aparecem os ataques e as notas."}
        </p>
      )}

      <div className="catresultados">
        {achados.map((m) => (
          <div key={m.name} className="catgrupo">
            <div className="catentrada">
              <button type="button" className="catitem" onClick={() => copiar(m)}>
                <span className="catnome">
                  {m.en}
                  {m.en !== m.name && <span className="caten"> · {m.name}</span>}
                </span>
                <span className="catstats">
                  ND {catalogo?.ndTexto(m.nd)} · CA {m.ac} · {m.hp_max} PV · {m.speed}m · inic.{" "}
                  {m.init_mod >= 0 ? "+" : ""}
                  {m.init_mod} · {m.cls}
                </span>
                {detalhado && m.ataque ? <span className="catataque">⚔ {m.ataque}</span> : null}
                {detalhado && m.notes ? <span className="catnota">{m.notes}</span> : null}
              </button>
              <button
                type="button"
                className="catficha"
                aria-expanded={fichaAberta === m.en}
                aria-label={`${fichaAberta === m.en ? "Fechar" : "Ver"} a ficha de ${m.en}`}
                onClick={() => setFichaAberta(fichaAberta === m.en ? null : m.en)}
              >
                {fichaAberta === m.en ? "fechar" : "ficha"}
              </button>
            </div>
            {fichaAberta === m.en && catalogo ? (
              <FichaClassicaMonstro monstro={m} nd={catalogo.ndTexto(m.nd)} onCopiar={() => copiar(m)} />
            ) : null}
          </div>
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
        <BotaoRemover
          aria={`remover ${m.name} da biblioteca`}
          confirmar={`Remover "${m.name}" da biblioteca?`}
          onConfirmar={() => sala.removerModeloNpc(m.id)}
        />
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
      <div className="npclibataque">
        <span className="sectitle">Ataque</span>
        <div className="notesbox">
          <CampoTextoAdiado
            valor={m.ataque}
            maxLength={200}
            onSalvar={(texto) => patch({ ataque: texto })}
            placeholder="ex.: Cimitarra +4, 1d6+2 cortante"
          />
        </div>
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
  const [ataque, setAtaque] = useState("");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; falhou: boolean } | null>(null);

  // `|| padrao` trocaria um 0 digitado de propósito (ex.: deslocamento 0 de
  // um limo ou objeto animado) pelo padrão, porque 0 é falsy em JS.
  function numOu(texto: string, padrao: number): number {
    const n = Number.parseInt(texto, 10);
    return Number.isNaN(n) ? padrao : n;
  }

  async function adicionar() {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo || enviando) return;
    setEnviando(true);
    const deuCerto = await sala.criarModeloNpc({
      name: nomeLimpo,
      cls: cls.trim(),
      hp_max: numOu(pv, 10),
      ac: numOu(ca, 12),
      speed: numOu(desl, 9),
      init_mod: numOu(ini, 0),
      ataque: ataque.trim(),
      notes: notas.trim(),
    });
    setEnviando(false);
    if (!deuCerto) {
      // Não limpa o formulário: a escrita falhou, o Mestre não perde o que digitou.
      setAviso({ texto: "Não deu pra salvar. Confira a conexão e toque em adicionar de novo.", falhou: true });
      return;
    }
    setAviso(null);
    setNome("");
    setCls("");
    setPv("");
    setCa("");
    setDesl("");
    setIni("");
    setAtaque("");
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
        <input
          type="text"
          placeholder="ataque (ex.: Cimitarra +4, 1d6+2)"
          maxLength={200}
          value={ataque}
          onChange={(e) => setAtaque(e.target.value)}
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
      <p className={aviso?.falhou ? "catcopiado falhou" : "catcopiado"} aria-live="polite">
        {aviso ? aviso.texto : ""}
      </p>

      <button type="button" className="btn" disabled={!nome.trim() || enviando} onClick={adicionar}>
        {enviando ? "salvando…" : "+ adicionar à biblioteca"}
      </button>
    </div>
  );
}
