"use client";

import { useMemo, useState } from "react";
import type { Cenas } from "@/hooks/useCenas";
import type { Marcas } from "@/hooks/useMarcas";
import type { Paredes } from "@/hooks/useParedes";
import type { Pecas } from "@/hooks/usePecas";
import { ControlesDeMarca, ListaDeNotas, resumoDasMarcas } from "@/components/MarcasDoMapa";
import { ControlesDeArea } from "@/components/ControlesDeArea";
import { ImportarParedes } from "@/components/ImportarParedes";
import { BotaoRemover } from "@/components/BotaoRemover";
import { CampoNumero } from "@/components/CampoNumero";
import { CampoTexto } from "@/components/CampoTexto";
import type { ModeloArea } from "@/lib/area";
import type { ModoMarca } from "@/lib/marcas";
import type { ModoRegua } from "@/lib/regua";
import type { PecaNaTela, TamanhoPeca } from "@/lib/pecas";
import { PAREDES_MAXIMAS, cabemParedes, ultimoDesenho, type ModoParede, type NovaParede, type Parede } from "@/lib/paredes";
import { vaosDePorta } from "@/lib/vaos";
import { gradePxParaQuadrados, quadradosNaLargura, type Cena, type ModoNevoa, type TamanhoPincel } from "@/lib/cenas";

/** O que cada ícone da barra abre. São as antigas seções e barras de opções do mapa, uma por ferramenta. */

/** Número com vírgula ou ponto ("1,5"), pros metros por quadrado. */
function CampoMetros({
  valor,
  onCommit,
  aria = "Metros por quadrado",
  maximo = 100,
}: {
  valor: number;
  onCommit: (n: number) => void;
  aria?: string;
  maximo?: number;
}) {
  const [rascunho, setRascunho] = useState(String(valor).replace(".", ","));
  const [focado, setFocado] = useState(false);
  const mostrado = focado ? rascunho : String(valor).replace(".", ",");
  return (
    <input
      className="mapa-num"
      type="text"
      inputMode="decimal"
      aria-label={aria}
      value={mostrado}
      onFocus={() => {
        setRascunho(String(valor).replace(".", ","));
        setFocado(true);
      }}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => {
        setFocado(false);
        const n = Number.parseFloat(rascunho.replace(",", "."));
        if (Number.isFinite(n) && n > 0 && n <= maximo && n !== valor) onCommit(Math.round(n * 100) / 100);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

/** Onde duas paredes quase se encontram na mesma linha, com uma abertura de passagem (`vaosDePorta`), vira porta ABERTA
 *  numa escrita só: nada muda na vista até o Mestre fechar; "↩ desfazer parede" tira todas de uma vez. */
function VaosViramPortas({ cena, paredes, adicionar }: { cena: Cena; paredes: Parede[]; adicionar: (novas: NovaParede[]) => Promise<boolean> }) {
  const vaos = useMemo(() => vaosDePorta(paredes, cena), [paredes, cena]);
  const [ocupado, setOcupado] = useState(false);
  if (vaos.length === 0 || !cabemParedes(paredes.length, vaos.length)) return null;
  return (
    <div className="mapa-ferr">
      <button
        type="button"
        className="btn"
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          await adicionar(vaos);
          setOcupado(false);
        }}
      >
        🚪 marcar {vaos.length} {vaos.length === 1 ? "vão" : "vãos"} como {vaos.length === 1 ? "porta" : "portas"}
      </button>
      <p className="fc-sub">
        Achei {vaos.length} {vaos.length === 1 ? "abertura" : "aberturas"} entre paredes do tamanho de uma passagem. Entram como portas abertas
        (a vista passa); toque numa com Mover pra fechar.
      </p>
    </div>
  );
}

function Escolha<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: T;
  opcoes: readonly (readonly [T, string])[];
  aoMudar: (v: T) => void;
}) {
  return (
    <div className="mapa-ferr" role="group" aria-label={rotulo}>
      {opcoes.map(([v, texto]) => (
        <button key={v} type="button" className="chip alvo" aria-pressed={valor === v} onClick={() => aoMudar(v)}>
          {texto}
        </button>
      ))}
    </div>
  );
}

