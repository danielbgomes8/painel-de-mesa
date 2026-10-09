"use client";

import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { criarFreioDeUso, sortearAbertura, type PapelDeUso } from "@/lib/uso";

/**
 * Marca no banco (tabela `uso`, migration 0033) que esta tela ou ação foi
 * usada neste aparelho. Serve só pra o Mestre ver, na aba Mestre → Sala, o que
 * a mesa abre de verdade. As regras (freio, catálogo, resumo) moram em
 * `lib/uso.ts`.
 *
 * Como o relato de erro: só no site publicado (no `npm run dev` cada clique de
 * teste iria pro banco de verdade), nunca atrapalha o app, e sem internet nem
 * tenta. Não leva nome de pessoa nem conteúdo.
 */

const LIGADO = process.env.NODE_ENV === "production";

const podeMandar = criarFreioDeUso();
const ABERTURA = sortearAbertura();

let contexto: { sala: string | null; papel: PapelDeUso | null } = { sala: null, papel: null };
// Tabela que ainda não existe (migration por rodar): para de tentar nesta abertura.
let semTabela = false;

/** Sala aberta e o papel de quem usa o aparelho. Sem os dois, nada é marcado. */
export function definirContextoDeUso(sala: string | null, papel: PapelDeUso | null): void {
  contexto = { sala, papel };
}

/** Marca o uso de uma tela ou ação (ex.: "aba:combate"). Cada uma vale uma vez por abertura do app. */
export function registrarUso(tela: string): void {
  if (!LIGADO || semTabela || !supabaseConfigurado || typeof window === "undefined") return;
  const { sala, papel } = contexto;
  if (!sala || !papel || navigator.onLine === false) return;
  if (!podeMandar(tela)) return;

  supabase
    .from("uso")
    .insert({ room_code: sala.slice(0, 100), papel, tela, abertura: ABERTURA })
    .then(
      ({ error }) => {
        if (!error) return;
        // PGRST205 / 42P01: a tabela não existe. Qualquer outro erro: some em silêncio, é só estatística.
        if (error.code === "PGRST205" || error.code === "42P01") semTabela = true;
      },
      () => {},
    );
}
