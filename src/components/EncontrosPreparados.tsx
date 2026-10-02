"use client";

import { useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { Encontro, FichaMonstro, GrupoEncontro, ItemIniciativa } from "@/lib/tipos";
import { d20 } from "@/lib/dados";
import { FichaClassicaMonstro, dadosDoMonstro } from "@/components/FichaClassicaMonstro";
import { useCatalogoMonstros } from "@/hooks/useCatalogoMonstros";
import { textoDesfeito } from "@/lib/desfazer";
import type { Cena } from "@/lib/cenas";
import { porPecasDosQueEntram } from "@/lib/pecasNoBanco";
import {
  adicionarAoEncontro,
  entrarNaOrdem,
  fichaDeMonstro,
  limitarQuantidade,
  npcsDoEncontro,
  QUANTIDADE_MAX_GRUPO,
  resumoEncontro,
  totalDoEncontro,
} from "@/lib/regras";
import { CampoTexto } from "@/components/CampoTexto";
import { BotaoRemover } from "@/components/BotaoRemover";

function contarMonstros(n: number): string {
  return n === 1 ? "1 monstro" : `${n} monstros`;
}

/** Aba Mestre: montar grupos inimigos antes da sessão, pra na hora da luta
 *  ser um toque só (ver `ComecarEncontro`, na aba Combate). Só o Mestre vê. */
export function EncontrosPreparados({ sala }: { sala: Sala }) {
  return (
    <div className="combat">
      <div className="combat-head">
        <h2>Encontros preparados</h2>
      </div>

      {sala.encontros.length === 0 && (
        <p className="empty-note">
          Nenhum encontro ainda — monte o grupo inimigo antes da sessão e, na hora da luta, é um
          toque na aba Combate pra pôr todos na iniciativa.
        </p>
      )}

      <div className="npclib">
        {sala.encontros.map((e) => (
          <CartaoEncontro key={e.id} encontro={e} sala={sala} />
        ))}
      </div>

      <FormNovoEncontro sala={sala} />
    </div>
  );
}

function FormNovoEncontro({ sala }: { sala: Sala }) {
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function criar() {
    const limpo = nome.trim();
    if (!limpo || enviando) return;
    setEnviando(true);
    const criado = await sala.criarEncontro(limpo);
    setEnviando(false);
    // Falhou: o aviso já aparece no topo e o nome digitado continua aqui.
    if (criado) setNome("");
  }

  return (
    <div className="addcombatant">
      <input
        type="text"
        placeholder="nome do encontro (ex.: Emboscada)"
        maxLength={60}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") criar();
        }}
      />
      <button type="button" className="btn" disabled={!nome.trim() || enviando} onClick={criar}>
        {enviando ? "criando…" : "+ novo encontro"}
      </button>
    </div>
  );
}

