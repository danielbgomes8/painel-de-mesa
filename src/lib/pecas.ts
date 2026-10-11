/**
 * Peões no mapa — as fichas e os marcadores sobre a cena. Tudo puro: o banco e
 * o canvas ficam em outro lugar; aqui moram as contas (encaixe na grade, quem
 * pode mover, o que cada pessoa enxerga, o rótulo sem entregar inimigo).
 *
 * Regras que vêm do resto do app e valem aqui também:
 * - NPC não revelado aparece como "?" pra jogador (nunca o nome, igual ao
 *   "Inimigo N" da ordem de iniciativa) e PV de NPC nunca aparece;
 * - o telão e os celulares tratam quem olha como jogador;
 * - peão sob a névoa não aparece pra mesa, a não ser o do próprio jogador.
 */
import { metrosParaPx } from "./area";
import { celulaNoPonto, gradeUsavel, ladoDeReferencia, type Cena, type Ponto, type Regiao } from "./cenas";
import { andarComParedes, passoBloqueado } from "./paredes";
import { corDoJogador } from "./ping";
import type { Segmento } from "./visao";
import { CONDICOES, ICONE_CONDICAO, ICONE_EXAUSTAO, condicoesAtivas } from "./condicoes";
import { estaCaido } from "./regras";
import { lerLuz, luzCompartilhadaPx, visaoDoPortadorPx, type Luz } from "./luzes";

export type TamanhoPeca = 1 | 2 | 3 | 4;

/** Um peão como está no banco (x, y = centro, em px da imagem da cena). */
export type Peca = {
  id: string;
  cena_id: string;
  room_code: string;
  /** Ficha ligada (`characters.slug`); null = marcador avulso. */
  slug: string | null;
  nome: string;
  x: number;
  y: number;
  /** Lado em quadradinhos: 1 = pequeno/médio, 2 = grande, 3 = enorme, 4 = imenso. */
  tamanho: TamanhoPeca;
  cor: string | null;
  /** Escondido da mesa; só o Mestre vê. */
  oculto: boolean;
  /** Aura (emanação): raio em metros a partir da borda do espaço dele; null = sem aura. */
  aura: number | null;
  /** A luz que ele carrega (tocha, lamparina...); null = sem luz. Ver lib/luzes.ts. */
  luz: Luz | null;
  created_at: string;
};

/** Raio máximo de uma aura (o banco também cobra isto): passa de qualquer magia do SRD. */
export const AURA_MAXIMA_M = 120;
/** Raios prontos, em metros: 1,5 / 3 / 4,5 (a de 15 pés de Guardiões Espirituais) / 6 / 9. */
export const AURAS_PRONTAS_M = [1.5, 3, 4.5, 6, 9] as const;

/** A aura que o app aceita: número positivo até o máximo, com no máximo uma casa
 *  decimal (o resto vira ruído de digitação). Qualquer outra coisa = sem aura. */
export function auraValida(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > AURA_MAXIMA_M) return null;
  const arredondado = Math.round(n * 10) / 10;
  return arredondado > 0 ? arredondado : null;
}

export type NovaPeca = Pick<Peca, "slug" | "nome" | "x" | "y"> & Partial<Pick<Peca, "tamanho" | "cor" | "oculto">>;

/** Uma condição desenhada no peão. */
export type IconePeca = {
  /** "Cego", "Exaustão"... — também é o texto de leitor de tela e da legenda. */
  nome: string;
  emoji: string;
  cor: string;
  /** Só na exaustão: o nível (1 a 6), desenhado pequeno no canto do ícone. */
  nivel?: number;
};

