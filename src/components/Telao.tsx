"use client";

import type { Sala } from "@/hooks/useSala";
import type { Tempo } from "@/hooks/useTempo";
import { diasRestantes, efeitosPertoDeVencer, rotuloCurtoDoDia, textoDoRestante } from "@/lib/tempoCampanha";
import type { Cenas } from "@/hooks/useCenas";
import { VisorDaMesa } from "@/components/MapaSobDemanda";
import { useTelaAcesa } from "@/hooks/useTelaAcesa";
import { condicoesAtivas, textoPrazo } from "@/lib/condicoes";
import { nomeDoDono } from "@/lib/companheiros";
import {
  estaCaido,
  nomeExibidoIniciativa,
  numerarNpcsNaOrdem,
  proximosDaOrdem,
  pvExibidoIniciativa,
} from "@/lib/regras";
import { pareceSalaNova } from "@/lib/sala";

/** Quantos "a seguir" cabem sem competir com o nome de quem está jogando. */
const QUANTOS_PROXIMOS = 3;

/** Tela grande só com "de quem é a vez" — pensada pra um televisor/notebook
 *  central da mesa, não pro celular de ninguém. Sempre trata quem olha como
 *  jogador (nunca entrega nome de NPC ainda não revelado). Quando o Mestre
 *  põe um mapa na mesa, o mapa ocupa a tela e a vez vira uma faixa embaixo. */