function CartaoEncontro({ encontro: e, sala }: { encontro: Encontro; sala: Sala }) {
  // Encontro recém-criado (vazio) já abre pronto pra receber monstro.
  const [adicionando, setAdicionando] = useState(e.grupos.length === 0);
  const [aviso, setAviso] = useState("");
  const total = totalDoEncontro(e.grupos);

  function salvarGrupos(grupos: GrupoEncontro[]) {
    sala.atualizarEncontro(e.id, { grupos });
  }

  function adicionar(ficha: FichaMonstro) {
    const grupos = adicionarAoEncontro(e.grupos, ficha);
    salvarGrupos(grupos);
    const grupo = grupos.find((g) => g.name.trim().toLowerCase() === ficha.name.trim().toLowerCase());
    setAviso(`✓ ${ficha.name} — agora ${grupo?.quantidade ?? 1}× no encontro`);
  }

  function mudarQuantidade(i: number, delta: number) {
    salvarGrupos(e.grupos.map((g, idx) => (idx === i ? { ...g, quantidade: limitarQuantidade(g.quantidade + delta) } : g)));
  }

  function tirarGrupo(i: number) {
    salvarGrupos(e.grupos.filter((_, idx) => idx !== i));
  }

  return (
    <div className="npclibrow">
      <div className="npclibhead">
        <CampoTexto
          valor={e.name}
          maxLength={60}
          placeholder="nome do encontro"
          onCommit={(v) => sala.atualizarEncontro(e.id, { name: v })}
        />
        <span className="encqtdtotal">{contarMonstros(total)}</span>
        <BotaoRemover
          aria={`apagar o encontro ${e.name}`}
          confirmar={`Apagar o encontro "${e.name}"? Os monstros que já entraram em combate continuam na sala.`}
          onConfirmar={() => sala.removerEncontro(e.id)}
        />
      </div>

      {e.grupos.length > 0 && (
        <div className="encgrupos">
          {e.grupos.map((g, i) => (
            <div key={`${g.name}-${i}`} className="encgrupo">
              <div className="encgrupoinfo">
                <span className="catnome">{g.name}</span>
                <span className="catstats">
                  CA {g.ac} · {g.hp_max} PV · inic. {g.init_mod >= 0 ? "+" : ""}
                  {g.init_mod}
                </span>
              </div>
              <div className="hpbtns">
                <button
                  type="button"
                  className="pbtn"
                  aria-label={`Um ${g.name} a menos`}
                  disabled={g.quantidade <= 1}
                  onClick={() => mudarQuantidade(i, -1)}
                >
                  −
                </button>
                <span className="encqtd" aria-live="polite">
                  {g.quantidade}×
                </span>
                <button
                  type="button"
                  className="pbtn"
                  aria-label={`Um ${g.name} a mais`}
                  disabled={g.quantidade >= QUANTIDADE_MAX_GRUPO}
                  onClick={() => mudarQuantidade(i, 1)}
                >
                  +
                </button>
              </div>
              <BotaoRemover aria={`tirar ${g.name} do encontro`} onConfirmar={() => tirarGrupo(i)} />
            </div>
          ))}
        </div>
      )}

      {adicionando ? (
        <EscolherMonstro sala={sala} aoEscolher={adicionar} aoFechar={() => setAdicionando(false)} />
      ) : (
        <button type="button" className="minilink" onClick={() => setAdicionando(true)}>
          + adicionar monstro
        </button>
      )}
      <p className="catcopiado" aria-live="polite">
        {adicionando ? aviso : ""}
      </p>
    </div>
  );
}