/** O que o canvas desenha: já com rótulo, cor e "é a vez dele" calculados. */
export type PecaNaTela = {
  id: string;
  x: number;
  y: number;
  /** Lado em quadradinhos (1 a 4). */
  tamanho: TamanhoPeca;
  /** Diâmetro em px da imagem. */
  diametro: number;
  /** Letras dentro do peão. */
  rotulo: string;
  /** Nome completo (pra leitor de tela e dica); "?" pra inimigo não revelado. */
  nome: string;
  cor: string;
  oculto: boolean;
  /** É a vez dele na iniciativa. */
  vez: boolean;
  selecionada: boolean;
  /** Quem olha pode arrastá-lo. */
  podeMover: boolean;
  /** Deslocamento da ficha em metros, pra a régua dizer "cabe nos 9 m". Só quem
   *  pode mexer no peão enxerga: o deslocamento de um inimigo é do Mestre. */
  deslocamento: number | null;
  /** Aparece mesmo coberto de névoa (o Mestre vê tudo; o jogador vê o próprio). */
  semNevoa: boolean;
  /** Condições de quem o peão representa, na ordem de `iconesDaPeca`. */
  icones: IconePeca[];
  /** É o peão de um jogador: com a visão automática ligada, a névoa se abre pelo que ele enxerga. */
  observa: boolean;
  /** É o peão de um inimigo: só o Mestre pode pedir pra ver o que ele enxerga. */
  inimigo: boolean;
  /** Aura em metros (null = sem) e o raio dela em px da imagem, já contado a partir da
   *  BORDA do espaço da criatura (o D&D mede a emanação dali, não do centro). */
  aura: number | null;
  auraPx: number;
  /** Raio do ESPAÇO da criatura (px da imagem): metade do lado × o tamanho. É o que
   *  conta pra "está dentro da área" (qualquer parte do espaço dentro vale), não o
   *  diâmetro desenhado, que é um pouco menor. */
  espacoPx: number;
  /** Até onde este jogador enxerga em px da imagem, num mapa ESCURO (a luz que ele carrega); null = como a cena manda. */
  visaoPx: number | null;
  /** Até onde a luz que ele carrega ilumina em volta (px da imagem), pra quem estiver vendo; null = não ilumina
   *  (mapa claro, sem luz, luz apagada, visão no escuro, ou peão oculto: a luz entregaria onde ele está). */
  luzPx: number | null;
};

export const COR_PECA_INIMIGO = "#c0443a";
export const COR_PECA_MARCADOR = "#8a97a8";
const COR_VALIDA = /^#[0-9a-fA-F]{6}$/;

function numero(v: unknown, padrao: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : padrao;
}

export function normalizarPeca(linha: unknown): Peca | null {
  if (!linha || typeof linha !== "object") return null;
  const o = linha as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.cena_id !== "string") return null;
  const x = typeof o.x === "string" ? Number(o.x) : o.x;
  const y = typeof o.y === "string" ? Number(o.y) : o.y;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const tam = Math.round(numero(o.tamanho, 1));
  return {
    id: o.id,
    cena_id: o.cena_id,
    room_code: typeof o.room_code === "string" ? o.room_code : "",
    slug: typeof o.slug === "string" && o.slug ? o.slug : null,
    nome: typeof o.nome === "string" ? o.nome.slice(0, 30) : "",
    x,
    y,
    tamanho: (tam >= 1 && tam <= 4 ? tam : 1) as TamanhoPeca,
    cor: typeof o.cor === "string" && COR_VALIDA.test(o.cor) ? o.cor : null,
    oculto: o.oculto === true,
    aura: auraValida(o.aura),
    luz: lerLuz(o),
    created_at: typeof o.created_at === "string" ? o.created_at : "",
  };
}

// ── Posição ────────────────────────────────────────────────────────────────

/** Diâmetro do peão: um pouco menos que o quadradinho, pra não encostar no vizinho. */
export function diametroDaPeca(c: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura">, tamanho: TamanhoPeca): number {
  return ladoDeReferencia(c) * tamanho * 0.88;
}

/**
 * Encaixa o ponto na grade: peão de tamanho ímpar vai pro CENTRO do
 * quadradinho; de tamanho par (2×2, 4×4) vai pro CRUZAMENTO das linhas, que é
 * onde fica o centro dele. Sem grade, só mantém dentro da imagem.
 */
