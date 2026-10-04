import { describe, expect, it } from "vitest";
import {
  LIMITE_DO_RECAP,
  detectarSessoes,
  resumirSessao,
  textoDoRecap,
  tituloDoRecap,
  type LinhaDoLog,
} from "./recap";
import { danoComLog, mensagemAjustePV, mensagemCondicao, resolverTesteMorte } from "./regras";

const T0 = Date.parse("2026-10-02T22:00:00Z");
const min = (n: number) => new Date(T0 + n * 60_000).toISOString();
const linha = (text: string, minuto = 0): LinhaDoLog => ({ text, created_at: min(minuto) });
const JOGADORES = ["Ana", "Beto"];

describe("detectar sessões no histórico do log", () => {
  const sessao = (inicioMin: number, n: number) =>
    Array.from({ length: n }, (_, i) => linha(`x${inicioMin + i}`, inicioMin + i * 10));

  it("buraco de mais de 3 horas separa uma sessão da outra; a mais recente vem primeiro", () => {
    const log = [...sessao(0, 6), ...sessao(60 * 24, 7)];
    const s = detectarSessoes(log);
    expect(s).toHaveLength(2);
    expect(s[0].inicio).toBe(min(60 * 24));
    expect(s[1].linhas).toHaveLength(6);
  });

  it("buraco menor que 3 horas não separa (intervalo no meio da noite)", () => {
    const log = [...sessao(0, 5), ...sessao(40 + 150, 5)]; // 150 min depois da última linha (que foi em 40)
    expect(detectarSessoes(log)).toHaveLength(1);
  });

  it("mexida avulsa (poucas linhas) não vira sessão", () => {
    expect(detectarSessoes([linha("a", 0), linha("b", 1)])).toEqual([]);
  });

  it("as linhas de cada sessão saem em ordem cronológica, mesmo se o log veio embaralhado", () => {
    const log = sessao(0, 6).reverse();
    const [s] = detectarSessoes(log);
    expect(s.linhas.map((l) => l.text)).toEqual(["x0", "x10", "x20", "x30", "x40", "x50"].map((_, i) => `x${i}`));
  });

  it("hora que não dá pra ler é ignorada, não derruba tudo", () => {
    const log = [...sessao(0, 5), { text: "lixo", created_at: "ontem" }];
    expect(detectarSessoes(log)[0].linhas).toHaveLength(5);
  });

  it("histórico vazio", () => {
    expect(detectarSessoes([])).toEqual([]);
  });
});

