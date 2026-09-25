/**
 * Segurar a tela acesa (Screen Wake Lock do navegador) — pro telão: o
 * notebook ligado na TV apagava a tela ou entrava em descanso no meio do
 * combate, porque ninguém mexe nele.
 *
 * O navegador solta a trava sozinho quando a aba some (troca de aba,
 * minimizar, tela bloqueada); por isso ela é pedida de novo a cada volta.
 * Separado do componente, com o navegador passado de fora, pra dar pra
 * testar com um falso.
 */

/** O pedaço da trava que o navegador devolve (`WakeLockSentinel`). */
export interface TravaDeTela {
  readonly released: boolean;
  release(): Promise<void>;
}

/** O pedaço do `navigator.wakeLock` que usamos. */
export interface PedirTrava {
  request(tipo: "screen"): Promise<TravaDeTela>;
}

/** O pedaço do `document` que usamos. */
export interface DocumentoVisivel {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(tipo: "visibilitychange", fn: () => void): void;
  removeEventListener(tipo: "visibilitychange", fn: () => void): void;
}

/**
 * - `acesa`: o navegador aceitou segurar a tela;
 * - `recusada`: tem o recurso, mas negou (economia de bateria, por exemplo);
 * - `sem-suporte`: navegador antigo, ou página sem HTTPS.
 */
export type SituacaoTela = "acesa" | "recusada" | "sem-suporte";

/**
 * Pede a trava agora e de novo sempre que a página volta a aparecer.
 * Devolve a função que para tudo e solta a trava (a limpeza do efeito).
 */
export function manterTelaAcesa(
  pedir: PedirTrava | undefined,
  documento: DocumentoVisivel,
  aoMudar: (situacao: SituacaoTela) => void,
): () => void {
  if (!pedir) {
    aoMudar("sem-suporte");
    return () => {};
  }
  const navegador = pedir;

  let trava: TravaDeTela | null = null;
  let pedindo = false;
  let parado = false;

  async function pedirSePreciso() {
    // Com a página escondida o navegador recusa; a volta pede de novo.
    if (parado || pedindo || documento.visibilityState !== "visible") return;
    if (trava && !trava.released) return;
    pedindo = true;
    try {
      const nova = await navegador.request("screen");
      if (parado) {
        // Saiu do telão enquanto o pedido estava no ar.
        await nova.release().catch(() => {});
        return;
      }
      trava = nova;
      aoMudar("acesa");
    } catch {
      if (!parado && documento.visibilityState === "visible") aoMudar("recusada");
    } finally {
      pedindo = false;
    }
  }

  const aoMudarVisibilidade = () => void pedirSePreciso();
  documento.addEventListener("visibilitychange", aoMudarVisibilidade);
  void pedirSePreciso();

  return () => {
    parado = true;
    documento.removeEventListener("visibilitychange", aoMudarVisibilidade);
    if (trava && !trava.released) void trava.release().catch(() => {});
    trava = null;
  };
}