export function encaixarNaGrade(
  c: Pick<Cena, "grade_ligada" | "grade_px" | "grade_dx" | "grade_dy" | "largura" | "altura">,
  x: number,
  y: number,
  tamanho: TamanhoPeca,
): Ponto {
  const dentro = (px: number, py: number): Ponto => [
    Math.round(Math.min(c.largura, Math.max(0, px)) * 10) / 10,
    Math.round(Math.min(c.altura, Math.max(0, py)) * 10) / 10,
  ];
  if (!gradeUsavel(c)) return dentro(x, y);
  const g = c.grade_px;
  if (tamanho % 2 === 1) {
    const { col, row } = celulaNoPonto(c, x, y);
    return dentro(c.grade_dx + (col + 0.5) * g, c.grade_dy + (row + 0.5) * g);
  }
  return dentro(c.grade_dx + Math.round((x - c.grade_dx) / g) * g, c.grade_dy + Math.round((y - c.grade_dy) / g) * g);
}

/** Posições de partida pra `n` peões novos: numa fileira centrada no meio do
 *  que se está vendo, um por quadradinho. Se esse lugar já tem peão (o grupo
 *  entrou, agora entram os inimigos), a fileira desce — ou sobe — até achar um
 *  trecho livre, em vez de empilhar um peão em cima do outro. */
export function posicoesIniciais(
  c: Pick<Cena, "grade_ligada" | "grade_px" | "grade_dx" | "grade_dy" | "largura" | "altura">,
  n: number,
  regiao: Regiao | null,
  ocupadas: readonly Ponto[] = [],
): Ponto[] {
  const lado = ladoDeReferencia(c);
  const centro: Ponto = regiao ? [regiao.x + regiao.w / 2, regiao.y + regiao.h / 2] : [c.largura / 2, c.altura / 2];
  // Quantos cabem na largura que se vê; o resto desce uma fileira.
  const porLinha = Math.max(1, Math.min(n, regiao ? Math.floor(regiao.w / lado) - 1 : 8, 10));
  const montar = (deslocamentoDeFileiras: number): Ponto[] => {
    const saida: Ponto[] = [];
    for (let i = 0; i < n; i++) {
      const col = i % porLinha;
      const lin = Math.floor(i / porLinha) + deslocamentoDeFileiras;
      const largura = Math.min(n - Math.floor(i / porLinha) * porLinha, porLinha);
      const x = centro[0] + (col - (largura - 1) / 2) * lado;
      const y = centro[1] + lin * lado;
      saida.push(encaixarNaGrade(c, x, y, 1));
    }
    return saida;
  };
  const livre = (ps: Ponto[]) =>
    ps.every(([x, y]) => !ocupadas.some(([ox, oy]) => Math.hypot(x - ox, y - oy) < lado * 0.6));
  // Tenta 0, +1, -1, +2, -2... fileiras de deslocamento; sem trecho livre, fica no primeiro.
  for (let k = 0; k <= 24; k++) {
    for (const d of k === 0 ? [0] : [k, -k]) {
      const ps = montar(d);
      if (livre(ps)) return ps;
    }
  }
  return montar(0);
}

// ── Iniciativa → mapa ──────────────────────────────────────────────────────

/** Tamanho do peão pelo tipo escrito na ficha: o catálogo de monstros põe o
 *  tamanho no `cls` ("Fera grande", "Dragão imenso" — ver monstrosSrd.ts).
 *  Sem tamanho reconhecível, um quadradinho (pequeno, médio e miúdo ocupam um). */
export function tamanhoPeloTipo(cls: string | null | undefined): TamanhoPeca {
  const t = ` ${(cls ?? "").toLowerCase()} `;
  if (/[\s(]imens[oa][\s,)]/.test(t) || t.includes(" gargantuan ")) return 4;
  if (/[\s(]enorme[\s,)]/.test(t) || t.includes(" huge ")) return 3;
  if (/[\s(]grande[\s,)]/.test(t) || t.includes(" large ")) return 2;
  return 1;
}

type FichaQueEntra = { slug: string; is_npc: boolean; cls?: string };

/**
 * Os peões que nascem quando inimigos entram na iniciativa com um mapa na
 * mesa: só NPC (o grupo o Mestre põe quando quer), só quem ainda não tem peão
 * nesta cena, OCULTOS (a mesa não vê até o Mestre mostrar, como em "pôr os
 * inimigos da iniciativa") e no meio do pedaço que a mesa está vendo, sem cair
 * em cima de ninguém. O tamanho vem do tipo da ficha.
 */
