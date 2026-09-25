import { describe, expect, it } from "vitest";
import { manterTelaAcesa, type DocumentoVisivel, type PedirTrava, type SituacaoTela, type TravaDeTela } from "./telaAcesa";

/** Espera as promessas pendentes andarem. */
const andar = () => new Promise((r) => setTimeout(r, 0));

/** Documento falso: dá pra esconder/mostrar a página na mão. */
function documentoFalso(): DocumentoVisivel & { mostrar(): void; esconder(): void } {
  let visivel = true;
  const ouvintes = new Set<() => void>();
  return {
    get visibilityState() {
      return visivel ? "visible" : "hidden";
    },
    addEventListener: (_tipo, fn) => void ouvintes.add(fn),
    removeEventListener: (_tipo, fn) => void ouvintes.delete(fn),
    mostrar() {
      visivel = true;
      ouvintes.forEach((fn) => fn());
    },
    esconder() {
      visivel = false;
      ouvintes.forEach((fn) => fn());
    },
  };
}

/** Navegador falso: conta os pedidos; `soltarTudo` imita a aba sumindo. */
function navegadorFalso({ recusar = false } = {}) {
  const travas: (TravaDeTela & { released: boolean })[] = [];
  const pedir: PedirTrava = {
    request: async () => {
      if (recusar) throw new DOMException("economia de bateria", "NotAllowedError");
      const trava = {
        released: false,
        release: async () => {
          trava.released = true;
        },
      };
      travas.push(trava);
      return trava;
    },
  };
  return {
    pedir,
    travas,
    soltarTudo: () => travas.forEach((t) => (t.released = true)),
  };
}

describe("segurar a tela acesa no telão", () => {
  it("pede a trava ao abrir e avisa que a tela está acesa", async () => {
    const nav = navegadorFalso();
    const situacoes: SituacaoTela[] = [];
    manterTelaAcesa(nav.pedir, documentoFalso(), (s) => situacoes.push(s));
    await andar();
    expect(nav.travas).toHaveLength(1);
    expect(situacoes).toEqual(["acesa"]);
  });

  it("o navegador soltou quando a aba sumiu: pede de novo na volta, uma vez só", async () => {
    const nav = navegadorFalso();
    const doc = documentoFalso();
    manterTelaAcesa(nav.pedir, doc, () => {});
    await andar();
    doc.esconder();
    nav.soltarTudo();
    await andar();
    expect(nav.travas).toHaveLength(1); // escondida não adianta pedir
    doc.mostrar();
    doc.mostrar(); // evento repetido não pede duas vezes
    await andar();
    expect(nav.travas).toHaveLength(2);
    expect(nav.travas[1].released).toBe(false);
  });

  it("voltar sem ter perdido a trava não pede outra", async () => {
    const nav = navegadorFalso();
    const doc = documentoFalso();
    manterTelaAcesa(nav.pedir, doc, () => {});
    await andar();
    doc.mostrar();
    await andar();
    expect(nav.travas).toHaveLength(1);
  });

  it("sair do telão solta a trava e para de ouvir a volta", async () => {
    const nav = navegadorFalso();
    const doc = documentoFalso();
    const parar = manterTelaAcesa(nav.pedir, doc, () => {});
    await andar();
    parar();
    await andar();
    expect(nav.travas[0].released).toBe(true);
    doc.mostrar();
    await andar();
    expect(nav.travas).toHaveLength(1);
  });

  it("sair enquanto o pedido está no ar solta a trava que chegar depois", async () => {
    const nav = navegadorFalso();
    const parar = manterTelaAcesa(nav.pedir, documentoFalso(), () => {});
    parar();
    await andar();
    expect(nav.travas).toHaveLength(1);
    expect(nav.travas[0].released).toBe(true);
  });

  it("navegador que recusa (economia de bateria) fica como recusada", async () => {
    const situacoes: SituacaoTela[] = [];
    manterTelaAcesa(navegadorFalso({ recusar: true }).pedir, documentoFalso(), (s) => situacoes.push(s));
    await andar();
    expect(situacoes).toEqual(["recusada"]);
  });

  it("navegador sem o recurso avisa na hora", () => {
    const situacoes: SituacaoTela[] = [];
    manterTelaAcesa(undefined, documentoFalso(), (s) => situacoes.push(s));
    expect(situacoes).toEqual(["sem-suporte"]);
  });
});
