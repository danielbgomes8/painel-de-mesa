/**
 * Armadilhas no mapa — as regras puras: o que vem do banco, o que cada pessoa enxerga, quando um peão
 * "pisou" e o que o Mestre recebe de aviso.
 *
 * Só o Mestre põe e mexe. A armadilha fica ESCONDIDA da mesa enquanto `armada` (esconde NA TELA, como a
 * névoa e as paredes: o dado está no banco, ver README "Segurança"). Quando um peão entra na zona dela,
 * só o Mestre é avisado — e é ele quem decide se dispara, desarma ou deixa passar.
 */
import { ladoDeReferencia, type Cena } from "./cenas";
import { rolarDado } from "./dados";

export type EstadoArmadilha = "armada" | "revelada" | "disparada" | "desarmada";

/** `armadilha` dispara UMA vez ao ser pisada; `perigo` (fogo, gás, ácido, água gelada) é uma zona que continua
 *  ali: avisa o Mestre quando alguém ENTRA e no INÍCIO DO TURNO de quem está dentro, até ser extinto. */
export type TipoArmadilha = "armadilha" | "perigo";

export type Armadilha = {
  id: string;
  cena_id: string;
  room_code: string;
  nome: string;
  /** Centro, em px da imagem. */
  x: number;
  y: number;
  /** Raio da zona que dispara, em metros a partir do centro. */
  raio: number;
  salvaguarda: string;
  cd: number | null;
  dano: string;
  nota: string;
  estado: EstadoArmadilha;
  tipo: TipoArmadilha;
  /** CD pra um jogador reparar nela só de passar perto (Percepção passiva da ficha >= CD); null = ninguém repara. */
  cd_achar: number | null;
  created_at: string;
};

export type NovaArmadilha = Pick<Armadilha, "nome" | "x" | "y"> & Partial<Pick<Armadilha, "raio" | "salvaguarda" | "cd" | "dano" | "nota" | "tipo" | "estado" | "cd_achar">>;

/** Por cena. Cada uma é redesenhada a cada quadro. */
export const ARMADILHAS_MAXIMAS = 60;
/** O quadradinho de 1,5 m: só quem está nele pisa. Vizinho no centro do quadradinho ao lado fica de fora. */
export const RAIO_PADRAO_M = 0.75;
export const RAIO_MAXIMO_M = 60;
export const NOME_MAXIMO = 40;
export const SALVAGUARDA_MAXIMA = 20;
export const DANO_MAXIMO = 40;
export const NOTA_MAXIMA = 140;
export const CD_MAXIMA = 40;

export const ESTADOS: readonly EstadoArmadilha[] = ["armada", "revelada", "disparada", "desarmada"];
const ROTULO_DO_ESTADO: Record<EstadoArmadilha, string> = {
  armada: "escondida",
  revelada: "revelada",
  disparada: "disparada",
  desarmada: "desarmada",
};
const ROTULO_DO_ESTADO_PERIGO: Record<EstadoArmadilha, string> = {
  armada: "escondido",
  revelada: "ativo",
  disparada: "ativo",
  desarmada: "extinto",
};
export function rotuloDoEstado(e: EstadoArmadilha, tipo: TipoArmadilha = "armadilha"): string {
  return (tipo === "perigo" ? ROTULO_DO_ESTADO_PERIGO : ROTULO_DO_ESTADO)[e];
}

/** Pontos de partida pra o Mestre editar; os números são sugestão, não regra. */
export type ArmadilhaPronta = { nome: string; salvaguarda: string; cd: number | null; dano: string; raio: number };
export const ARMADILHAS_PRONTAS: readonly ArmadilhaPronta[] = [
  { nome: "Poço escondido", salvaguarda: "DES", cd: 12, dano: "2d6 contundente", raio: RAIO_PADRAO_M },
  { nome: "Dardos envenenados", salvaguarda: "DES", cd: 13, dano: "2d4 perfurante", raio: RAIO_PADRAO_M },
  { nome: "Chama oculta", salvaguarda: "DES", cd: 14, dano: "3d6 fogo", raio: 3 },
  { nome: "Rede caindo", salvaguarda: "FOR", cd: 13, dano: "", raio: 3 },
  { nome: "Runa de alarme", salvaguarda: "", cd: null, dano: "", raio: 3 },
];

/** Perigos contínuos prontos, pra o Mestre editar: fogo, gás, ácido, água gelada. Zona maior que a da armadilha. */
export const PERIGOS_PRONTOS: readonly ArmadilhaPronta[] = [
  { nome: "Fogo", salvaguarda: "DES", cd: 13, dano: "1d6 fogo", raio: 3 },
  { nome: "Gás venenoso", salvaguarda: "CON", cd: 13, dano: "1d6 veneno", raio: 4.5 },
  { nome: "Ácido", salvaguarda: "DES", cd: 12, dano: "2d4 ácido", raio: 3 },
  { nome: "Água gelada", salvaguarda: "CON", cd: 12, dano: "1d6 gélido", raio: 4.5 },
];

