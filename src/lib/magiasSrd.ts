/**
 * Catálogo de magias do SRD 5.2 (D&D 2024) — busca e conversão pra magia do
 * personagem. Os dados moram em `magiasSrdGerados.ts` (gerado por
 * `scripts/gerar-magias-srd.mjs`, não editar à mão). Este módulo é pesado
 * (~340 KB) e só baixa quando a tela de magias abre — ver `useCatalogoMagias`.
 */
import { MAGIAS_GERADAS } from "./magiasSrdGerados";
import { magiaNova } from "./magias";
import type { MagiaPersonagem } from "./tipos";

export type MagiaCatalogo = {
  /** Nome original, em inglês. */
  en: string;
  /** Nome em português (o original quando não há tradução conhecida). */
  nome: string;
  nivel: number;
  escola: string;
  tempo: string;
  alcance: string;
  duracao: string;
  componentes: string;
  concentracao: boolean;
  ritual: boolean;
  classes: string[];
  /** "Ataque de magia", "Salvaguarda de Destreza"... ou vazio. */
  teste: string;
  /** "8d6 fogo" — vazio quando a magia não causa dano direto. */
  dano: string;
  /** Só pra reação: quando ela pode ser usada. */
  gatilho: string;
  texto: string;
  /** "Em níveis superiores", quando há. */
  superior: string;
};

export const MAGIAS_SRD: MagiaCatalogo[] = MAGIAS_GERADAS;

/** Minúscula e sem acento — a busca ignora os dois. */
function chave(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export type FiltroMagias = {
  texto?: string;
  nivel?: number | null;
  classe?: string | null;
  soConcentracao?: boolean;
  soRitual?: boolean;
};

/** Os nomes mais curtos e que começam com a busca vêm primeiro; depois quem só
 *  contém. Acha pelo nome em português e pelo original em inglês. */
export function buscarMagias(filtro: FiltroMagias, limite = 40, catalogo: MagiaCatalogo[] = MAGIAS_SRD): MagiaCatalogo[] {
  const q = chave((filtro.texto ?? "").trim());
  const achadas = catalogo.filter((m) => {
    if (filtro.nivel != null && m.nivel !== filtro.nivel) return false;
    if (filtro.classe && !m.classes.includes(filtro.classe)) return false;
    if (filtro.soConcentracao && !m.concentracao) return false;
    if (filtro.soRitual && !m.ritual) return false;
    if (!q) return true;
    return chave(m.nome).includes(q) || chave(m.en).includes(q);
  });
  const nota = (m: MagiaCatalogo) => {
    if (!q) return 2;
    const a = chave(m.nome);
    const b = chave(m.en);
    return a.startsWith(q) || b.startsWith(q) ? 0 : 1;
  };
  return achadas
    .sort((a, b) => nota(a) - nota(b) || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, limite);
}

export const CLASSES_CONJURADORAS = ["Bardo", "Bruxo", "Clérigo", "Druida", "Feiticeiro", "Mago", "Paladino", "Patrulheiro"];

/** A magia do catálogo como entra na lista do personagem: os dados de consulta
 *  preenchidos e o texto montado (gatilho da reação, teste, dano, regra e
 *  "em níveis superiores"). */
export function magiaDoCatalogo(m: MagiaCatalogo): MagiaPersonagem {
  const partes: string[] = [];
  if (m.gatilho) partes.push(`Gatilho da reação: ${m.gatilho}`);
  const resumo = [m.teste, m.dano && `Dano: ${m.dano}`].filter(Boolean).join(" · ");
  if (resumo) partes.push(resumo);
  partes.push(m.texto);
  if (m.superior) partes.push(`Em níveis superiores: ${m.superior}`);
  return {
    ...magiaNova(m.nome, m.nivel),
    concentracao: m.concentracao,
    ritual: m.ritual,
    escola: m.escola,
    tempo: m.tempo,
    alcance: m.alcance,
    duracao: m.duracao,
    componentes: m.componentes,
    descricao: partes.join("\n\n").slice(0, 4000),
  };
}
