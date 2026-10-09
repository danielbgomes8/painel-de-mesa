"use client";

import { Fragment, useState } from "react";
import type { Sala } from "@/hooks/useSala";
import type { EstadoCombate, ItemIniciativa, ModeloNpc, Personagem } from "@/lib/tipos";
import type { Cena } from "@/lib/cenas";
import { juntarPecasDaAcao, porPecasDosCompanheiros, porPecasDosQueEntram, tirarPecasDasFichas } from "@/lib/pecasNoBanco";
import { rolarIniciativa as rolarDados } from "@/lib/dados";
import { CHAVE_INIMIGOS, EmboscadaDaIniciativa } from "@/components/EmboscadaDaIniciativa";
import { ComecarEncontro } from "@/components/EncontrosPreparados";
import { mudarPVComLog } from "@/components/FichaPersonagem";
import { ExplicacaoCondicao, ExplicacaoExaustao } from "@/components/ExplicacaoCondicao";
import { ChipsCondicao, PrazosCondicao } from "@/components/CondicoesEditaveis";
import { RolarAtaques } from "@/components/RolarAtaques";
import { TestesDeMorte } from "@/components/TestesDeMorte";
import { condicoesAtivas, textoPrazo } from "@/lib/condicoes";
import { mudancaDe, textoDesfeito, type MudancaPersonagem } from "@/lib/desfazer";
import {
  entrarNaOrdem,
  estaCaido,
  lerAtaquesRolaveis,
  lerValorPV,
  mensagemCondicao,
  metadeDoDano,
  nomeExibidoIniciativa,
  nomeNoLog,
  numerarNpcsNaOrdem,
  podeEditarPersonagem,
  proximoTurno,
  pvExibidoIniciativa,
  reduzirPrazosCondicao,
  turnoAposRemover,
  turnoAposTrocar,
} from "@/lib/regras";
import { textoEfetivoDeAtaques } from "@/lib/ataquesFicha";
import { LendariasNaLinha } from "@/components/LendariasNaLinha";
import { EncerrarCombate } from "@/components/EncerrarCombate";
import { useEventosDoCombate } from "@/hooks/useEventos";
import { useEfeitosDoCombate } from "@/hooks/useEfeitos";
import { EfeitosDoPersonagem, EfeitosNaLinha } from "@/components/EfeitosDoCombate";
import { comCompanheiros, companheirosQueSaemJunto, ehDoJogador, linhaDeCompanheiro } from "@/lib/companheiros";
import { horaDoCovil, recuperarAcoesLendarias, temCovil } from "@/lib/lendarias";

const NOVO_NPC = "__novo__";

/** Avança pro próximo combatente da ordem; se a rodada virar, reduz prazo das
 *  condições de todo mundo e loga quem parou de estar com o quê. Devolve
 *  `null` quando a escrita falha (o combate já voltou pro estado anterior) —
 *  quem chama não deve agir como se tivesse avançado de verdade. Usado tanto
 *  pelo botão do Mestre quanto pelo "passar a vez" do jogador na sua vez.
 *  Fica guardado pra desfazer — a virada de rodada volta inteira, prazos de
 *  condição inclusive. */
export async function avancarTurno(sala: Sala): Promise<EstadoCombate | null> {
  const personagens = sala.personagens;
  const mudanca = await sala.definirCombate((atual) => proximoTurno(atual));
  if (!mudanca) return null;
  const { antes, depois } = mudanca;
  const virou = depois.round !== antes.round;
  // O monstro que acaba de ganhar o turno recupera as ações lendárias (regra do livro: no início do próprio
  // turno). Fica guardado pro desfazer junto com a virada de rodada.
  const daVez = depois.order[depois.turn];
  const monstro = daVez ? personagens.find((p) => p.slug === daVez.slug && p.is_npc) : undefined;
  const recuperadas = monstro ? recuperarAcoesLendarias(monstro.resources ?? []) : null;
  const lendarias: MudancaPersonagem[] = [];
  if (monstro && recuperadas && (await sala.atualizarVariosPersonagens([{ id: monstro.id, patch: { resources: recuperadas } }]))) {
    lendarias.push(mudancaDe(monstro, { resources: recuperadas }));
  }
  const linhaRodada = `Rodada ${depois.round} começou`;
  const prazos: MudancaPersonagem[] = [];
  if (virou) {
    const expirados: string[] = [];
    for (const p of personagens) {
      if (Object.keys(p.cond_prazo).length === 0) continue;
      const resultado = reduzirPrazosCondicao(p.cond, p.cond_prazo);
      prazos.push(mudancaDe(p, { cond: resultado.cond, cond_prazo: resultado.cond_prazo }));
      for (const nome of resultado.expiraram) {
        expirados.push(`${mensagemCondicao(nomeNoLog(p), nome, false)} (prazo esgotado)`);
      }
    }
    // Uma escrita só pros prazos de todo mundo, e o log de quem perdeu a
    // condição só depois dela confirmar.
    const gravou = await sala.atualizarVariosPersonagens(prazos.map((m) => ({ id: m.id, patch: m.depois })));
    if (!gravou) prazos.length = 0;
    // A virada primeiro e sozinha: linhas da mesma escrita saem com o mesmo
    // horário e o log não saberia qual veio antes.
    await sala.registrarLog(linhaRodada);
    if (gravou) sala.registrarVariosLogs(expirados);
  }
  sala.lembrarDesfazer({
    rotulo: virou ? `Próximo turno — começou a rodada ${depois.round}` : "Próximo turno",
    // Passar a vez sem virar a rodada não vai pro log; desfazer também não.
    textoLog: textoDesfeito(virou ? [linhaRodada] : [], ""),
    personagens: [...prazos, ...lendarias],
    combate: mudanca,
    criados: [],
  });
  return depois;
}