describe("contar o que aconteceu (com as frases de verdade do log)", () => {
  it("dano e cura de jogador, dano em inimigo e quem caiu", () => {
    const r = resumirSessao(
      [
        linha(mensagemAjustePV("Ana", -8, 12, 20)),
        linha(mensagemAjustePV("Ana", -12, 0, 20)),
        linha(mensagemAjustePV("Ana", 5, 5, 20)),
        linha(mensagemAjustePV("Beto", -3, 17, 20)),
        linha(mensagemAjustePV("Um inimigo", -30, 0, 40, false)),
        linha(mensagemAjustePV("Goblin", -7, 0, 7, false)),
      ],
      JOGADORES,
    );
    expect(r.jogadores).toEqual([
      { nome: "Ana", sofreu: 20, recuperou: 5 },
      { nome: "Beto", sofreu: 3, recuperou: 0 },
    ]);
    expect(r.caidos).toEqual([{ nome: "Ana", vezes: 1 }]);
    expect(r.danoNosInimigos).toBe(37);
  });

  it("cura de inimigo não entra na conta dos jogadores", () => {
    const r = resumirSessao([linha(mensagemAjustePV("Goblin", 5, 7, 7, false))], JOGADORES);
    expect(r.jogadores).toEqual([]);
  });

  it("dano todo absorvido pelo PV temporário ainda é dano sofrido, mas não derruba", () => {
    const r = resumirSessao([linha("Ana sofreu 6 de dano, todo absorvido pelo PV temporário")], JOGADORES);
    expect(r.jogadores[0].sofreu).toBe(6);
    expect(r.caidos).toEqual([]);
  });

  it("concentração perdida por dano (linha do danoComLog)", () => {
    const { texto } = danoComLog(
      {
        hp: 10,
        hp_max: 20,
        hp_temp: 0,
        is_npc: false,
        revealed: true,
        name: "Ana",
        concentration: true,
        concentration_on: "Bênção",
        cond: {},
      } as never,
      40,
    );
    const r = resumirSessao([linha(texto ?? "")], JOGADORES);
    expect(r.concentracoesPerdidas).toEqual(["Ana em Bênção"]);
    expect(r.jogadores[0].sofreu).toBeGreaterThan(0);
  });

  it("rodadas e inimigos que entraram (jogador entrando não conta)", () => {
    const r = resumirSessao(
      [
        linha("Um inimigo entrou no combate (iniciativa 12)"),
        linha("Goblin entrou no combate (iniciativa 8)"),
        linha("Ana entrou no combate (iniciativa 15)"),
        linha("Rodada 2 começou"),
        linha("Rodada 3 começou"),
      ],
      JOGADORES,
    );
    expect(r.inimigosEntraram).toBe(2);
    expect(r.rodadas).toBe(2);
  });

  it("testes de morte: morreu e estabilizou, sem repetir", () => {
    const morreu = resolverTesteMorte("Ana", 0, 2, 5).texto;
    const estabilizou = resolverTesteMorte("Beto", 2, 0, 15).texto;
    const aindaVivo = resolverTesteMorte("Beto", 0, 0, 5).texto;
    const r = resumirSessao([linha(morreu), linha(morreu), linha(estabilizou), linha(aindaVivo)], JOGADORES);
    expect(r.mortos).toEqual(["Ana"]);
    expect(r.estabilizados).toEqual(["Beto"]);
  });

  it("magias conjuradas por pessoa, com contagem e sem os parênteses da conjuração", () => {
    const r = resumirSessao(
      [
        linha("Ana conjura Bênção"),
        linha("Ana conjura Bênção (espaço de 2º nível)"),
        linha("Ana conjura Detectar magia (ritual)"),
        linha("Beto conjura Voo (larga a concentração em Bênção)"),
      ],
      JOGADORES,
    );
    expect(r.magias).toEqual([
      {
        nome: "Ana",
        magias: [
          { magia: "Bênção", vezes: 2 },
          { magia: "Detectar magia", vezes: 1 },
        ],
      },
      { nome: "Beto", magias: [{ magia: "Voo", vezes: 1 }] },
    ]);
  });

  it("condições dos jogadores (a dos inimigos fica de fora e não repete)", () => {
    const r = resumirSessao(
      [
        linha(mensagemCondicao("Ana", "Amedrontado", true)),
        linha(mensagemCondicao("Ana", "Amedrontado", true)),
        linha(mensagemCondicao("Ana", "Amedrontado", false)),
        linha(mensagemCondicao("Um inimigo", "Caído", true)),
      ],
      JOGADORES,
    );
    expect(r.condicoes).toEqual([{ nome: "Ana", condicao: "Amedrontado" }]);
  });

  it("linhas do baú vêm como foram escritas, sem repetir em seguida", () => {
    const r = resumirSessao(
      [
        linha("🎒 Ana pegou 2× Poção de cura do baú"),
        linha("🎒 Ana pegou 2× Poção de cura do baú"),
        linha("💰 Dinheiro do baú dividido: cada um levou 20 PO"),
      ],
      JOGADORES,
    );
    expect(r.bau).toEqual(["🎒 Ana pegou 2× Poção de cura do baú", "💰 Dinheiro do baú dividido: cada um levou 20 PO"]);
  });

  it("linhas do tempo da campanha entram no resumo e no rascunho, sem contar como inimigo", () => {
    const linhas = [
      linha("🗓 Descanso longo do grupo. Passou 1 dia: Dia 14 → Dia 15"),
      linha("🗓 Efeito venceu: Maldição (Ana)"),
      linha("🗓 Efeito venceu: Maldição (Ana)"),
    ];
    const r = resumirSessao(linhas, JOGADORES);
    expect(r.tempo).toEqual(["🗓 Descanso longo do grupo. Passou 1 dia: Dia 14 → Dia 15", "🗓 Efeito venceu: Maldição (Ana)"]);
    expect(r.inimigosEntraram).toBe(0);
    expect(textoDoRecap({ inicio: min(0), fim: min(5) }, r)).toContain("Tempo da campanha:\n🗓 Descanso longo do grupo");
  });

  it("linhas de XP entram no resumo e no rascunho, uma por personagem, sem contar como inimigo", () => {
    const r = resumirSessao([linha("🏅 Ana ganhou 300 XP (total 1.250)"), linha("🏅 Beto ganhou 300 XP (total 900)")], JOGADORES);
    expect(r.xp).toEqual(["🏅 Ana ganhou 300 XP (total 1.250)", "🏅 Beto ganhou 300 XP (total 900)"]);
    expect(r.inimigosEntraram).toBe(0);
    expect(textoDoRecap({ inicio: min(0), fim: min(5) }, r)).toContain("XP:\n🏅 Ana ganhou 300 XP");
  });

  it("linha que não reconhece é ignorada, sem inventar nada", () => {
    const r = resumirSessao([linha("Combate reiniciado"), linha("algo que ninguém esperava")], JOGADORES);
    expect(r).toMatchObject({ rodadas: 0, inimigosEntraram: 0, jogadores: [], magias: [] });
  });
});

