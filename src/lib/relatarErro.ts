"use client";

import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { LIMITES_ERRO, criarFreio, cortar, deveRelatar, resumirErro } from "@/lib/erros";

/**
 * Manda pro banco (tabela `erros`, migration 0017) um resumo do que deu
 * errado neste aparelho — antes ficava só no console, e ninguém via o erro
 * que aconteceu no celular de um jogador no meio da sessão. As regras (o que
 * vale relatar, o resumo, o freio) moram em `lib/erros.ts`.
 *
 * Só no site publicado: no `npm run dev` cada erro de edição iria pro banco
 * de verdade. O relato nunca atrapalha o app — se não der pra mandar, fica
 * só o console, como antes.
 */

const LIGADO = process.env.NODE_ENV === "production";

/** Commit publicado (o Vercel preenche no build); fora dele, "local". */
const VERSAO = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "local";

const podeMandar = criarFreio();

let contexto: { sala: string | null; quem: string | null } = { sala: null, quem: null };

/** Sala aberta e quem está usando o aparelho, pra ir junto de cada relato. */
export function definirContextoDoErro(sala: string | null, quem: string | null): void {
  contexto = { sala, quem };
}

/**
 * Mostra no console (como sempre foi) e manda o resumo pro banco.
 * `onde` diz o que o app estava fazendo ("atualizarPersonagem", "tela
 * quebrou"...). `noConsole: false` pra erro que o navegador já mostrou.
 */
export function relatarErro(onde: string, erro: unknown, { noConsole = true } = {}): void {
  if (noConsole) console.error(onde, erro);
  if (!LIGADO || !supabaseConfigurado || typeof window === "undefined") return;
  if (!deveRelatar(erro) || navigator.onLine === false) return;

  const { mensagem, detalhe } = resumirErro(erro);
  const ondeCurto = cortar(onde, LIMITES_ERRO.onde);
  if (!podeMandar({ onde: ondeCurto, mensagem }, Date.now())) return;

  supabase
    .from("erros")
    .insert({
      room_code: contexto.sala ? cortar(contexto.sala, 100) : null,
      quem: contexto.quem ? cortar(contexto.quem, LIMITES_ERRO.quem) : null,
      onde: ondeCurto,
      mensagem,
      detalhe,
      endereco: cortar(window.location.pathname + window.location.search, LIMITES_ERRO.endereco),
      navegador: cortar(navigator.userAgent, LIMITES_ERRO.navegador),
      versao: VERSAO,
    })
    .then(
      // Nada de relatarErro aqui: um relato que falha não vira outro relato.
      ({ error }) => {
        if (error) console.warn("relatarErro: não consegui guardar o erro", error);
      },
      () => {},
    );
}
