/**
 * Recap da sessão — as regras puras: achar as sessões no histórico do log de
 * combate, contar o que aconteceu em uma delas e escrever o rascunho do
 * diário. A tela só chama estas funções (ver `RecapDaSessao.tsx`).
 *
 * O app não tem "sessão" como coisa própria: o que existe é o log de combate
 * (cada linha com a hora). Uma sessão é um trecho do log sem buraco de mais
 * de 3 horas — dá pra jogar duas noites seguidas e o recap não mistura.
 *
 * O texto das linhas vem dos mesmos lugares que escrevem o log
 * (`mensagemAjustePV`, `resolverTesteMorte`, `mensagemCondicao`... em
 * regras.ts e as linhas do baú/magias): se alguém mudar a frase lá, o
 * teste daqui avisa. Linha que não é reconhecida é ignorada — o recap
 * é um rascunho que o Mestre edita, e contar de menos é melhor que inventar.
 */

import { ehLinhaDoBau } from "./historicoBau";
import { ehLinhaDeTempo } from "./tempoCampanha";

export type LinhaDoLog = { text: string; created_at: string };

export type SessaoDetectada = {
  inicio: string;
  fim: string;
  /** Em ordem cronológica. */
  linhas: LinhaDoLog[];
};

/** Buraco no log que separa uma sessão da outra. */
export const INTERVALO_ENTRE_SESSOES_MS = 3 * 60 * 60 * 1000;
/** Sessão com menos linhas que isso é mexida avulsa (testar o app, corrigir PV), não jogo. */
export const LINHAS_MINIMAS_DA_SESSAO = 5;
/** O diário aceita 2000 caracteres por entrada. */
export const LIMITE_DO_RECAP = 2000;

/** As sessões do histórico, a mais recente primeiro. */
export function detectarSessoes(
  log: LinhaDoLog[],
  { intervaloMs = INTERVALO_ENTRE_SESSOES_MS, minimo = LINHAS_MINIMAS_DA_SESSAO } = {},
): SessaoDetectada[] {
  const ordenadas = log
    .map((l) => ({ l, t: Date.parse(l.created_at) }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);
  const sessoes: SessaoDetectada[] = [];
  let atual: { l: LinhaDoLog; t: number }[] = [];
  const fechar = () => {
    if (atual.length >= minimo) {
      sessoes.push({ inicio: atual[0].l.created_at, fim: atual[atual.length - 1].l.created_at, linhas: atual.map((x) => x.l) });
    }
    atual = [];
  };
  for (const x of ordenadas) {
    if (atual.length > 0 && x.t - atual[atual.length - 1].t > intervaloMs) fechar();
    atual.push(x);
  }
  fechar();
  return sessoes.reverse();
}

export type Resumo = {
  rodadas: number;
  inimigosEntraram: number;
  danoNosInimigos: number;
  /** Por jogador, na ordem em que apareceram no log. */
  jogadores: { nome: string; sofreu: number; recuperou: number }[];
  caidos: { nome: string; vezes: number }[];
  mortos: string[];
  estabilizados: string[];
  concentracoesPerdidas: string[];
  magias: { nome: string; magias: { magia: string; vezes: number }[] }[];
  condicoes: { nome: string; condicao: string }[];
  /** Linhas do baú, como foram escritas no log. */
  bau: string[];
  /** Linhas do tempo da campanha (dias que passaram, efeitos), como foram escritas no log. */
  tempo: string[];
};

function acumular<T>(lista: T[], achar: (x: T) => boolean, novo: () => T): T {
  let x = lista.find(achar);
  if (!x) {
    x = novo();
    lista.push(x);
  }
  return x;
}

/** Tira do fim da frase os parênteses que a conjuração acrescenta ("(espaço de 2º nível)"). */
function nomeDaMagia(resto: string): string {
  let r = resto.trim();
  for (;;) {
    const m = /\s*\((?:espaço de \d+º nível|ritual|larga a concentração em [^)]*)\)$/.exec(r);
    if (!m) return r;
    r = r.slice(0, m.index).trim();
  }
}