export function pecasDosQueEntram(entrada: {
  cena: Pick<Cena, "grade_ligada" | "grade_px" | "grade_dx" | "grade_dy" | "largura" | "altura" | "camera">;
  fichas: readonly FichaQueEntra[];
  existentes: readonly Pick<Peca, "slug" | "x" | "y">[];
}): NovaPeca[] {
  const { cena, fichas, existentes } = entrada;
  const jaTem = new Set(existentes.map((p) => p.slug).filter((s): s is string => Boolean(s)));
  const faltam: FichaQueEntra[] = [];
  for (const f of fichas) {
    if (!f.is_npc || jaTem.has(f.slug)) continue;
    jaTem.add(f.slug);
    faltam.push(f);
  }
  if (faltam.length === 0) return [];
  const lugares = posicoesIniciais(cena, faltam.length, cena.camera, existentes.map((p) => [p.x, p.y]));
  return faltam.map((f, i) => {
    const tamanho = tamanhoPeloTipo(f.cls);
    const [x, y] = encaixarNaGrade(cena, lugares[i][0], lugares[i][1], tamanho);
    return { slug: f.slug, nome: "", x, y, tamanho, oculto: true };
  });
}

type CompanheiroQueEntra = { slug: string; cls?: string; dono: string };

/**
 * Os peões dos companheiros (familiar, montaria, animal companheiro) de quem está na iniciativa, com um mapa na
 * mesa: cada um nasce VISÍVEL (é aliado) e ENCOSTADO no peão do dono, no primeiro quadradinho livre em volta (do
 * lado, depois embaixo, em cima e as diagonais, e assim em anéis). Dono sem peão neste mapa: o companheiro cai no
 * meio do que a mesa vê, sem cair em cima de ninguém. Quem já tem peão nesta cena não ganha outro. O tamanho vem
 * do tipo da ficha. Depois, anda junto com o dono (`pecasQueAcompanham`), a não ser que a mesa desligue.
 */
export function pecasDosCompanheiros(entrada: {
  cena: Pick<Cena, "grade_ligada" | "grade_px" | "grade_dx" | "grade_dy" | "largura" | "altura" | "camera">;
  companheiros: readonly CompanheiroQueEntra[];
  existentes: readonly Pick<Peca, "slug" | "x" | "y" | "tamanho">[];
}): NovaPeca[] {
  const { cena, companheiros, existentes } = entrada;
  const lado = ladoDeReferencia(cena);
  const jaTem = new Set(existentes.map((p) => p.slug).filter((s): s is string => Boolean(s)));
  const ocupadas: { x: number; y: number; t: number }[] = existentes.map((p) => ({ x: p.x, y: p.y, t: p.tamanho }));
  const saida: NovaPeca[] = [];
  for (const c of companheiros) {
    if (jaTem.has(c.slug)) continue;
    jaTem.add(c.slug);
    const tamanho = tamanhoPeloTipo(c.cls);
    const dono = existentes.find((p) => p.slug === c.dono);
    let ponto: Ponto;
    if (dono) {
      const passo = (lado * (dono.tamanho + tamanho)) / 2;
      const deslocar = (n: number) => (n === 0 ? 0 : Math.sign(n) * (passo + (Math.abs(n) - 1) * lado));
      const candidatos: Ponto[] = [];
      for (let k = 1; k <= 4; k++) {
        const anel: [number, number][] = [];
        for (let dx = -k; dx <= k; dx++) for (let dy = -k; dy <= k; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === k) anel.push([dx, dy]);
        anel.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || b[0] - a[0] || b[1] - a[1]);
        for (const [dx, dy] of anel) candidatos.push(encaixarNaGrade(cena, dono.x + deslocar(dx), dono.y + deslocar(dy), tamanho));
      }
      const livre = (p: Ponto) => ocupadas.every((o) => Math.hypot(p[0] - o.x, p[1] - o.y) >= (lado * (o.t + tamanho)) / 2 * 0.7);
      ponto = candidatos.find(livre) ?? encaixarNaGrade(cena, dono.x + passo, dono.y, tamanho);
    } else {
      ponto = encaixarNaGrade(cena, ...posicoesIniciais(cena, 1, cena.camera, ocupadas.map((o) => [o.x, o.y]))[0], tamanho);
    }
    ocupadas.push({ x: ponto[0], y: ponto[1], t: tamanho });
    saida.push({ slug: c.slug, nome: "", x: ponto[0], y: ponto[1], tamanho, oculto: false });
  }
  return saida;
}

