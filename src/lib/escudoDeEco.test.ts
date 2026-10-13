import { describe, expect, it, vi } from "vitest";
import { criarEscudoDeEco } from "./escudoDeEco";

/** Relógio e agendador de mentira: o teste decide quando o tempo passa. */
function montar(janelaMs = 1000) {
  let t = 0;
  let pendente: { fn: () => void; em: number } | null = null;
  const aoFechar = vi.fn();
  const escudo = criarEscudoDeEco(
    janelaMs,
    () => t,
    (fn, ms) => {
      pendente = { fn, em: t + ms };
      return pendente;
    },
    (h) => {
      if (pendente === h) pendente = null;
    },
  );
  escudo.aoFechar(aoFechar);
  const passar = (ms: number) => {
    t += ms;
    if (pendente && t >= pendente.em) {
      const { fn } = pendente;
      pendente = null;
      fn();
    }
  };
  return { escudo, aoFechar, passar };
}

describe("escudoDeEco", () => {
  it("linha que ninguém gravou não é protegida", () => {
    const { escudo } = montar();
    expect(escudo.protegido("a")).toBe(false);
  });

  it("depois de gravar, os avisos da linha ficam de lado só durante a janela", () => {
    const { escudo, passar } = montar(1000);
    escudo.proteger("a");
    expect(escudo.protegido("a")).toBe(true);
    expect(escudo.protegido("b")).toBe(false); // outra linha segue normal
    passar(999);
    expect(escudo.protegido("a")).toBe(true);
    passar(1);
    expect(escudo.protegido("a")).toBe(false);
  });

  it("relê UMA vez, depois da última gravação (gravações seguidas empurram o prazo)", () => {
    const { escudo, aoFechar, passar } = montar(1000);
    escudo.proteger("a");
    passar(600);
    escudo.proteger("a"); // segundo toque
    passar(600);
    expect(aoFechar).not.toHaveBeenCalled();
    passar(500); // 1100 depois do segundo toque: passou de janela + 50
    expect(aoFechar).toHaveBeenCalledTimes(1);
    passar(5000);
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("a releitura limpa a proteção de todas as linhas", () => {
    const { escudo, passar } = montar(1000);
    escudo.proteger("a");
    escudo.proteger("b");
    passar(1100);
    expect(escudo.protegido("a")).toBe(false);
    expect(escudo.protegido("b")).toBe(false);
  });

  it("encerrar cancela a releitura (o hook foi desmontado)", () => {
    const { escudo, aoFechar, passar } = montar(1000);
    escudo.proteger("a");
    escudo.encerrar();
    passar(5000);
    expect(aoFechar).not.toHaveBeenCalled();
    expect(escudo.protegido("a")).toBe(false);
  });
});