function numero(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Raio em metros que o app aceita: positivo até o máximo, uma casa decimal. */
export function raioValido(v: unknown): number | null {
  const n = numero(typeof v === "string" ? v.replace(",", ".") : v);
  if (n === null || n <= 0 || n > RAIO_MAXIMO_M) return null;
  const arredondado = Math.round(n * 100) / 100;
  return arredondado > 0 ? arredondado : null;
}

export function cdValida(v: unknown): number | null {
  const n = numero(v);
  if (n === null) return null;
  const i = Math.round(n);
  return i >= 1 && i <= CD_MAXIMA ? i : null;
}

export function normalizarArmadilha(linha: unknown): Armadilha | null {
  if (!linha || typeof linha !== "object") return null;
  const o = linha as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.cena_id !== "string") return null;
  const x = numero(o.x);
  const y = numero(o.y);
  if (x === null || y === null) return null;
  const estado = ESTADOS.find((e) => e === o.estado);
  if (!estado) return null;
  return {
    id: o.id,
    cena_id: o.cena_id,
    room_code: typeof o.room_code === "string" ? o.room_code : "",
    nome: texto(o.nome, NOME_MAXIMO),
    x,
    y,
    raio: raioValido(o.raio) ?? RAIO_PADRAO_M,
    salvaguarda: texto(o.salvaguarda, SALVAGUARDA_MAXIMA),
    cd: cdValida(o.cd),
    dano: texto(o.dano, DANO_MAXIMO),
    nota: texto(o.nota, NOTA_MAXIMA),
    estado,
    tipo: o.tipo === "perigo" ? "perigo" : "armadilha",
    cd_achar: cdValida(o.cd_achar),
    created_at: typeof o.created_at === "string" ? o.created_at : "",
  };
}

/** A mesa só enxerga o que não está escondido; o Mestre, tudo. */
export function armadilhasVisiveis(lista: readonly Armadilha[], mestre: boolean): Armadilha[] {
  return mestre ? [...lista] : lista.filter((a) => a.estado !== "armada");
}

/** Vigia (avisa o Mestre quando alguém pisa): escondida ou revelada. As gastas e as desarmadas não. */
export function vigia(a: Pick<Armadilha, "estado">): boolean {
  return a.estado === "armada" || a.estado === "revelada";
}

/** Nome pra mostrar: vazio vira "Armadilha" (ou "Perigo"). */
export function nomeDaArmadilha(a: Pick<Armadilha, "nome"> & Partial<Pick<Armadilha, "tipo">>): string {
  return a.nome.trim() || (a.tipo === "perigo" ? "Perigo" : "Armadilha");
}

/** "Salvaguarda DES CD 13 · 2d6 contundente" — o que o Mestre precisa na hora; vazio se não há nada. */
export function sugestaoDaArmadilha(a: Pick<Armadilha, "salvaguarda" | "cd" | "dano">): string {
  const partes: string[] = [];
  const salva = a.salvaguarda.trim();
  if (salva || a.cd !== null) partes.push(["Salvaguarda", salva, a.cd !== null ? `CD ${a.cd}` : ""].filter(Boolean).join(" "));
  if (a.dano.trim()) partes.push(a.dano.trim());
  return partes.join(" · ");
}

/** Raio da zona em px da imagem. */
export function raioDaZonaPx(cena: Pick<Cena, "grade_px" | "metros">, raioM: number): number {
  return (raioM * cena.grade_px) / cena.metros;
}

type PecaParaPisar = { id: string; x: number; y: number; espacoPx: number; nome: string; slug?: string | null };

/**
 * O peão está na zona? O centro dele dentro do raio, mais o que o espaço dele passa de um quadradinho
 * (criatura grande, 2×2, pisa mesmo com o centro no cruzamento das linhas).
 */
export function estaNaZona(
  cena: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura" | "metros">,
  a: Pick<Armadilha, "x" | "y" | "raio">,
  p: Pick<PecaParaPisar, "x" | "y" | "espacoPx">,
): boolean {
  const extra = Math.max(0, p.espacoPx - ladoDeReferencia(cena) / 2);
  return Math.hypot(p.x - a.x, p.y - a.y) <= raioDaZonaPx(cena, a.raio) + extra + 0.5;
}

/** O que o app lembra entre uma conferência e outra: quem estava em qual zona, e quais armadilhas já conhecia. */
export type EstadoDePisadas = { dentro: Map<string, Set<string>>; conhecidas: Set<string>; vezDe: string | null };

/** `entrou` = acabou de pisar na zona; `turno` = (só perigo) é o início do turno de quem está dentro dela. */
export type Pisada = { pecaId: string; peca: string; armadilhaId: string; motivo: "entrou" | "turno" };

/**
 * Compara onde cada peão está AGORA com onde estava na conferência anterior e devolve quem acabou de ENTRAR
 * na zona de uma armadilha que vigia. **Só entrar conta**: quem já estava dentro não avisa de novo, a primeira
 * conferência só aprende o terreno, armadilha nova não avisa de quem já estava em cima e peão novo (acabou de
 * ser posto) também não — pôr alguém no mapa não é pisar.
 */