describe("rascunho do diário", () => {
  const sessao = { inicio: min(0), fim: min(3 * 60 + 30) };

  it("escreve a duração e só as seções que têm conteúdo", () => {
    const r = resumirSessao([linha("Rodada 2 começou"), linha(mensagemAjustePV("Ana", -10, 10, 20))], JOGADORES);
    const t = textoDoRecap(sessao, r);
    expect(t).toContain("(3 h 30)");
    expect(t).toContain("⚔️ Combate: 1 rodada jogada");
    expect(t).toContain("Ana sofreu 10 de dano");
    expect(t).not.toContain("🔮");
    expect(t).not.toContain("Baú");
  });

  it("sessão sem nada reconhecido ainda dá um texto (só a duração)", () => {
    const t = textoDoRecap(sessao, resumirSessao([], JOGADORES));
    expect(t).toMatch(/^\S+ às \S+ \(3 h 30\)\.$/);
  });

  it("cartões mostrados à mesa entram", () => {
    expect(textoDoRecap(sessao, resumirSessao([], JOGADORES), ["Barão Vael", "Culto do Raio"])).toContain(
      "🗂 Mostrado à mesa: Barão Vael, Culto do Raio.",
    );
  });

  it("duração curta em minutos e hora cheia sem minutos", () => {
    expect(textoDoRecap({ inicio: min(0), fim: min(45) }, resumirSessao([], []))).toContain("(45 min)");
    expect(textoDoRecap({ inicio: min(0), fim: min(120) }, resumirSessao([], []))).toContain("(2 h)");
  });

  it("nunca passa do limite do diário: as últimas seções caem e um … avisa", () => {
    const muitas = Array.from({ length: 80 }, (_, i) => linha(`🎒 Ana pegou ${i}× Item número ${i} do baú`));
    const t = textoDoRecap(sessao, resumirSessao([linha("Rodada 2 começou"), ...muitas], JOGADORES));
    expect(t.length).toBeLessThanOrEqual(LIMITE_DO_RECAP);
    expect(t).toContain("⚔️ Combate");
    expect(t.endsWith("…")).toBe(true);
  });

  it("título sugerido: Sessão de dia/mês", () => {
    expect(tituloDoRecap(min(0))).toMatch(/^Sessão de \d{2}\/\d{2}$/);
  });
});
