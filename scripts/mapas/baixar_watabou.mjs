// Gera e baixa (PNG + JSON de geometria) masmorras do One Page Dungeon do Watabou, que libera o uso dos
// mapas gerados (https://watabou.itch.io/one-page-dungeon). Mesma semente + estilo = mesmo mapa.
// Uso: node scripts/mapas/baixar_watabou.mjs pasta_de_saida
// Dois truques que custaram caro: (1) as primeiras teclas depois de carregar sao engolidas, entao ha um
// "aquecimento" e cada exportacao tenta ate 3 vezes; (2) a opcao "girar pra caber" (R) fica salva por
// contexto, entao cada mapa abre num contexto novo (senao ela liga e desliga de um mapa pro outro).
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
const OUT = path.resolve(process.argv[2] || 'watabou');
const LISTA = [[101, 1], [202, 2], [303, 3], [404, 4], [505, 5], [707, 3], [808, 2], [909, 1], [1212, 3]]; // [semente, estilo 1-5]
{
  mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [seed, est] of LISTA) {
    const ctx = await b.newContext({ viewport: { width: 1000, height: 800 }, acceptDownloads: true });
    const p = await ctx.newPage();
    await p.goto(`https://watabou.github.io/one-page-dungeon/?seed=${seed}`);
    await p.waitForSelector('canvas'); await p.waitForTimeout(2500);
    await p.mouse.click(500, 400); await p.keyboard.press('Shift'); await p.waitForTimeout(500); await p.keyboard.press('Shift'); await p.waitForTimeout(500);
    await p.keyboard.press(String(est)); await p.waitForTimeout(1200);
    await p.keyboard.press('r'); await p.waitForTimeout(1200); // desliga o giro: o mapa fica alinhado aos eixos
    const nome = `d${seed}_e${est}`;
    for (const [tecla, ext] of [['j', 'json'], ['e', 'png']]) {
      let ok = false;
      for (let t = 0; t < 3 && !ok; t++) {
        const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 6000 }).catch(() => null), p.keyboard.press(tecla)]);
        if (dl) { await dl.saveAs(path.join(OUT, `${nome}.${ext}`)); ok = true; }
      }
      if (!ok) { console.error('sem download', nome, ext); process.exitCode = 1; }
    }
    console.log('baixado', nome);
    await ctx.close();
  }
  await b.close();
}