export function avaliarPisadas(
  anterior: EstadoDePisadas | null,
  entrada: {
    cena: Pick<Cena, "grade_ligada" | "grade_px" | "largura" | "altura" | "metros">;
    armadilhas: readonly Armadilha[];
    pecas: readonly PecaParaPisar[];
    /** Slug de quem tem a vez na iniciativa (ou null): a mudança dele é o "início do turno" dos perigos. */
    vezDe?: string | null;
  },
): { estado: EstadoDePisadas; pisadas: Pisada[] } {
  const { cena, armadilhas, pecas } = entrada;
  const vezDe = entrada.vezDe ?? null;
  const turnoMudou = anterior !== null && anterior.vezDe !== vezDe && vezDe !== null;
  const dentro = new Map<string, Set<string>>();
  const pisadas: Pisada[] = [];
  for (const p of pecas) {
    const agora = new Set<string>();
    for (const a of armadilhas) {
      if (!estaNaZona(cena, a, p)) continue;
      agora.add(a.id);
      const antes = anterior?.dentro.get(p.id);
      const sabiaDaArmadilha = anterior?.conhecidas.has(a.id) ?? false;
      if (anterior && antes && sabiaDaArmadilha && !antes.has(a.id) && vigia(a)) {
        pisadas.push({ pecaId: p.id, peca: p.nome, armadilhaId: a.id, motivo: "entrou" });
      } else if (turnoMudou && sabiaDaArmadilha && a.tipo === "perigo" && vigia(a) && p.slug && p.slug === vezDe) {
        // Já estava dentro quando a vez chegou nele: o perigo age no início do turno.
        pisadas.push({ pecaId: p.id, peca: p.nome, armadilhaId: a.id, motivo: "turno" });
      }
    }
    dentro.set(p.id, agora);
  }
  return { estado: { dentro, conhecidas: new Set(armadilhas.map((a) => a.id)), vezDe }, pisadas };
}

// ── Rolar o dano sugerido ──────────────────────────────────────────────────

export type DanoRolado = { total: number; conta: string };

/**
 * Rola os dados escritos no texto do dano ("2d6 contundente", "1d4+2 perfurante + 1d6 veneno"): soma
 * cada `NdM` (e o `+K` colado nele). Texto sem dado devolve null. `rolar` é injetável pra teste.
 */
export function rolarDanoDoTexto(texto: string, rolar: (faces: number) => number = rolarDado): DanoRolado | null {
  const achados = [...texto.toLowerCase().matchAll(/(\d{1,2})d(\d{1,3})(?:\s*([+-])\s*(\d{1,3}))?/g)];
  if (achados.length === 0) return null;
  let total = 0;
  const partes: string[] = [];
  for (const [bruto, n, faces, sinal, fixo] of achados) {
    const dados: number[] = [];
    for (let i = 0; i < Number(n); i++) dados.push(rolar(Number(faces)));
    const soma = dados.reduce((s, d) => s + d, 0);
    const bonus = fixo ? (sinal === "-" ? -Number(fixo) : Number(fixo)) : 0;
    total += soma + bonus;
    partes.push(`${bruto.replace(/\s+/g, "")}: ${dados.join("+")}${bonus ? (bonus > 0 ? `+${bonus}` : `${bonus}`) : ""}`);
  }
  return { total: Math.max(0, total), conta: partes.join(" · ") };
}

// ── Linhas do log ─────────────────────────────────────────────────────────

/** Sai no log quando o Mestre dispara: a mesa passa a ver a armadilha de qualquer jeito. */
export function linhaDeDisparo(quem: string, a: Pick<Armadilha, "nome" | "salvaguarda" | "cd">): string {
  const salva = [a.salvaguarda.trim(), a.cd !== null ? `CD ${a.cd}` : ""].filter(Boolean).join(" ");
  return `⚠️ ${quem} caiu em ${nomeDaArmadilha(a)}.${salva ? ` Salvaguarda ${salva}.` : ""}`;
}

export function linhaDeDesarme(quem: string | null, a: Pick<Armadilha, "nome"> & Partial<Pick<Armadilha, "tipo">>): string {
  return a.tipo === "perigo" ? `🧯 ${nomeDaArmadilha(a)} foi extinto${quem ? ` (${quem})` : ""}.` : `🛠️ ${nomeDaArmadilha(a)} foi desarmada${quem ? ` (${quem})` : ""}.`;
}

/** Sai no log quando o Mestre registra que o perigo pegou alguém (ao entrar ou no início do turno). */
export function linhaDePerigo(quem: string, a: Pick<Armadilha, "nome" | "salvaguarda" | "cd">, motivo: "entrou" | "turno"): string {
  const salva = [a.salvaguarda.trim(), a.cd !== null ? `CD ${a.cd}` : ""].filter(Boolean).join(" ");
  const quando = motivo === "turno" ? "começou o turno em" : "entrou em";
  return `☠️ ${quem} ${quando} ${nomeDaArmadilha({ ...a, tipo: "perigo" })}.${salva ? ` Salvaguarda ${salva}.` : ""}`;
}