export function PainelNevoa({
  forma,
  aoMudarForma,
  podeQuadradinhos,
  modo,
  aoMudarModo,
  pincel,
  aoMudarPincel,
  temRegras,
  aoDesfazer,
  aoRevelarTudo,
  aoCobrirTudo,
}: {
  forma: "pincel" | "retangulo" | "quadradinhos";
  aoMudarForma: (f: "pincel" | "retangulo" | "quadradinhos") => void;
  podeQuadradinhos: boolean;
  modo: ModoNevoa;
  aoMudarModo: (m: ModoNevoa) => void;
  pincel: TamanhoPincel;
  aoMudarPincel: (t: TamanhoPincel) => void;
  temRegras: boolean;
  aoDesfazer: () => void;
  aoRevelarTudo: () => void;
  aoCobrirTudo: () => void;
}) {
  const formas: [typeof forma, string][] = [
    ["pincel", "Pincel"],
    ["retangulo", "Retângulo"],
  ];
  if (podeQuadradinhos) formas.push(["quadradinhos", "Quadradinhos"]);
  return (
    <>
      <Escolha rotulo="Forma da névoa" valor={forma} opcoes={formas} aoMudar={aoMudarForma} />
      <div className="mapa-ferr" role="group" aria-label="Opções da névoa">
        <button type="button" className="chip alvo" aria-pressed={modo === "revelar"} onClick={() => aoMudarModo("revelar")}>
          Revelar
        </button>
        <button type="button" className="chip alvo" aria-pressed={modo === "esconder"} onClick={() => aoMudarModo("esconder")}>
          Esconder
        </button>
        {forma === "pincel" &&
          (["p", "m", "g"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className="chip alvo"
              aria-pressed={pincel === t}
              aria-label={`Pincel ${t === "p" ? "pequeno" : t === "m" ? "médio" : "grande"}`}
              onClick={() => aoMudarPincel(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
      </div>
      <div className="mapa-ferr">
        <button type="button" className="btn" disabled={!temRegras} onClick={aoDesfazer}>
          ↩ desfazer
        </button>
        <button type="button" className="btn" onClick={aoRevelarTudo}>
          revelar tudo
        </button>
        <button type="button" className="btn" onClick={aoCobrirTudo}>
          cobrir tudo
        </button>
      </div>
    </>
  );
}

export function PainelMedir({
  oQue,
  aoMudarOQue,
  modoRegua,
  aoMudarRegua,
  modeloArea,
  aoMudarArea,
  metrosPorQuadrado,
}: {
  oQue: "regua" | "area";
  aoMudarOQue: (v: "regua" | "area") => void;
  modoRegua: ModoRegua;
  aoMudarRegua: (m: ModoRegua) => void;
  modeloArea: ModeloArea;
  aoMudarArea: (m: ModeloArea) => void;
  metrosPorQuadrado: number;
}) {
  return (
    <>
      <Escolha
        rotulo="O que medir"
        valor={oQue}
        opcoes={[
          ["regua", "Régua"],
          ["area", "Área de magia"],
        ]}
        aoMudar={aoMudarOQue}
      />
      {oQue === "regua" ? (
        <div className="mapa-ferr" role="group" aria-label="Como medir">
          <button type="button" className="chip alvo" aria-pressed={modoRegua === "grade"} onClick={() => aoMudarRegua("grade")}>
            na grade
          </button>
          <button type="button" className="chip alvo" aria-pressed={modoRegua === "reta"} onClick={() => aoMudarRegua("reta")}>
            em linha reta
          </button>
        </div>
      ) : (
        <ControlesDeArea modelo={modeloArea} aoMudar={aoMudarArea} metrosPorQuadrado={metrosPorQuadrado} />
      )}
    </>
  );
}

export function PainelDesenhos({
  desenhos,
  modo,
  aoMudarModo,
  cor,
  aoMudarCor,
  paraMesa,
  aoMudarParaMesa,
  movendoNota,
  aoMoverNota,
}: {
  desenhos: Marcas;
  modo: ModoMarca;
  aoMudarModo: (m: ModoMarca) => void;
  cor: string;
  aoMudarCor: (c: string) => void;
  paraMesa: boolean;
  aoMudarParaMesa: (v: boolean) => void;
  movendoNota: string | null;
  aoMoverNota: (id: string | null) => void;
}) {
  if (desenhos.indisponivel) {
    return (
      <p className="fc-sub">
        Falta rodar a migration 0022_marcas.sql no SQL Editor do Supabase pra ligar os desenhos e as notas. O resto do mapa funciona sem eles.
      </p>
    );
  }
  return (
    <>
      <ControlesDeMarca modo={modo} aoMudarModo={aoMudarModo} cor={cor} aoMudarCor={aoMudarCor} paraMesa={paraMesa} aoMudarParaMesa={aoMudarParaMesa} />
      <p className="fc-sub">
        {resumoDasMarcas(desenhos.marcas)}. O que está em 🔒 só eu vejo aparece tracejado pra você e não aparece pra mesa, nem no telão.
      </p>
      <ListaDeNotas marcas={desenhos.marcas} edicao={desenhos} movendoId={movendoNota} aoMover={aoMoverNota} />
      <div className="mapa-ferr">
        <button
          type="button"
          className="btn"
          disabled={desenhos.marcas.length === 0}
          onClick={() => {
            const ultima = [...desenhos.marcas].reverse().find((m) => m.created_at !== "");
            if (ultima) void desenhos.remover(ultima.id);
          }}
        >
          ↩ desfazer a última
        </button>
        <button
          type="button"
          className="btn"
          disabled={desenhos.marcas.length === 0}
          onClick={() => {
            if (confirm("Apagar todos os desenhos e notas deste mapa?")) void desenhos.removerTodas();
          }}
        >
          apagar tudo
        </button>
      </div>
    </>
  );
}

export function PainelPecas({
  banco,
  pecas,
  pecaSelecionada,
  aoSelecionar,
  aoAbrirCartao,
  colocando,
  aoColocando,
  juntos,
  aoJuntos,
  temCompanheiros,
  aoPorGrupo,
  aoPorInimigos,
  aoPorMarcador,
}: {
  banco: Pecas;
  pecas: PecaNaTela[];
  pecaSelecionada: string | null;
  aoSelecionar: (id: string | null) => void;
  aoAbrirCartao: (id: string | null) => void;
  colocando: "grupo" | "inimigos" | null;
  aoColocando: (v: "grupo" | "inimigos" | null) => void;
  juntos: boolean;
  aoJuntos: (v: boolean) => void;
  temCompanheiros: boolean;
  aoPorGrupo: () => void;
  aoPorInimigos: () => void;
  aoPorMarcador: (nome: string) => void;
}) {
  const [nomeMarcador, setNomeMarcador] = useState("");
  function porMarcador() {
    aoPorMarcador(nomeMarcador);
    setNomeMarcador("");
  }
  function proximoTamanho(t: TamanhoPeca): TamanhoPeca {
    return (t >= 3 ? 1 : t + 1) as TamanhoPeca;
  }
  if (banco.indisponivel) {
    return (
      <p className="fc-sub">
        Falta rodar a migration 0019_pecas.sql no SQL Editor do Supabase pra ligar os peões. O resto do mapa funciona sem eles.
      </p>
    );
  }
  return (
    <>
      <div className="mapa-ferr">
        <button type="button" className="btn" onClick={aoPorGrupo}>
          pôr o grupo no mapa
        </button>
        <button type="button" className="btn" onClick={aoPorInimigos}>
          pôr os inimigos da iniciativa
        </button>
      </div>
      <div className="mapa-ferr" role="group" aria-label="Escolher onde entram">
        <button type="button" className="chip alvo" aria-pressed={colocando === "grupo"} onClick={() => aoColocando(colocando === "grupo" ? null : "grupo")}>
          grupo onde eu tocar
        </button>
        <button type="button" className="chip alvo" aria-pressed={colocando === "inimigos"} onClick={() => aoColocando(colocando === "inimigos" ? null : "inimigos")}>
          inimigos onde eu tocar
        </button>
      </div>
      {temCompanheiros && (
        <div className="mapa-ferr">
          <button type="button" className="chip alvo" aria-pressed={juntos} onClick={() => aoJuntos(!juntos)}>
            🐾 companheiros junto
          </button>
        </div>
      )}
      <div className="mapa-linha">
        <input
          className="campotexto"
          value={nomeMarcador}
          maxLength={30}
          placeholder="nome do marcador"
          aria-label="Nome do marcador avulso"
          onChange={(e) => setNomeMarcador(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") porMarcador();
          }}
        />
        <button type="button" className="btn" onClick={porMarcador}>
          + marcador
        </button>
      </div>
      <div className="mapa-pecas">
        {banco.pecas.map((p) => {
          const naTela = pecas.find((x) => x.id === p.id);
          return (
            <div key={p.id} className={`mapa-peca${p.id === pecaSelecionada ? " sel" : ""}`}>
              <button
                type="button"
                className="mapa-peca-nome"
                onClick={() => {
                  const escolher = p.id !== pecaSelecionada;
                  aoSelecionar(escolher ? p.id : null);
                  aoAbrirCartao(escolher ? p.id : null);
                }}
              >
                <span className="mapa-cor" style={{ background: naTela?.cor }} aria-hidden="true" />
                {naTela?.nome ?? p.nome}
                {naTela?.vez ? " · vez" : ""}
              </button>
              <button
                type="button"
                className="chip alvo"
                aria-pressed={p.oculto}
                aria-label={`${p.oculto ? "Mostrar" : "Ocultar"} o peão ${naTela?.nome ?? p.nome} pra mesa`}
                onClick={() => void banco.atualizar(p.id, { oculto: !p.oculto })}
              >
                {p.oculto ? "oculto" : "visível"}
              </button>
              <button
                type="button"
                className="chip"
                aria-label={`Tamanho do peão ${naTela?.nome ?? p.nome}: ${p.tamanho}. Tocar muda.`}
                onClick={() => void banco.atualizar(p.id, { tamanho: proximoTamanho(p.tamanho) })}
              >
                tam {p.tamanho}
              </button>
              <BotaoRemover
                aria={`tirar o peão ${naTela?.nome ?? p.nome} do mapa`}
                onConfirmar={() => {
                  if (pecaSelecionada === p.id) aoSelecionar(null);
                  void banco.remover(p.id);
                }}
              />
            </div>
          );
        })}
      </div>
      {banco.pecas.length > 0 && (
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (confirm("Tirar todos os peões deste mapa?")) {
              aoSelecionar(null);
              void banco.removerTodas();
            }
          }}
        >
          tirar todos os peões
        </button>
      )}
    </>
  );
}

export function PainelParedes({
  cena,
  cenas,
  muros,
  modoParede,
  aoMudarModoParede,
  verInimigos,
  aoVerInimigos,
  aoCobrirExplorado,
}: {
  cena: Cena;
  cenas: Cenas;
  muros: Paredes;
  modoParede: ModoParede;
  aoMudarModoParede: (m: ModoParede) => void;
  verInimigos: boolean;
  aoVerInimigos: (v: boolean) => void;
  aoCobrirExplorado: () => void;
}) {
  if (muros.indisponivel) {
    return (
      <p className="fc-sub">
        Falta rodar a migration 0021_paredes.sql no SQL Editor do Supabase pra ligar as paredes e a visão automática. O resto do mapa funciona sem elas.
      </p>
    );
  }
  return (
    <>
      <div className="mapa-ferr" role="group" aria-label="O que desenhar">
        {([["parede", "parede"], ["curva", "curva"], ["porta", "porta"], ["comodo", "cômodo"], ["apagar", "apagar"]] as const).map(([modo, rotulo]) => (
          <button key={modo} type="button" className="chip alvo" aria-pressed={modoParede === modo} onClick={() => aoMudarModoParede(modo)}>
            {rotulo}
          </button>
        ))}
      </div>
      <p className="fc-sub">
        {muros.paredes.filter((w) => w.tipo === "parede").length} paredes · {muros.paredes.filter((w) => w.tipo === "porta").length} portas (cabem{" "}
        {PAREDES_MAXIMAS}). Os jogadores nunca veem as paredes: elas só seguram o peão deles e decidem até onde a visão alcança.
      </p>
      <label className="checklabel">
        <input type="checkbox" checked={cena.visao_ligada} onChange={(e) => void cenas.atualizarCena(cena.id, { visao_ligada: e.target.checked })} />
        visão automática: a névoa se abre sozinha pelo que os jogadores enxergam
      </label>
      {cena.visao_ligada && (
        <>
          <label className="checklabel">
            <input
              type="checkbox"
              checked={cena.visao_alcance !== null}
              onChange={(e) => void cenas.atualizarCena(cena.id, { visao_alcance: e.target.checked ? 18 : null })}
            />
            limitar o alcance da visão
          </label>
          {cena.visao_alcance !== null && (
            <div className="mapa-grade">
              <label>
                alcance (metros)
                <CampoMetros
                  aria="Alcance da visão, em metros"
                  maximo={1000}
                  valor={cena.visao_alcance}
                  onCommit={(n) => void cenas.atualizarCena(cena.id, { visao_alcance: n })}
                />
              </label>
            </div>
          )}
          <label className="checklabel">
            <input type="checkbox" checked={verInimigos} onChange={(e) => aoVerInimigos(e.target.checked)} />
            ver o que os inimigos enxergam (só você vê, em vermelho)
          </label>
          {!cena.nevoa_ligada && <p className="fc-sub">A cena não começa coberta de névoa (veja o ícone da grade), então não há o que a visão abrir.</p>}
        </>
      )}
      {muros.aviso && (
        <p className="mapa-erro" role="alert">
          {muros.aviso}
        </p>
      )}
      <div className="mapa-ferr">
        <button
          type="button"
          className="btn"
          disabled={muros.paredes.length === 0}
          onClick={() => {
            // O último desenho inteiro: a curva toda, o cômodo todo (ou a parede, se foi uma só).
            const ultimas = ultimoDesenho(muros.paredes);
            if (ultimas.length > 0) void muros.removerVarias(ultimas.map((p) => p.id));
          }}
        >
          ↩ desfazer parede
        </button>
        <button
          type="button"
          className="btn"
          disabled={muros.paredes.length === 0}
          onClick={() => {
            if (confirm("Apagar todas as paredes e portas deste mapa?")) void muros.removerTodas();
          }}
        >
          apagar todas
        </button>
        {cena.visao_ligada && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (confirm("Cobrir de novo tudo que o grupo já explorou neste mapa?")) aoCobrirExplorado();
            }}
          >
            cobrir de novo o explorado
          </button>
        )}
      </div>
      <VaosViramPortas cena={cena} paredes={muros.paredes} adicionar={muros.adicionar} />
      <ImportarParedes cena={cena} urlDaImagem={cenas.urlDaImagem(cena)} paredes={muros.paredes} adicionar={muros.adicionar} />
    </>
  );
}

