import { ehFalhaDeRede } from "./offline";

/**
 * Relato de erro dos aparelhos (tabela `erros`, migration 0017) — as regras
 * puras: o que vale relatar, o resumo que vai pro banco e o freio que impede
 * um erro em laço de inundar a tabela. Quem manda de verdade é
 * `lib/relatarErro.ts`.
 */

/** Tamanhos máximos — os mesmos `check` da migration 0017. */
export const LIMITES_ERRO = {
  onde: 100,
  quem: 100,
  mensagem: 600,
  detalhe: 2500,
  endereco: 300,
  navegador: 400,
} as const;

/** Corta com reticências pra caber no limite do banco. */
export function cortar(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1)}…`;
}

/** Erro devolvido pelo Supabase: `{ message, code, details, hint }`. */
type ErroDoBanco = { message: string; code?: string | null; details?: string | null; hint?: string | null };

function ehErroDoBanco(erro: unknown): erro is ErroDoBanco {
  return (
    typeof erro === "object" &&
    erro !== null &&
    !(erro instanceof Error) &&
    typeof (erro as { message?: unknown }).message === "string"
  );
}

/** O que vai pras colunas `mensagem` e `detalhe`. */
export function resumirErro(erro: unknown): { mensagem: string; detalhe: string | null } {
  if (erro instanceof Error) {
    return {
      mensagem: cortar(`${erro.name}: ${erro.message}`, LIMITES_ERRO.mensagem),
      detalhe: erro.stack ? cortar(erro.stack, LIMITES_ERRO.detalhe) : null,
    };
  }
  if (ehErroDoBanco(erro)) {
    // O código é o que diz o motivo: 42501 = RLS recusou, PGRST204 = coluna
    // que o banco não tem (migration que não rodou), 23505 = repetido...
    const partes = [erro.code ? `código ${erro.code}` : null, erro.details, erro.hint].filter(Boolean);
    return {
      mensagem: cortar(erro.message, LIMITES_ERRO.mensagem),
      detalhe: partes.length > 0 ? cortar(partes.join(" · "), LIMITES_ERRO.detalhe) : null,
    };
  }
  if (typeof erro === "string") return { mensagem: cortar(erro, LIMITES_ERRO.mensagem), detalhe: null };
  let texto: string;
  try {
    texto = JSON.stringify(erro) ?? String(erro);
  } catch {
    texto = String(erro);
  }
  return { mensagem: cortar(texto, LIMITES_ERRO.mensagem), detalhe: null };
}

/**
 * Vale mandar pro banco? Queda de internet não: ela já tem a fila própria
 * (lib/offline.ts), acontece o tempo todo no celular e nem daria pra mandar.
 * Também ficam de fora os avisos do navegador que não são defeito do app.
 */
export function deveRelatar(erro: unknown): boolean {
  if (erro === null || erro === undefined) return false;
  if (ehErroDoBanco(erro)) return !ehFalhaDeRede(erro);
  if (erro instanceof Error) {
    if (erro.name === "AbortError" || erro.name === "TimeoutError") return false;
    // Chrome: "Failed to fetch"; Safari: "Load failed"; Firefox: "NetworkError…".
    if (erro.name === "TypeError" && /failed to fetch|load failed|networkerror/i.test(erro.message)) return false;
  }
  const texto = typeof erro === "string" ? erro : erro instanceof Error ? erro.message : "";
  // Aviso inofensivo do navegador, e erro de script de outro site (extensão)
  // que chega sem informação nenhuma.
  if (/^ResizeObserver loop/.test(texto) || texto === "Script error.") return false;
  return true;
}

/**
 * Freio: no máximo `maximo` relatos por abertura do app, e o mesmo erro
 * (mesmo `onde` + mesma mensagem) só uma vez a cada `janelaMs`. Um erro
 * que se repete a cada render viraria milhares de linhas.
 */
export function criarFreio({ maximo = 20, janelaMs = 5 * 60_000 } = {}) {
  const vistos = new Map<string, number>();
  let enviados = 0;
  return function pode(relato: { onde: string; mensagem: string }, agora: number): boolean {
    if (enviados >= maximo) return false;
    const chave = `${relato.onde}\n${relato.mensagem}`;
    const ultimo = vistos.get(chave);
    if (ultimo !== undefined && agora - ultimo < janelaMs) return false;
    vistos.set(chave, agora);
    enviados++;
    return true;
  };
}