/** O que `comCompanheiros` acrescentou, no formato que o peão do mapa pede (precisa do `cls` pro tamanho). */
function paraPeao(
  extras: { item: ItemIniciativa; donoSlug: string }[],
  personagens: { slug: string; cls: string }[],
): { slug: string; cls?: string; dono: string }[] {
  return extras.map((e) => ({ slug: e.item.slug, dono: e.donoSlug, cls: personagens.find((p) => p.slug === e.item.slug)?.cls }));
}

export function RastreadorCombate({
  sala,
  souMestre,
  meuPersonagem,
  cenaNaMesa = null,
}: {
  sala: Sala;
  souMestre: boolean;
  meuPersonagem: Personagem | null;
  /** O mapa que a mesa está vendo: inimigo que entra na ordem ganha peão
   *  oculto nele, e o que sai leva o peão junto. */
  cenaNaMesa?: Cena | null;
}) {
  const { combate, personagens } = sala;
  const avisos = useEventosDoCombate();
  const efeitos = useEfeitosDoCombate();
  // Sem internet o mapa não funciona: nem tenta mexer nos peões.
  const mapa = sala.semInternet ? null : cenaNaMesa;

  const [quem, setQuem] = useState(NOVO_NPC);
  const [nomeNpc, setNomeNpc] = useState("");
  const [pvNpc, setPvNpc] = useState("");
  const [caNpc, setCaNpc] = useState("");
  const [extrasModelo, setExtrasModelo] = useState<{
    cls?: string;
    speed?: number;
    init_mod?: number;
    ataque?: string;
    notes?: string;
  }>({});
  const [ini, setIni] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  // Dano/cura direto na linha: qual linha está com o campo aberto (por slug —
  // índice mudaria de dono quando alguém entra na ordem) e o retorno do
  // último ajuste, que fica embaixo da linha até a próxima ação.
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [retorno, setRetorno] = useState<{ slug: string; texto: string } | null>(null);
  // Etiqueta de condição tocada: a explicação abre embaixo daquela linha.
  const [explicando, setExplicando] = useState<{ slug: string; nome: string } | null>(null);
  // Emboscada: quem está surpreso rola a iniciativa com desvantagem (não guarda: some ao recarregar).
  const [surpresos, setSurpresos] = useState<Record<string, boolean>>({});
  const [rolouSurpreso, setRolouSurpreso] = useState(false);
  const [dicaRolagem, setDicaRolagem] = useState<string | null>(null);
  const alternarSurpreso = (chave: string) => setSurpresos((s) => ({ ...s, [chave]: !s[chave] }));

  function alternarExplicacao(slug: string, nome: string) {
    setExplicando((atual) => (atual?.slug === slug && atual.nome === nome ? null : { slug, nome }));
  }

  const naOrdem = new Set(combate.order.map((o) => o.slug));
  const disponiveis = personagens.filter((p) => !naOrdem.has(p.slug));
  const jogadoresDeFora = disponiveis.filter((p) => !p.is_npc);

  function pvDe(slug: string) {
    return personagens.find((p) => p.slug === slug) ?? null;
  }

  const contagensNpc = numerarNpcsNaOrdem(combate.order, (slug) => Boolean(pvDe(slug)?.is_npc));

  function usarModelo(m: ModeloNpc) {
    setNomeNpc(m.name);
    setPvNpc(String(m.hp_max));
    setCaNpc(String(m.ac));
    // notes junto: sem isso, a tática que o Mestre preparou na biblioteca
    // ("foge com menos de 10 PV"...) sumia ao puxar o NPC pro combate.
    setExtrasModelo({ cls: m.cls, speed: m.speed, init_mod: m.init_mod, ataque: m.ataque, notes: m.notes });
  }

  function rolarIniciativa() {
    const mod = quem !== NOVO_NPC ? personagens.find((x) => x.slug === quem)?.init_mod ?? 0 : extrasModelo.init_mod ?? 0;
    const desvantagem = Boolean(surpresos[quem !== NOVO_NPC ? quem : CHAVE_INIMIGOS]);
    const r = rolarDados(mod, desvantagem);
    setIni(String(r.total));
    setRolouSurpreso(desvantagem);
    setDicaRolagem(desvantagem ? `Surpreso: rolou ${r.dados.join(" e ")}, vale o menor.` : null);
  }

  async function adicionar() {
    if (ocupado) return;
    const init = Number.parseInt(ini, 10);
    const iniciativa = Number.isNaN(init) ? 0 : init;

    let item: ItemIniciativa | null = null;
    let entrando: Personagem | null = null;
    let criado: Personagem | null = null;

    if (quem === NOVO_NPC) {
      const nome = nomeNpc.trim();
      if (!nome) return;
      const pvMax = Number.parseInt(pvNpc, 10);
      const ca = Number.parseInt(caNpc, 10);
      setOcupado(true);
      criado = await sala.criarPersonagem({
        name: nome,
        is_npc: true,
        hp: Number.isNaN(pvMax) ? 10 : pvMax,
        hp_max: Number.isNaN(pvMax) ? 10 : pvMax,
        ac: Number.isNaN(ca) ? 12 : ca,
        ...extrasModelo,
      });
      setOcupado(false);
      if (!criado) return;
      entrando = criado;
      item = { slug: criado.slug, name: criado.name, init: iniciativa };
      setNomeNpc("");
      setPvNpc("");
      setCaNpc("");
      setExtrasModelo({});
    } else {
      const p = personagens.find((x) => x.slug === quem);
      if (!p) return;
      entrando = p;
      item = { slug: p.slug, name: p.name, init: iniciativa };
    }

    // `entrou` é preenchido dentro do callback porque ele roda de novo a cada
    // tentativa do controle de concorrência — vale o da última, que é a que
    // gravou de verdade.
    let entrou = false;
    let extras: { item: ItemIniciativa; dono: string; donoSlug: string }[] = [];
    const feito = await sala.definirCombate((atual) => {
      // Quem tem companheiro (familiar, montaria...) entra com ele, logo depois, na mesma contagem.
      const c = comCompanheiros([item], personagens, atual.order);
      const r = entrarNaOrdem(atual.order, c.itens);
      entrou = r.entraram.some((x) => x.slug === item.slug);
      extras = c.acrescentados.filter((a) => r.entraram.some((x) => x.slug === a.item.slug));
      return { order: r.ordem };
    });
    setIni("");
    setRolouSurpreso(false);
    setDicaRolagem(null);
    if (feito && entrou) {
      if (extras.length > 0) sala.registrarVariosLogs(extras.map((e) => linhaDeCompanheiro(e.item.name, e.dono)));
      // Log é público: NPC oculto entra como "Um inimigo" (ver nomeNoLog).
      const linha = `${nomeNoLog(entrando)} entrou no combate (iniciativa ${item.init}${rolouSurpreso ? ", surpreso" : ""})`;
      sala.registrarLog(linha);
      // Inimigo com mapa na mesa ganha peão oculto (ver pecasDosQueEntram).
      const pecasInimigo = await porPecasDosQueEntram(mapa, [entrando]);
      const pecasCompanheiros = mapa ? await porPecasDosCompanheiros(mapa.room_code, paraPeao(extras, personagens)) : undefined;
      const pecas = juntarPecasDaAcao(pecasInimigo, pecasCompanheiros);
      sala.lembrarDesfazer({
        rotulo: `${entrando.name} entrou no combate (iniciativa ${item.init})`,
        textoLog: textoDesfeito([linha], ""),
        personagens: [],
        combate: feito,
        // NPC criado agora pra entrar: desfazer apaga a ficha junto.
        criados: criado ? [criado.id] : [],
        pecas,
      });
    }
  }

  /** Põe de uma vez todo jogador que ainda não está na ordem, cada um com a
   *  própria rolagem (d20 + modificador da ficha). Era o gargalo do começo de
   *  cada combate: o Mestre fazia isso um por um, no celular, com a mesa
   *  esperando. NPC continua entrando na mão — monstro em grupo costuma usar
   *  uma iniciativa só pro bando. */
  async function porTodosOsJogadores() {
    if (ocupado || jogadoresDeFora.length === 0) return;
    setOcupado(true);
    const surpresosDaVez = new Set(jogadoresDeFora.filter((p) => surpresos[p.slug]).map((p) => p.slug));
    const novos: ItemIniciativa[] = jogadoresDeFora.map((p) => ({
      slug: p.slug,
      name: p.name,
      init: rolarDados(p.init_mod, surpresosDaVez.has(p.slug)).total,
    }));
    let entraram: ItemIniciativa[] = [];
    let extras: { item: ItemIniciativa; dono: string; donoSlug: string }[] = [];
    const feito = await sala.definirCombate((atual) => {
      const c = comCompanheiros(novos, personagens, atual.order);
      const r = entrarNaOrdem(atual.order, c.itens);
      entraram = r.entraram.filter((x) => novos.some((n) => n.slug === x.slug));
      extras = c.acrescentados.filter((a) => r.entraram.some((x) => x.slug === a.item.slug));
      return { order: r.ordem };
    });
    setOcupado(false);
    if (!feito) return;
    const linhas = entraram.map((n) => `${n.name} entrou no combate (iniciativa ${n.init}${surpresosDaVez.has(n.slug) ? ", surpreso" : ""})`);
    sala.registrarVariosLogs([...linhas, ...extras.map((e) => linhaDeCompanheiro(e.item.name, e.dono))]);
    const resumo = entraram.length === 1 ? linhas[0] : `${entraram.length} jogadores entraram no combate`;
    const pecas = mapa ? await porPecasDosCompanheiros(mapa.room_code, paraPeao(extras, personagens)) : undefined;
    sala.lembrarDesfazer({
      rotulo: resumo,
      textoLog: textoDesfeito(linhas, resumo),
      personagens: [],
      combate: feito,
      criados: [],
      pecas,
    });
  }

  function abrirAjuste(slug: string) {
    setRetorno(null);
    setAjustando((atual) => (atual === slug ? null : slug));
  }

  async function aplicarAjuste(alvo: Personagem, delta: number) {
    // Fecha no toque: a linha já mostra o PV novo, e com a internet
    // pendurada a escrita pode levar até o prazo da rede pra responder.
    setAjustando(null);
    const texto = await mudarPVComLog(sala, alvo, delta);
    if (texto) setRetorno({ slug: alvo.slug, texto });
  }

  async function aoClicarProximoTurno() {
    if (ocupado) return;
    setRetorno(null);
    setOcupado(true);
    await avancarTurno(sala);
    setOcupado(false);
  }

  async function reiniciar() {
    const feito = await sala.definirCombate({ round: 1, turn: 0, order: [] });
    if (!feito) return;
    // Os avisos programados eram deste combate (melhor esforço).
    await avisos.limparTodos();
    await efeitos.limparTodos();
    sala.registrarLog("Combate reiniciado");
    sala.lembrarDesfazer({
      rotulo: "Combate reiniciado",
      textoLog: textoDesfeito(["Combate reiniciado"], ""),
      personagens: [],
      combate: feito,
      criados: [],
    });
  }

  async function remover(i: number) {
    const saindo = combate.order[i];
    if (!saindo) return;
    if (saindo.slug === ajustando) setAjustando(null);
    // Pelo slug, não pelo índice da tela: se alguém entrou na ordem de outro
    // celular no meio tempo, o índice já é de outra pessoa.
    const feito = await sala.definirCombate((atual) => {
      if (!atual.order.some((o) => o.slug === saindo.slug)) return {};
      // O dono leva os companheiros dele junto (um de cada vez, pra o turno acertar a conta).
      let ordem = atual.order;
      let turn = atual.turn;
      for (const slug of [saindo.slug, ...companheirosQueSaemJunto(personagens, saindo.slug)]) {
        const i = ordem.findIndex((o) => o.slug === slug);
        if (i < 0) continue;
        ordem = ordem.filter((_, j) => j !== i);
        turn = turnoAposRemover(turn, i, ordem.length);
      }
      return { order: ordem, turn };
    });
    // Tirar da ordem não vai pro log, então desfazer também não grava nada lá.
    if (feito) {
      const ficha = pvDe(saindo.slug);
      // Inimigo que sai da ordem sai também do mapa da mesa (o jogador fica:
      // ele continua ali mesmo fora do combate). Desfazer devolve o peão no
      // mesmo lugar.
      const slugsDePeao = [...(ficha?.is_npc ? [ficha.slug] : []), ...companheirosQueSaemJunto(personagens, saindo.slug)];
      const tiradas = mapa && slugsDePeao.length > 0 ? await tirarPecasDasFichas(mapa.room_code, slugsDePeao, mapa.id) : [];
      sala.lembrarDesfazer({
        rotulo: `${ficha?.name ?? saindo.name} saiu da ordem`,
        textoLog: null,
        personagens: [],
        combate: feito,
        criados: [],
        pecas: tiradas.length > 0 ? { criadas: [], tiradas } : undefined,
      });
    }
  }

  // Quem tem ações de covil e está na ordem (o Mestre vê o nome de verdade).
  const donosDoCovil = combate.order
    .map((c) => sala.personagens.find((x) => x.slug === c.slug))
    .filter((x): x is Personagem => Boolean(x) && temCovil(x!.resources ?? []))
    .map((x) => x.name);

  function trocar(i: number, j: number) {
    if (j < 0 || j >= combate.order.length) return;
    sala.definirCombate((atual) => {
      const ordem = [...atual.order];
      [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
      return { order: ordem, turn: turnoAposTrocar(atual.turn, i, j) };
    });
  }

  return (
    <div className="combat">
      <div className="combat-head">
        <h2>Iniciativa &amp; combate</h2>
        <div className="round">
          Rodada <b>{combate.round}</b>
        </div>
      </div>

      {souMestre && donosDoCovil.length > 0 && horaDoCovil(combate.order, combate.turn) && (
        <p className="covil-aviso" role="status">
          🏰 Contagem 20: hora das ações de covil de {donosDoCovil.join(", ")}.
        </p>
      )}

      <div className="initlist">
        {combate.order.length === 0 && (
          <p className="empty-note">
            {souMestre
              ? "Ninguém na ordem ainda. Adicione combatentes abaixo."
              : "O Mestre monta a ordem quando o combate começar."}
          </p>
        )}

        {combate.order.map((c, i) => {
            const pv = pvDe(c.slug);
            const pvVisivel = pv ? pvExibidoIniciativa(pv, souMestre) : null;
            const critico = pvVisivel ? estaCaido(pvVisivel.hp) : false;
            const nomeExibido = pv
              ? nomeExibidoIniciativa(pv, contagensNpc[i], souMestre)
              : c.name;
            // Mesma permissão da ficha: o Mestre em qualquer linha, o jogador
            // só na do próprio personagem.
            const podeAjustar = pv !== null && podeEditarPersonagem(souMestre, ehDoJogador(pv, meuPersonagem?.slug));
            const aberto = podeAjustar && ajustando === c.slug;
            // Condições valem pra todo mundo ver, NPC oculto inclusive: o log
            // (público) já anuncia "Um inimigo ficou Atordoado", e o jogador
            // precisa saber que o ataque dele tem vantagem.
            const conds = pv ? condicoesAtivas(pv.cond) : [];
            const exaustao = pv?.exh ?? 0;
            // Jogador a 0 PV está Inconsciente pelas regras, mesmo sem
            // ninguém ter ligado a condição na mão — e é a informação que
            // mais importa na ordem: quem chegar perto acerta crítico.
            const caido = Boolean(pv && !pv.is_npc && estaCaido(pv.hp));
            const explicacaoAqui = explicando?.slug === c.slug ? explicando.nome : null;
            const quem = (
              <>
                <span className="nm">{nomeExibido}</span>
                {pv?.dono && <span className="comp-tag">🐾 de {personagens.find((x) => x.slug === pv.dono)?.name ?? "?"}</span>}
                {pvVisivel && (
                  <span className="pvlinha">
                    <span className={`hpmini${critico ? " crit" : ""}`}>
                      {pvVisivel.hp}/{pvVisivel.hp_max} PV
                    </span>
                    {pv && pv.hp_temp > 0 && <span className="hptemp">+{pv.hp_temp}</span>}
                    {podeAjustar && (
                      <span className="pvtoque" aria-hidden="true">
                        ±
                      </span>
                    )}
                  </span>
                )}
              </>
            );
          return (
            <Fragment key={`${c.slug}-${i}`}>
              <div className={`initrow${i === combate.turn ? " turn" : ""}`}>
                <div className="n">{c.init}</div>
                {podeAjustar ? (
                  // A linha toda (nome + PV) é o alvo do toque: é o gesto mais
                  // repetido do combate, feito no celular com a mesa esperando.
                  <button
                    type="button"
                    className="who whobtn"
                    aria-expanded={aberto}
                    title="Aplicar dano ou cura"
                    onClick={() => abrirAjuste(c.slug)}
                  >
                    {quem}
                  </button>
                ) : (
                  <div className="who">{quem}</div>
                )}
                {souMestre && pv?.is_npc ? (
                  <button
                    type="button"
                    className="minilink"
                    onClick={() => sala.atualizarPersonagem(pv.id, { revealed: !pv.revealed })}
                  >
                    {pv.revealed ? "revelado" : "revelar"}
                  </button>
                ) : (
                  <span />
                )}
                {souMestre ? (
                  <div className="reorder">
                    <button
                      type="button"
                      aria-label="Subir na ordem"
                      disabled={i === 0}
                      onClick={() => trocar(i, i - 1)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label="Descer na ordem"
                      disabled={i === combate.order.length - 1}
                      onClick={() => trocar(i, i + 1)}
                    >
                      ▼
                    </button>
                  </div>
                ) : (
                  <div />
                )}
                {souMestre ? (
                  <button
                    type="button"
                    className="rm"
                    aria-label="Remover da ordem"
                    onClick={() => remover(i)}
                  >
                    ✕
                  </button>
                ) : (
                  <span />
                )}
              </div>
              {pv && (caido || conds.length > 0 || exaustao > 0) && (
                <div className="initconds">
                  {caido && pv && (
                    <button
                      type="button"
                      className="condtag caido"
                      aria-expanded={explicacaoAqui === "Caído a 0 PV"}
                      onClick={() => alternarExplicacao(c.slug, "Caído a 0 PV")}
                    >
                      Inconsciente · 0 PV
                      {pv.dss + pv.dsf > 0 ? ` · ✓${pv.dss} ✗${pv.dsf}` : ""}
                    </button>
                  )}
                  {conds.map((nome) => {
                    const prazo = pv.cond_prazo[nome];
                    return (
                      <button
                        key={nome}
                        type="button"
                        className="condtag"
                        aria-expanded={explicacaoAqui === nome}
                        onClick={() => alternarExplicacao(c.slug, nome)}
                      >
                        {nome}
                        {prazo ? ` · ${textoPrazo(prazo)}` : ""}
                      </button>
                    );
                  })}
                  {exaustao > 0 && (
                    <button
                      type="button"
                      className="condtag"
                      aria-expanded={explicacaoAqui === "Exaustão"}
                      onClick={() => alternarExplicacao(c.slug, "Exaustão")}
                    >
                      Exaustão {exaustao}
                    </button>
                  )}
                </div>
              )}
              {pv && caido && explicacaoAqui === "Caído a 0 PV" && (
                <ExplicacaoCondicao
                  nome="Inconsciente"
                  detalhe="a 0 PV, faz os testes de morte"
                  onFechar={() => setExplicando(null)}
                />
              )}
              {pv && <EfeitosNaLinha sala={sala} personagem={pv} souMestre={souMestre} />}
              {pv && explicacaoAqui === "Exaustão" && exaustao > 0 && (
                <ExplicacaoExaustao nivel={exaustao} onFechar={() => setExplicando(null)} />
              )}
              {pv &&
                conds.map(
                  (nome) =>
                    explicacaoAqui === nome && (
                      <ExplicacaoCondicao
                        key={nome}
                        nome={nome}
                        prazo={pv.cond_prazo[nome]}
                        onFechar={() => setExplicando(null)}
                      />
                    ),
                )}
              {aberto && pv && (
                <AcoesNaLinha
                  sala={sala}
                  personagem={pv}
                  naVez={i === combate.turn}
                  onAplicar={(delta) => aplicarAjuste(pv, delta)}
                  onFechar={() => setAjustando(null)}
                />
              )}
              {!aberto && retorno?.slug === c.slug && (
                <div className="initretorno" role="status">
                  <span>{retorno.texto}</span>
                  <button type="button" className="rm" aria-label="Dispensar" onClick={() => setRetorno(null)}>
                    ✕
                  </button>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {!souMestre && meuPersonagem && !naOrdem.has(meuPersonagem.slug) && (
        <MinhaIniciativa sala={sala} personagem={meuPersonagem} />
      )}

      {souMestre && (
        <>
          <div className="proximoturno">
            <button
              type="button"
              className="btn primary"
              onClick={aoClicarProximoTurno}
              disabled={combate.order.length === 0 || ocupado}
            >
              Próximo turno →
            </button>
          </div>
          {encerrando && <EncerrarCombate sala={sala} onFechar={() => setEncerrando(false)} />}

          <details className="gavetacombate" open={combate.order.length === 0}>
            <summary>
              Montar o combate
              <span className="dica">adicionar · encontro</span>
            </summary>
            <div className="gavetacorpo">
          {jogadoresDeFora.length > 0 && (
            <button
              type="button"
              className="btn"
                            onClick={porTodosOsJogadores}
              disabled={ocupado}
            >
              🎲 Pôr {jogadoresDeFora.length === 1 ? "1 jogador" : `os ${jogadoresDeFora.length} jogadores`} na ordem
            </button>
          )}

          <EmboscadaDaIniciativa jogadoresFora={jogadoresDeFora} surpresos={surpresos} onAlternar={alternarSurpreso} />

          <ComecarEncontro sala={sala} cenaNaMesa={mapa} inimigosSurpresos={Boolean(surpresos[CHAVE_INIMIGOS])} />

          <div className="addcombatant">
            <select value={quem} onChange={(e) => setQuem(e.target.value)}>
              <option value={NOVO_NPC}>Novo NPC / monstro…</option>
              {disponiveis.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name}
                  {p.is_npc ? " (NPC)" : ""}
                </option>
              ))}
            </select>

            {quem === NOVO_NPC && (
              <>
                <input
                  type="text"
                  placeholder="nome do NPC/monstro"
                  maxLength={40}
                  value={nomeNpc}
                  onChange={(e) => setNomeNpc(e.target.value)}
                />
                <input
                  className="num"
                  type="number"
                  inputMode="numeric"
                  placeholder="PV máx"
                  value={pvNpc}
                  onChange={(e) => setPvNpc(e.target.value)}
                />
                <input
                  className="num"
                  type="number"
                  inputMode="numeric"
                  placeholder="CA"
                  value={caNpc}
                  onChange={(e) => setCaNpc(e.target.value)}
                />
              </>
            )}

            <input
              className="num"
              type="number"
              inputMode="numeric"
              placeholder="iniciativa"
              value={ini}
              onChange={(e) => {
                setIni(e.target.value);
                setRolouSurpreso(false);
                setDicaRolagem(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") adicionar();
              }}
            />
            <button type="button" className="btn" aria-label="Rolar iniciativa" onClick={rolarIniciativa}>
              🎲
            </button>
            <button type="button" className="btn" onClick={adicionar} disabled={ocupado}>
              Adicionar à ordem
            </button>
          </div>
          {dicaRolagem && <p className="empty-note">{dicaRolagem}</p>}

          {quem === NOVO_NPC && sala.modelosNpc.length > 0 && (
            <div className="chips" style={{ marginTop: 8 }}>
              <span className="empty-note" style={{ padding: 0 }}>
                da biblioteca:
              </span>
              {sala.modelosNpc.map((m) => (
                <button key={m.id} type="button" className="chip" onClick={() => usarModelo(m)}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
          <div className="combatctrls">
            <button type="button" className="btn" disabled={combate.order.length === 0} onClick={() => setEncerrando(true)}>
              🏁 Encerrar combate
            </button>
            <button type="button" className="btn" onClick={reiniciar}>
              Reiniciar combate
            </button>
          </div>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

/** Painel que abre embaixo da linha da iniciativa: dano/cura (digita o
 *  número e escolhe dano, metade — resistência ou passou no teste — ou cura;
 *  Enter = dano, que é o caso mais comum; Esc fecha) e as condições, com os
 *  mesmos chips e prazos da ficha. Aplicar dano fecha o painel; mexer em
 *  condição não, pra dar pra ligar mais de uma. Também é o miolo do cartão
 *  que abre ao tocar num peão do mapa (CartaoDoPeao). */
export function AcoesNaLinha({
  sala,
  personagem: p,
  naVez,
  onAplicar,
  onFechar,
  focarAoAbrir = true,
}: {
  sala: Sala;
  personagem: Personagem;
  /** É a vez de quem está nesta linha. */
  naVez: boolean;
  onAplicar: (delta: number) => Promise<void>;
  onFechar: () => void;
  /** Põe o cursor no campo de dano ao abrir. No mapa, não: o teclado do
   *  celular subiria por cima do mapa a cada toque num peão. */
  focarAoAbrir?: boolean;
}) {
  // Na vez de quem tem ataque pra rolar, abrir a linha é pra atacar, não pra
  // tomar dano: sem o cursor no campo de PV, o teclado do celular não sobe
  // por cima dos botões de ataque.
  const focarDano = focarAoAbrir && !(naVez && lerAtaquesRolaveis(textoEfetivoDeAtaques(p)).ataques.length > 0);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const n = lerValorPV(texto);
  const metade = n === null ? 0 : metadeDoDano(n);

  function aplicar(delta: number) {
    if (enviando || delta === 0) return;
    // Sem voltar pra false: quem chama fecha este campo quando termina.
    setEnviando(true);
    onAplicar(delta);
  }

  // Lembretes que mudam a conta, só quando existem: o PV temporário segura o
  // dano antes, a resistência pede a metade, e concentrado pede teste de CON
  // (o retorno e o log já trazem a CD depois de aplicar).
  const notas: string[] = [];
  if (p.hp_temp > 0) notas.push(`${p.hp_temp} de PV temporário sai primeiro`);
  if (p.vantagens_resistencias.trim()) notas.push(p.vantagens_resistencias.trim());
  if (p.concentration) {
    const em = p.concentration_on.trim();
    notas.push(em ? `concentrado em ${em}` : "concentrado");
  }

  return (
    <div className="initajuste">
      <input
        className="num"
        type="number"
        inputMode="numeric"
        min={1}
        max={999}
        autoFocus={focarDano}
        enterKeyHint="done"
        placeholder="quanto?"
        aria-label={`Quanto de dano ou cura em ${p.name}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (n) aplicar(-n);
          } else if (e.key === "Escape") {
            onFechar();
          }
        }}
      />
      <button type="button" className="btn primary" disabled={!n || enviando} onClick={() => n && aplicar(-n)}>
        {n ? `Dano ${n}` : "Dano"}
      </button>
      <button
        type="button"
        className="btn"
        disabled={!metade || enviando}
        title="Resistência, ou passou no teste: metade do dano, arredondando pra baixo"
        onClick={() => aplicar(-metade)}
      >
        {metade ? `Metade ${metade}` : "Metade"}
      </button>
      <button type="button" className="btn cura" disabled={!n || enviando} onClick={() => n && aplicar(n)}>
        {n ? `Cura ${n}` : "Cura"}
      </button>
      <button type="button" className="rm" aria-label="Fechar" onClick={onFechar}>
        ✕
      </button>
      {notas.length > 0 && <p className="initajustenota">{notas.join(" · ")}</p>}
      {/* A 0 PV a vez do jogador é rolar o teste de morte: fica antes do
          resto, que é o que ele NÃO pode fazer. */}
      {!p.is_npc && estaCaido(p.hp) && (
        <div className="initmorte">
          <TestesDeMorte sala={sala} personagem={p} editavel titulo="Testes de morte" />
        </div>
      )}
      <RolarAtaques texto={textoEfetivoDeAtaques(p)} />
      {p.is_npc && <LendariasNaLinha sala={sala} personagem={p} />}
      <div className="initajustecond">
        <span className="sectitle">Condições</span>
        <ChipsCondicao sala={sala} personagem={p} editavel />
        <PrazosCondicao sala={sala} personagem={p} />
      </div>
      <EfeitosDoPersonagem sala={sala} personagem={p} />
    </div>
  );
}

/** Deixa o próprio jogador rolar/digitar a iniciativa do seu personagem, em
 *  vez do Mestre ter que fazer isso manualmente por cada um. */
function MinhaIniciativa({ sala, personagem }: { sala: Sala; personagem: Personagem }) {
  const [ini, setIni] = useState("");
  const [surpreso, setSurpreso] = useState(false);
  const [rolouSurpreso, setRolouSurpreso] = useState(false);
  const [dica, setDica] = useState<string | null>(null);

  function rolar() {
    const r = rolarDados(personagem.init_mod, surpreso);
    setIni(String(r.total));
    setRolouSurpreso(surpreso);
    setDica(surpreso ? `Surpreso: rolou ${r.dados.join(" e ")}, vale o menor.` : null);
  }

  // Sem número digitado, o botão rola por você (d20 + modificador) e entra de
  // uma vez: antes ele ficava apagado sem dizer por quê.
  async function entrar() {
    let iniciativa: number;
    let surpresoNaRolagem = rolouSurpreso;
    if (ini === "") {
      const r = rolarDados(personagem.init_mod, surpreso);
      iniciativa = r.total;
      surpresoNaRolagem = surpreso;
    } else {
      const init = Number.parseInt(ini, 10);
      iniciativa = Number.isNaN(init) ? 0 : init;
    }
    const item: ItemIniciativa = { slug: personagem.slug, name: personagem.name, init: iniciativa };
    // Função, não objeto: se outro jogador entrar quase no mesmo instante, cada
    // escrita parte do estado mais recente conhecido em vez de um `sala.combate`
    // que pode já estar velho quando esta chega — reduz (não garante 100%, isso
    // pediria uma escrita atômica no banco) o risco de uma sobrescrever a outra.
    let entrou = false;
    let extras: { item: ItemIniciativa; dono: string; donoSlug: string }[] = [];
    const feito = await sala.definirCombate((atual) => {
      // Quem tem companheiro (familiar, montaria...) entra com ele, logo depois, na mesma contagem.
      const c = comCompanheiros([item], sala.personagens, atual.order);
      const r = entrarNaOrdem(atual.order, c.itens);
      entrou = r.entraram.some((x) => x.slug === item.slug);
      extras = c.acrescentados.filter((a) => r.entraram.some((x) => x.slug === a.item.slug));
      return { order: r.ordem };
    });
    if (feito && entrou) {
      if (extras.length > 0) {
        sala.registrarVariosLogs(extras.map((e) => linhaDeCompanheiro(e.item.name, e.dono)));
        // O peão dos companheiros nasce no mapa da mesa, encostado no do dono (sem mapa na mesa, nada acontece).
        if (!sala.semInternet) void porPecasDosCompanheiros(personagem.room_code, paraPeao(extras, sala.personagens));
      }
      const linha = `${personagem.name} entrou no combate (iniciativa ${iniciativa}${surpresoNaRolagem ? ", surpreso" : ""})`;
      sala.registrarLog(linha);
      sala.lembrarDesfazer({
        rotulo: linha,
        textoLog: textoDesfeito([linha], ""),
        personagens: [],
        combate: feito,
        criados: [],
      });
    }
    setIni("");
    setRolouSurpreso(false);
    setDica(null);
  }

  return (
    <div className="addcombatant" style={{ marginTop: 12 }}>
      <input
        className="num"
        type="number"
        inputMode="numeric"
        placeholder="iniciativa"
        aria-label="Sua iniciativa"
        value={ini}
        onChange={(e) => setIni(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") entrar();
        }}
      />
      <button type="button" className="btn" aria-label="Rolar iniciativa" onClick={rolar}>
        🎲
      </button>
      <button type="button" className="btn" onClick={entrar}>
        {ini ? "Entrar no combate" : "🎲 Rolar e entrar"}
      </button>
      <label className="inv-mag">
        <input type="checkbox" checked={surpreso} onChange={(e) => setSurpreso(e.target.checked)} />
        estou surpreso (desvantagem)
      </label>
      {dica && <p className="empty-note">{dica}</p>}
    </div>
  );
}