/**
 * Quando o peão do dono anda, os dos companheiros dele andam o MESMO deslocamento (montaria, familiar que acompanha), de
 * modo que continuam encostados. Devolve só os que mudam de lugar. Cada um é encaixado na grade e fica dentro do mapa
 * (junto da borda, o companheiro pode acabar mais perto do dono do que antes). **Parede e porta fechada seguram o
 * companheiro como seguram o jogador** (`bloqueios`, ver `segmentosQueBloqueiam`): ele encosta e desliza, e se nem
 * assim dá, fica onde está — mesmo que o Mestre tenha passado o dono por cima da parede. Peão que não é de ficha, ou de
 * ficha sem dono, nunca é arrastado.
 */
export function pecasQueAcompanham(entrada: {
  cena: Pick<Cena, "grade_ligada" | "grade_px" | "grade_dx" | "grade_dy" | "largura" | "altura">;
  pecas: readonly Pick<Peca, "id" | "slug" | "x" | "y" | "tamanho">[];
  /** Peão que o dono acabou de mover e o ponto novo dele. */
  movida: { id: string; x: number; y: number };
  /** slug do companheiro → slug do dono. */
  donos: Readonly<Record<string, string>>;
  /** Paredes e portas fechadas (px da imagem); vazio = nada segura. */
  bloqueios?: readonly Segmento[];
}): { id: string; x: number; y: number }[] {
  const { cena, pecas, movida, donos, bloqueios = [] } = entrada;
  const dono = pecas.find((p) => p.id === movida.id);
  if (!dono?.slug) return [];
  const dx = movida.x - dono.x;
  const dy = movida.y - dono.y;
  if (dx === 0 && dy === 0) return [];
  const saida: { id: string; x: number; y: number }[] = [];
  for (const p of pecas) {
    if (!p.slug || p.id === dono.id || donos[p.slug] !== dono.slug) continue;
    const de: Ponto = [p.x, p.y];
    const querIr = encaixarNaGrade(cena, p.x + dx, p.y + dy, p.tamanho);
    // Anda até onde a parede deixar; o ponto de chegada é encaixado na grade e só vale se o caminho até ele está livre.
    const alcancado = andarComParedes(de, querIr, bloqueios);
    const [x, y] = encaixarNaGrade(cena, alcancado[0], alcancado[1], p.tamanho);
    if (passoBloqueado(de, [x, y], bloqueios)) continue;
    if (x !== p.x || y !== p.y) saida.push({ id: p.id, x, y });
  }
  return saida;
}

/** Um trecho do mapa em volta de `ponto` (de `quadradinhos` de lado), pra
 *  `posicoesIniciais` agrupar os peões ali em vez de no meio da tela — é o que
 *  faz "pôr o grupo onde eu tocar". */
export function regiaoEmTornoDe(
  c: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura">,
  ponto: Ponto,
  quadradinhos = 6,
): Regiao {
  const lado = ladoDeReferencia(c) * quadradinhos;
  return { x: ponto[0] - lado / 2, y: ponto[1] - lado / 2, w: lado, h: lado };
}

/** O peão mais "por cima" (o último da lista) que contém o ponto, entre os candidatos. */
export function acharPecaNoPonto(pecas: readonly PecaNaTela[], x: number, y: number): PecaNaTela | null {
  for (let i = pecas.length - 1; i >= 0; i--) {
    const p = pecas[i];
    if (Math.hypot(x - p.x, y - p.y) <= p.diametro / 2) return p;
  }
  return null;
}

// ── Quem vê e quem mexe ────────────────────────────────────────────────────

export type Visao = { mestre: boolean; meuSlug: string | null };

/** O Mestre mexe em qualquer peão; o jogador, só no da própria ficha. */
export function podeMoverPeca(peca: Pick<Peca, "slug">, v: Visao): boolean {
  return v.mestre || (peca.slug !== null && peca.slug === v.meuSlug);
}