/** Conta o que aconteceu nas linhas de uma sessão. `jogadores` são os nomes dos
 *  personagens dos jogadores: quem não é jogador conta como inimigo. */
export function resumirSessao(linhas: LinhaDoLog[], jogadores: string[]): Resumo {
  const sao = new Set(jogadores);
  const r: Resumo = {
    rodadas: 0,
    inimigosEntraram: 0,
    danoNosInimigos: 0,
    jogadores: [],
    caidos: [],
    mortos: [],
    estabilizados: [],
    concentracoesPerdidas: [],
    magias: [],
    condicoes: [],
    bau: [],
    tempo: [],
  };
  const jogador = (nome: string) => acumular(r.jogadores, (j) => j.nome === nome, () => ({ nome, sofreu: 0, recuperou: 0 }));
  const unico = (lista: string[], v: string) => {
    if (!lista.includes(v)) lista.push(v);
  };

  for (const { text: bruto } of linhas) {
    const texto = bruto.trim();
    if (ehLinhaDoBau(texto)) {
      if (r.bau[r.bau.length - 1] !== texto) r.bau.push(texto);
      continue;
    }
    if (ehLinhaDeTempo(texto)) {
      if (r.tempo[r.tempo.length - 1] !== texto) r.tempo.push(texto);
      continue;
    }
    if (/^Rodada \d+ começou$/.test(texto)) {
      r.rodadas++;
      continue;
    }

    let m = /^(.+?) entrou no combate/.exec(texto);
    if (m) {
      if (!sao.has(m[1])) r.inimigosEntraram++;
      continue;
    }

    m = /^(.+?) sofreu (\d+) de dano(?:, todo absorvido pelo PV temporário| \((\d+)\/\d+\))?/.exec(texto);
    if (m) {
      const [, nome, dano, hpDepois] = m;
      if (sao.has(nome)) {
        jogador(nome).sofreu += Number(dano);
        if (hpDepois === "0") {
          acumular(r.caidos, (c) => c.nome === nome, () => ({ nome, vezes: 0 })).vezes++;
        }
      } else {
        r.danoNosInimigos += Number(dano);
      }
      const c = /perdeu a concentração( em .+)?$/.exec(texto);
      if (c) unico(r.concentracoesPerdidas, `${nome}${c[1] ?? ""}`);
      continue;
    }

    m = /^(.+?) recuperou (\d+) PV/.exec(texto);
    if (m) {
      if (sao.has(m[1])) jogador(m[1]).recuperou += Number(m[2]);
      continue;
    }

    m = /^(.+?) perdeu a concentração( em .+)?$/.exec(texto);
    if (m) {
      unico(r.concentracoesPerdidas, `${m[1]}${m[2] ?? ""}`);
      continue;
    }

    m = /^(.+?) (?:falhou o|passou no) teste de morte.*— (morreu|estabilizou)$/.exec(texto);
    if (m) {
      unico(m[2] === "morreu" ? r.mortos : r.estabilizados, m[1]);
      continue;
    }

    m = /^(.+?) conjura (.+)$/.exec(texto);
    if (m) {
      const quem = acumular(r.magias, (x) => x.nome === m![1], () => ({ nome: m![1], magias: [] }));
      const nome = nomeDaMagia(m[2]);
      acumular(quem.magias, (x) => x.magia === nome, () => ({ magia: nome, vezes: 0 })).vezes++;
      continue;
    }

    m = /^(.+?) ficou (.+)$/.exec(texto);
    if (m && sao.has(m[1]) && !r.condicoes.some((c) => c.nome === m![1] && c.condicao === m![2])) {
      r.condicoes.push({ nome: m[1], condicao: m[2] });
    }
  }
  return r;
}