/** Da biblioteca da sala (os que o Mestre já ajustou) ou do catálogo do SRD. */
function EscolherMonstro({
  sala,
  aoEscolher,
  aoFechar,
}: {
  sala: Sala;
  aoEscolher: (ficha: FichaMonstro) => void;
  aoFechar: () => void;
}) {
  const { catalogo, falhou, tentarDeNovo } = useCatalogoMonstros();
  const [busca, setBusca] = useState("");
  // Monstro com a ficha clássica aberta (nome do livro); um por vez. Serve pra
  // olhar o bicho antes de pôr no grupo: tocar na linha é que adiciona.
  const [fichaAberta, setFichaAberta] = useState<string | null>(null);
  const achados = busca.trim() && catalogo ? catalogo.buscarMonstros(busca) : [];

  return (
    <div className="encescolher">
      {sala.modelosNpc.length > 0 && (
        <div className="chips">
          <span className="empty-note" style={{ padding: 0 }}>
            da sua biblioteca:
          </span>
          {sala.modelosNpc.map((m) => (
            <button key={m.id} type="button" className="chip" onClick={() => aoEscolher(fichaDeMonstro(m))}>
              {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="catbusca">
        <input
          type="search"
          aria-label="Buscar monstro no catálogo do SRD pra pôr no encontro"
          placeholder={catalogo ? `ou busque no catálogo (${catalogo.MONSTROS_SRD.length} monstros)…` : "ou busque no catálogo…"}
          value={busca}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button type="button" className="btn" onClick={aoFechar}>
          pronto
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

      {busca.trim() && catalogo && achados.length === 0 ? (
        <p className="empty-note">Nenhum monstro com esse nome no catálogo.</p>
      ) : null}

      <div className="catresultados">
        {achados.map((m) => (
          <div key={m.name} className="catgrupo">
            <div className="catentrada">
              <button type="button" className="catitem" onClick={() => aoEscolher(fichaDeMonstro({ ...m, name: m.en }))}>
                <span className="catnome">
                  {m.en}
                  {m.en !== m.name && <span className="caten"> · {m.name}</span>}
                </span>
                <span className="catstats">
                  ND {catalogo?.ndTexto(m.nd)} · CA {m.ac} · {m.hp_max} PV · inic. {m.init_mod >= 0 ? "+" : ""}
                  {m.init_mod} · {m.cls}
                </span>
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
              <FichaClassicaMonstro dados={dadosDoMonstro(m, catalogo.ndTexto(m.nd))} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Aba Combate: um toque num encontro preparado cria todos os monstros e põe
 * cada um na iniciativa com a própria rolagem (d20 + modificador).
 *
 * As fichas nascem numa escrita só (`criarVariosPersonagens`: todas ou
 * nenhuma), e só depois entram na ordem. Se a ordem falhar, as fichas já
 * existem na sala — aparecem na lista de quem pode entrar, dá pra pôr na mão.
 */
export function ComecarEncontro({ sala, cenaNaMesa = null }: { sala: Sala; cenaNaMesa?: Cena | null }) {
  const [ocupado, setOcupado] = useState(false);
  const prontos = sala.encontros.filter((e) => totalDoEncontro(e.grupos) > 0);
  if (prontos.length === 0) return null;

  async function comecar(e: Encontro) {
    if (ocupado) return;
    if (!confirm(`Começar "${e.name}"?\n\nCria ${resumoEncontro(e.grupos)} e põe cada um na ordem com a própria rolagem.`)) return;
    setOcupado(true);
    const criados = await sala.criarVariosPersonagens(
      npcsDoEncontro(e.grupos, sala.personagens.map((p) => p.name)),
    );
    if (!criados) {
      setOcupado(false);
      return;
    }
    const novos: ItemIniciativa[] = criados.map((p) => ({ slug: p.slug, name: p.name, init: d20() + p.init_mod }));
    let entraram = 0;
    const feito = await sala.definirCombate((atual) => {
      const r = entrarNaOrdem(atual.order, novos);
      entraram = r.entraram.length;
      return { order: r.ordem };
    });
    if (!feito || entraram === 0) {
      setOcupado(false);
      return;
    }
    // O log é público: nem o nome do encontro nem o dos monstros vão pra lá,
    // senão "Emboscada do Dragão Vermelho" entregaria o chefão antes da hora.
    // Quem joga vê "Inimigo N" na ordem, como com qualquer NPC não revelado.
    const linha = entraram === 1 ? "1 inimigo entrou no combate" : `${entraram} inimigos entraram no combate`;
    sala.registrarLog(linha);
    // Com mapa na mesa, cada monstro ganha peão oculto (o Mestre arruma e mostra).
    const pecas = await porPecasDosQueEntram(cenaNaMesa, criados);
    setOcupado(false);
    // Encontro começado por engano: desfazer tira todo mundo da ordem e apaga
    // as fichas criadas agora (o encontro preparado continua salvo).
    sala.lembrarDesfazer({
      rotulo: `Encontro "${e.name || "sem nome"}" começou`,
      textoLog: textoDesfeito([linha], ""),
      personagens: [],
      combate: feito,
      criados: criados.map((p) => p.id),
      pecas,
    });
  }

  return (
    <div className="chips" style={{ marginTop: 12 }}>
      <span className="empty-note" style={{ padding: 0 }}>
        encontros preparados:
      </span>
      {prontos.map((e) => (
        <button key={e.id} type="button" className="chip" disabled={ocupado} onClick={() => comecar(e)}>
          ⚔ {e.name || "sem nome"} · {contarMonstros(totalDoEncontro(e.grupos))}
        </button>
      ))}
    </div>
  );
}