/** O peão aparece pra esta pessoa? `cobertoDeNevoa` = o centro dele está na névoa. */
export function pecaVisivel(peca: Pick<Peca, "slug" | "oculto">, v: Visao, cobertoDeNevoa: boolean): boolean {
  if (v.mestre) return true;
  if (peca.slug !== null && peca.slug === v.meuSlug) return true;
  return !peca.oculto && !cobertoDeNevoa;
}

// ── Rótulo ─────────────────────────────────────────────────────────────────

/** Letras do peão: "Tibério Vaz" → "TV", "Goblin 2" → "G2", "Milo" → "Mi". */
export function iniciais(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return "?";
  if (palavras.length === 1) {
    const w = palavras[0];
    return w.length === 1 ? w.toUpperCase() : w[0].toUpperCase() + w[1].toLowerCase();
  }
  const ultima = palavras[palavras.length - 1];
  if (/^\d{1,2}$/.test(ultima)) return palavras[0][0].toUpperCase() + ultima;
  return (palavras[0][0] + palavras[1][0]).toUpperCase();
}

type FichaParaPeca = {
  slug: string;
  name: string;
  is_npc: boolean;
  revealed: boolean;
  speed?: number;
  /** Pra desenhar as condições no peão; sem isso o peão sai limpo. */
  cond?: Record<string, boolean>;
  exh?: number;
  hp?: number;
};

/** Os ícones de condição que a mesa vê no peão. Mesma regra da ordem de
 *  iniciativa e do telão: valem pra todo mundo ver, inimigo oculto inclusive
 *  (o log já anuncia "Um inimigo ficou Atordoado", e é o que decide se o
 *  ataque tem vantagem). Jogador a 0 PV ganha o Inconsciente, que é a condição
 *  que ele tem pelas regras mesmo sem ninguém ligar; inimigo a 0 PV não entra
 *  nisso — o PV dele é informação do Mestre. Marcador sem ficha não tem nada. */
export function iconesDaPeca(ficha: FichaParaPeca | undefined): IconePeca[] {
  if (!ficha) return [];
  const nomes = new Set<string>(condicoesAtivas(ficha.cond));
  if (!ficha.is_npc && typeof ficha.hp === "number" && estaCaido(ficha.hp)) nomes.add("Inconsciente");
  // Inconsciente primeiro (é o que mais pesa); depois a ordem dos chips.
  const lista: IconePeca[] = [];
  for (const nome of ["Inconsciente", ...CONDICOES]) {
    if (!nomes.delete(nome)) continue;
    const icone = ICONE_CONDICAO[nome as keyof typeof ICONE_CONDICAO];
    lista.push({ nome, ...icone });
  }
  const exaustao = Math.floor(ficha.exh ?? 0);
  if (exaustao > 0) lista.push({ nome: "Exaustão", ...ICONE_EXAUSTAO, nivel: Math.min(exaustao, 6) });
  return lista;
}

/** Quantos ícones cabem em volta do peão antes de virar "+N". */
export const ICONES_MAXIMOS_NO_PEAO = 4;

/** Quais ícones desenhar e quantos ficaram de fora: com mais de 4, mostra 3 e o
 *  resto vira um "+N". */
export function iconesVisiveis(icones: readonly IconePeca[]): { mostrar: IconePeca[]; extras: number } {
  if (icones.length <= ICONES_MAXIMOS_NO_PEAO) return { mostrar: [...icones], extras: 0 };
  const mostrar = icones.slice(0, ICONES_MAXIMOS_NO_PEAO - 1);
  return { mostrar, extras: icones.length - mostrar.length };
}

/** Onde cada ícone fica, em relação ao centro do peão, sobre a borda (raio `r`):
 *  começa no alto à direita e vai se afastando pra esquerda por cima, sem um
 *  encostar no outro (o espaçamento do arco é o diâmetro do ícone). `raioIcone`
 *  é o raio de cada ícone. */