/** "Esta cena": nome, grade e se ela começa coberta de névoa (as antigas seções "Grade e névoa" e o campo de nome). */
export function PainelCena({ cena, cenas }: { cena: Cena; cenas: Cenas }) {
  return (
    <>
      <div className="mapa-linha">
        <CampoTexto valor={cena.nome} maxLength={60} placeholder="nome da cena" onCommit={(v) => void cenas.atualizarCena(cena.id, { nome: v })} />
        <BotaoRemover
          aria={`apagar a cena ${cena.nome || "sem nome"}`}
          confirmar={`Apagar a cena "${cena.nome || "sem nome"}"? A imagem e a névoa dela são apagadas de vez.`}
          onConfirmar={() => void cenas.apagarCena(cena.id)}
        />
      </div>
      <label className="checklabel">
        <input type="checkbox" checked={cena.grade_ligada} onChange={(e) => void cenas.atualizarCena(cena.id, { grade_ligada: e.target.checked })} />
        mostrar a grade (os quadradinhos)
      </label>
      {cena.grade_ligada && (
        <div className="mapa-grade">
          <label>
            quadrados na largura
            <CampoNumero
              className="mapa-num"
              valor={Math.round(quadradosNaLargura(cena))}
              onCommit={(n) => {
                if (n >= 1 && n <= 300) void cenas.atualizarCena(cena.id, { grade_px: gradePxParaQuadrados(cena.largura, n) });
              }}
            />
          </label>
          <label>
            começa em x
            <CampoNumero
              className="mapa-num"
              valor={Math.round(cena.grade_dx)}
              onCommit={(n) => void cenas.atualizarCena(cena.id, { grade_dx: Math.max(0, Math.min(n, Math.round(cena.grade_px))) })}
            />
          </label>
          <label>
            começa em y
            <CampoNumero
              className="mapa-num"
              valor={Math.round(cena.grade_dy)}
              onCommit={(n) => void cenas.atualizarCena(cena.id, { grade_dy: Math.max(0, Math.min(n, Math.round(cena.grade_px))) })}
            />
          </label>
          <label>
            metros por quadrado
            <CampoMetros valor={cena.metros} onCommit={(n) => void cenas.atualizarCena(cena.id, { metros: n })} />
          </label>
        </div>
      )}
      <p className="fc-sub">
        Conte quantos quadradinhos cabem na largura do mapa e digite acima; “começa em x/y” (em pixels) alinha a grade com a do desenho. A névoa que você já
        fez não se mexe se ajustar depois.
      </p>
      <label className="checklabel">
        <input type="checkbox" checked={cena.nevoa_ligada} onChange={(e) => void cenas.atualizarCena(cena.id, { nevoa_ligada: e.target.checked })} />a cena começa coberta de névoa
      </label>
    </>
  );
}