export function Telao({
  sala,
  rotulo,
  cenas,
  codigo,
  tempo,
}: {
  sala: Sala;
  rotulo: string;
  cenas: Cenas;
  codigo: string;
  /** O tempo da campanha: o dia e os efeitos que vencem logo aparecem pra mesa. */
  tempo?: Tempo;
}) {
  const { combate, personagens } = sala;
  const hoje = tempo?.tempo ?? null;
  const diaDaCampanha = hoje ? rotuloCurtoDoDia(hoje) : null;
  const vencendo = hoje && tempo ? efeitosPertoDeVencer(tempo.efeitos, hoje.dia) : [];
  // Ninguém mexe no aparelho do telão: sem isto a tela apaga (ou o notebook
  // entra em descanso) no meio do combate.
  const tela = useTelaAcesa();
  const atual = combate.order[combate.turn];
  const pv = atual ? personagens.find((p) => p.slug === atual.slug) ?? null : null;
  const contagensNpc = numerarNpcsNaOrdem(
    combate.order,
    (slug) => Boolean(personagens.find((p) => p.slug === slug)?.is_npc),
  );
  const nomeExibido = atual
    ? pv
      ? nomeExibidoIniciativa(pv, contagensNpc[combate.turn], false)
      : atual.name
    : null;
  const pvVisivel = pv ? pvExibidoIniciativa(pv, false) : null;
  // Companheiro age na vez do dono: o telão diz de quem é pra mesa saber quem decide.
  const donoDaVez = nomeDoDono(personagens, pv);
  // As condições de quem está na vez, do tamanho de serem lidas do outro
  // lado da mesa. Valem pra todo mundo ver, NPC oculto inclusive (o log já
  // anuncia, e é o que decide se o ataque tem vantagem). Jogador a 0 PV
  // aparece como Inconsciente, que é a condição que ele tem pelas regras;
  // NPC a 0 PV não entra nisso — o PV dele é informação do Mestre.
  const etiquetas: string[] = [];
  if (pv && !pv.is_npc && estaCaido(pv.hp)) etiquetas.push("Inconsciente");
  for (const nome of pv ? condicoesAtivas(pv.cond) : []) {
    const prazo = pv?.cond_prazo[nome];
    etiquetas.push(prazo ? `${nome} · ${textoPrazo(prazo)}` : nome);
  }
  if (pv && pv.exh > 0) etiquetas.push(`Exaustão ${pv.exh}`);
  // Só os nomes: PV de NPC é informação do Mestre, e no telão a mesa inteira
  // está vendo (ver pvExibidoIniciativa).
  const proximos = proximosDaOrdem(combate.order.length, combate.turn, QUANTOS_PROXIMOS).map((i) => {
    const item = combate.order[i];
    const dele = personagens.find((p) => p.slug === item.slug) ?? null;
    return {
      chave: `${item.slug}-${i}`,
      nome: dele ? nomeExibidoIniciativa(dele, contagensNpc[i], false) : item.name,
    };
  });

  const aviso =
    tela === "recusada" || tela === "sem-suporte" ? (
      <p className="telao-aviso">
        Este navegador não deixou manter a tela acesa: desligue o descanso de tela do aparelho
        {tela === "recusada" ? " (ou a economia de bateria)" : ""}.
      </p>
    ) : null;

  // Só depois de ler o banco: carregando, sem internet (foto do aparelho) ou
  // com erro, a lista vazia de personagens não quer dizer nada.
  const salaNova =
    !sala.carregando && !sala.semInternet && !sala.erro && pareceSalaNova(codigo, personagens.length);

  if (cenas.naMesa) {
    return (
      <div className="telao telao--mapa" data-tela={tela ?? undefined}>
        <div className="telao-mapa">
          <VisorDaMesa cena={cenas.naMesa} codigo={codigo} urlDaImagem={cenas.urlDaImagem} sala={sala} telao />
        </div>
        <div className="telao-faixa">
          {atual ? (
            <>
              <div className="telao-faixa-vez">
                <span className="telao-faixa-rotulo">vez de</span>
                <span className="telao-faixa-nome">{nomeExibido}</span>
                {donoDaVez && <span className="telao-faixa-pv">🐾 de {donoDaVez}</span>}
                {pvVisivel && (
                  <span className="telao-faixa-pv">
                    {pvVisivel.hp} / {pvVisivel.hp_max} PV
                  </span>
                )}
              </div>
              {etiquetas.length > 0 && (
                <div className="telao-cond telao-cond--faixa">
                  {etiquetas.map((e) => (
                    <span key={e}>{e}</span>
                  ))}
                </div>
              )}
              {proximos.length > 0 && (
                <div className="telao-faixa-prox">
                  <span className="telao-proximos-rotulo">a seguir</span> {proximos.map((p) => p.nome).join(" · ")}
                </div>
              )}
            </>
          ) : (
            <div className="telao-faixa-vez">
              <span className="telao-faixa-rotulo">{rotulo}</span>
              <span className="telao-faixa-nome">Sem combate no momento</span>
            </div>
          )}
          {diaDaCampanha && (
            <div className="telao-faixa-dia">
              🗓 {diaDaCampanha}
              {vencendo.map((e) => (
                <span key={e.id}> · ⏳ {e.nome}: {textoDoRestante(diasRestantes(e, hoje!.dia))}</span>
              ))}
            </div>
          )}
          {aviso}
        </div>
      </div>
    );
  }

  return (
    <div className="telao" data-tela={tela ?? undefined}>
      <div className="telao-eyebrow">
        {rotulo} · Rodada {combate.round}
        {diaDaCampanha && ` · ${diaDaCampanha}`}
      </div>
      {vencendo.length > 0 && hoje && (
        <div className="telao-efeitos">
          {vencendo.map((e) => (
            <span key={e.id}>
              ⏳ {e.nome}: {textoDoRestante(diasRestantes(e, hoje.dia))}
            </span>
          ))}
        </div>
      )}
      {atual ? (
        <>
          <div className="telao-label">é a vez de</div>
          <div className="telao-nome">{nomeExibido}</div>
          {donoDaVez && <div className="telao-pv">🐾 de {donoDaVez}</div>}
          {pvVisivel && (
            <div className="telao-pv">
              {pvVisivel.hp} / {pvVisivel.hp_max} PV
            </div>
          )}
          {etiquetas.length > 0 && (
            <div className="telao-cond">
              {etiquetas.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </div>
          )}
          {proximos.length > 0 && (
            <div className="telao-proximos">
              <span className="telao-proximos-rotulo">a seguir</span>
              <ol>
                {proximos.map((p) => (
                  <li key={p.chave}>{p.nome}</li>
                ))}
              </ol>
            </div>
          )}
        </>
      ) : (
        <div className="telao-nome">Sem combate no momento</div>
      )}
      {salaNova && (
        <p className="telao-sala-nova" role="status">
          Esta sala é nova? Por favor, confira o link com o Mestre.
          <span className="telao-sala-nova-codigo">sala: {codigo}</span>
        </p>
      )}
      {aviso}
    </div>
  );
}
