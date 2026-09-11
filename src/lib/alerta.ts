/** Vibração + bipe curto pra avisar "é a sua vez". Só roda no navegador e só
 *  enquanto a aba está aberta em primeiro plano — não acorda o celular com a
 *  tela bloqueada ou o app em segundo plano; é um lembrete, não um alarme. */
export function alertarSuaVez(): void {
  if (typeof window === "undefined") return;

  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    // Vibration API pode não existir ou ser bloqueada; sem problema, segue com o som.
  }

  try {
    type JanelaComWebkit = Window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext ?? (window as JanelaComWebkit).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const bipe = (atraso: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t0 = ctx.currentTime + atraso;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.15, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    };
    bipe(0, 660);
    bipe(0.28, 880);
  } catch {
    // Web Audio bloqueado (ex.: sem interação do usuário ainda) — só a vibração já ajuda.
  }
}