function duracao(inicio: string, fim: string): string {
  const minutos = Math.max(0, Math.round((Date.parse(fim) - Date.parse(inicio)) / 60000));
  const h = Math.floor(minutos / 60);
  const min = minutos % 60;
  if (h === 0) return `${min} min`;
  return min === 0 ? `${h} h` : `${h} h ${String(min).padStart(2, "0")}`;
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O título sugerido: "Sessão de 02/10". */
export function tituloDoRecap(inicio: string): string {
  return `Sessão de ${new Date(inicio).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

/**
 * O rascunho do diário. Seções sem nada são omitidas, e se o texto passar do
 * limite do diário as últimas seções caem (o Mestre ainda vê o resto no log).
 * `cartoes` são os nomes dos cartões do Quadro que o Mestre mostrou à mesa.
 */
export function textoDoRecap(
  sessao: Pick<SessaoDetectada, "inicio" | "fim">,
  resumo: Resumo,
  cartoes: string[] = [],
): string {
  const secoes: string[] = [];
  secoes.push(`${hora(sessao.inicio)} às ${hora(sessao.fim)} (${duracao(sessao.inicio, sessao.fim)}).`);

  const luta: string[] = [];
  if (resumo.rodadas > 0) luta.push(plural(resumo.rodadas, "rodada jogada", "rodadas jogadas"));
  if (resumo.inimigosEntraram > 0) luta.push(`${plural(resumo.inimigosEntraram, "inimigo entrou", "inimigos entraram")} na luta`);
  if (resumo.danoNosInimigos > 0) luta.push(`os inimigos sofreram ${resumo.danoNosInimigos} de dano no total`);
  if (luta.length > 0) secoes.push(`⚔️ Combate: ${luta.join("; ")}.`);

  const vida = resumo.jogadores
    .filter((j) => j.sofreu > 0 || j.recuperou > 0)
    .map((j) => {
      const partes = [];
      if (j.sofreu > 0) partes.push(`sofreu ${j.sofreu} de dano`);
      if (j.recuperou > 0) partes.push(`recuperou ${j.recuperou} PV`);
      return `${j.nome} ${partes.join(" e ")}`;
    });
  if (vida.length > 0) secoes.push(`💥 ${vida.join("; ")}.`);

  if (resumo.caidos.length > 0) {
    secoes.push(
      `🩸 Caíram: ${resumo.caidos.map((c) => (c.vezes > 1 ? `${c.nome} (${c.vezes}×)` : c.nome)).join(", ")}.`,
    );
  }
  if (resumo.mortos.length > 0) secoes.push(`☠️ Morreu: ${resumo.mortos.join(", ")}.`);
  if (resumo.estabilizados.length > 0) secoes.push(`Estabilizou: ${resumo.estabilizados.join(", ")}.`);
  if (resumo.concentracoesPerdidas.length > 0) secoes.push(`🧠 Perdeu a concentração: ${resumo.concentracoesPerdidas.join("; ")}.`);

  if (resumo.magias.length > 0) {
    const linhas = resumo.magias.map(
      (q) => `${q.nome}: ${q.magias.map((x) => (x.vezes > 1 ? `${x.magia} (${x.vezes}×)` : x.magia)).join(", ")}`,
    );
    secoes.push(`🔮 Magias: ${linhas.join("; ")}.`);
  }
  if (resumo.condicoes.length > 0) {
    secoes.push(`Condições: ${resumo.condicoes.map((c) => `${c.nome} ficou ${c.condicao}`).join("; ")}.`);
  }
  if (cartoes.length > 0) secoes.push(`🗂 Mostrado à mesa: ${cartoes.join(", ")}.`);
  if (resumo.tempo.length > 0) secoes.push(`Tempo da campanha:\n${resumo.tempo.join("\n")}`);
  if (resumo.bau.length > 0) secoes.push(`Baú do grupo:\n${resumo.bau.join("\n")}`);

  let texto = "";
  for (const s of secoes) {
    const proximo = texto ? `${texto}\n\n${s}` : s;
    if (proximo.length > LIMITE_DO_RECAP) {
      return `${texto}\n\n…`.slice(0, LIMITE_DO_RECAP);
    }
    texto = proximo;
  }
  return texto;
}