export function posicoesDosIcones(quantos: number, r: number, raioIcone: number): { dx: number; dy: number }[] {
  if (quantos <= 0 || r <= 0) return [];
  // Ângulo entre dois ícones vizinhos pra a corda na borda ser o diâmetro dele.
  const passo = 2 * Math.asin(Math.min(1, raioIcone / r));
  const inicio = -Math.PI / 4; // alto à direita (o eixo y da tela cresce pra baixo)
  return Array.from({ length: quantos }, (_, i) => {
    const a = inicio - i * passo;
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r };
  });
}

/** O nome que esta pessoa pode ler no peão: o do marcador, o da ficha, ou "?"
 *  quando é um inimigo que a mesa ainda não conhece. */
export function nomeDaPeca(peca: Pick<Peca, "slug" | "nome">, ficha: FichaParaPeca | undefined, souMestre: boolean): string {
  if (!ficha) return peca.nome || "?";
  if (souMestre || !ficha.is_npc || ficha.revealed) return ficha.name;
  return "?";
}

/** Tudo que o canvas precisa saber de cada peão, do ponto de vista de `visao`. */
/** Raio da aura em px da imagem: a borda do espaço da criatura (metade do lado × o
 *  tamanho) mais a distância da aura. Sem aura, 0. */
export function raioDaAuraPx(
  cena: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura" | "metros">,
  tamanho: TamanhoPeca,
  aura: number | null,
): number {
  if (aura === null) return 0;
  return (tamanho * ladoDeReferencia(cena)) / 2 + metrosParaPx(cena, aura);
}

export function montarPecasNaTela(entrada: {
  pecas: readonly Peca[];
  cena: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura" | "metros"> & Partial<Pick<Cena, "escura" | "visao_alcance">>;
  fichas: readonly FichaParaPeca[];
  /** Slug de quem tem a vez na iniciativa (ou null). */
  vezDe: string | null;
  slugsDosJogadores: readonly string[];
  visao: Visao;
  selecionadaId: string | null;
}): PecaNaTela[] {
  const { pecas, cena, fichas, vezDe, slugsDosJogadores, visao, selecionadaId } = entrada;
  return pecas.map((p) => {
    const ficha = p.slug ? fichas.find((f) => f.slug === p.slug) : undefined;
    const nome = nomeDaPeca(p, ficha, visao.mestre);
    const cor = p.cor ?? corDoPeca(p, ficha, slugsDosJogadores);
    return {
      id: p.id,
      x: p.x,
      y: p.y,
      tamanho: p.tamanho,
      diametro: diametroDaPeca(cena, p.tamanho),
      rotulo: nome === "?" ? "?" : iniciais(nome),
      nome,
      cor,
      oculto: p.oculto,
      vez: p.slug !== null && p.slug === vezDe,
      selecionada: p.id === selecionadaId,
      podeMover: podeMoverPeca(p, visao),
      deslocamento: podeMoverPeca(p, visao) && ficha && typeof ficha.speed === "number" && ficha.speed > 0 ? ficha.speed : null,
      semNevoa: visao.mestre || (p.slug !== null && p.slug === visao.meuSlug),
      icones: iconesDaPeca(ficha),
      observa: Boolean(ficha) && !ficha?.is_npc,
      inimigo: Boolean(ficha?.is_npc),
      aura: p.aura,
      auraPx: raioDaAuraPx(cena, p.tamanho, p.aura),
      espacoPx: (p.tamanho * ladoDeReferencia(cena)) / 2,
      visaoPx: visaoDoPortadorPx({ escura: false, visao_alcance: null, ...cena }, p.luz, Boolean(ficha) && !ficha?.is_npc),
      luzPx: p.oculto ? null : luzCompartilhadaPx({ escura: false, visao_alcance: null, ...cena }, p.luz),
    };
  });
}

/** Jogador com a cor dele (a mesma do ping), inimigo vermelho, marcador cinza. */
function corDoPeca(peca: Pick<Peca, "slug">, ficha: FichaParaPeca | undefined, slugsDosJogadores: readonly string[]): string {
  if (!peca.slug || !ficha) return COR_PECA_MARCADOR;
  if (ficha.is_npc) return COR_PECA_INIMIGO;
  return corDoJogador(peca.slug, slugsDosJogadores, ficha.name);
}