/** "A mesa": o que a mesa está vendo e pra onde o telão e os celulares olham. */
export function PainelMesa({
  cena,
  cenas,
  aoLevarCamera,
  aoVerTudo,
}: {
  cena: Cena;
  cenas: Cenas;
  aoLevarCamera: (tudo: boolean) => void;
  aoVerTudo: () => void;
}) {
  return (
    <>
      <div className="mapa-mesa">
        {cena.na_mesa ? (
          <>
            <span className="mapa-mesa-ok">✓ A mesa está vendo este mapa</span>
            <button type="button" className="btn" onClick={() => void cenas.mandarParaMesa(null)}>
              tirar o mapa da mesa
            </button>
          </>
        ) : (
          <span className="fc-sub">A mesa ainda não está vendo este mapa. O botão de levar fica no topo, ao lado de Preparar e Jogar.</span>
        )}
      </div>
      <p className="fc-sub">O telão e os celulares abrem enquadrados no pedaço que você escolher aqui (os jogadores podem dar zoom por conta própria).</p>
      <div className="mapa-ferr">
        <button type="button" className="btn" onClick={() => aoLevarCamera(false)}>
          levar a mesa pra esta visão
        </button>
        <button type="button" className="btn" onClick={() => aoLevarCamera(true)}>
          mesa vê o mapa todo
        </button>
        <button type="button" className="btn" onClick={aoVerTudo}>
          ver o mapa todo (só eu)
        </button>
      </div>
      <p className="fc-sub">{cena.camera ? "A mesa está enquadrada num pedaço do mapa." : "A mesa vê o mapa todo."}</p>
    </>
  );
}
