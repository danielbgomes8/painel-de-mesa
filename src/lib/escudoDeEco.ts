/**
 * Quem escreve numa linha mostra o resultado NA HORA (estado otimista) e só depois o banco avisa pelo tempo real —
 * um aviso por gravação, e a rede não promete que chegam no momento certo. Com dois toques seguidos no mesmo relógio
 * (ou porta, ou peão), o aviso do PRIMEIRO chega depois de a tela já ter ido ao segundo: aplicado às cegas, ele
 * devolve a tela ao valor velho, e o toque seguinte parte dele (a conta `cheias + 1` sai do número errado e um toque
 * se perde — reproduzido em `useRelogios.test.ts`).
 *
 * As fichas resolvem isso com serialização de escrita + o carimbo `updated_at` (ver `lib/ecoAtrasado.ts`). As tabelas
 * do mapa e da campanha não têm esse carimbo, então aqui o critério é o TEMPO: durante `janelaMs` depois de uma
 * gravação nossa numa linha, o aviso dessa linha é ignorado (a tela já está certa, é o que acabamos de gravar). Passada
 * a janela, quem usa isto RELÊ a tabela uma vez (`aoFechar`), o que traz de volta o que outro aparelho tenha mudado
 * nesse meio tempo — o que falta aqui é só o atraso, nunca o dado.
 */
export const JANELA_DO_ECO_MS = 3000;

export type EscudoDeEco = {
  /** Chame ao gravar numa linha: os avisos dela ficam de lado até a janela passar. */
  proteger: (id: string) => void;
  /** O aviso dessa linha deve ser ignorado agora? */
  protegido: (id: string) => boolean;
  /** O que fazer ao fim da janela (reler a tabela). O hook registra isto dentro do efeito, já com a leitura pronta. */
  aoFechar: (fn: () => void) => void;
  /** Cancela o agendamento da releitura (ao desmontar). */
  encerrar: () => void;
};

/**
 * O `aoFechar` registrado roda uma vez, `janelaMs` depois da ÚLTIMA gravação protegida (gravações seguidas empurram o
 * prazo). `agora`, `agendar` e `cancelar` existem só pro teste trocar o relógio.
 */
export function criarEscudoDeEco(
  janelaMs: number = JANELA_DO_ECO_MS,
  agora: () => number = Date.now,
  agendar: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms),
  cancelar: (t: unknown) => void = (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
): EscudoDeEco {
  const ate = new Map<string, number>();
  let timer: unknown = null;
  let aoFechar: () => void = () => {};
  return {
    aoFechar(fn) {
      aoFechar = fn;
    },
    proteger(id) {
      ate.set(id, agora() + janelaMs);
      if (timer !== null) cancelar(timer);
      timer = agendar(() => {
        timer = null;
        ate.clear();
        aoFechar();
      }, janelaMs + 50);
    },
    protegido(id) {
      const t = ate.get(id);
      if (t === undefined) return false;
      if (agora() >= t) {
        ate.delete(id);
        return false;
      }
      return true;
    },
    encerrar() {
      if (timer !== null) cancelar(timer);
      timer = null;
      ate.clear();
    },
  };
}
