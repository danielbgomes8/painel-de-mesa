/*
 * Painel de Mesa — service worker: deixa o app abrir sem internet.
 *
 * Só guarda o próprio app (a página, os scripts, as fontes, os ícones). Os
 * dados da sala nunca passam por aqui: as chamadas pro Supabase vão direto
 * pra rede, e o que a tela mostra sem internet vem da foto da sala que o
 * useSala guarda no aparelho (ver src/lib/offline.ts).
 *
 * - Página: rede primeiro (quem tem internet sempre recebe a versão nova);
 *   sem resposta em 4 s, a última guardada. Todo ?sala= usa a mesma página.
 * - /_next/static/: guardado primeiro — o nome do arquivo muda a cada
 *   versão, então o que está guardado nunca fica velho.
 * - O resto do próprio site (manifest, ícones): rede, com a guardada de
 *   reserva.
 */

const CACHE = "painel-de-mesa-v1";
const ESPERA_REDE_MS = 4000;
// Arquivos de versões antigas vão ficando pra trás; passou disso, os mais
// velhos saem (a página nunca sai).
const MAX_GUARDADOS = 150;

// Ao instalar, já guarda a página e os arquivos que ela usa — senão quem
// ficasse sem internet logo depois da primeira visita não teria o que abrir.
self.addEventListener("install", (evento) => {
  self.skipWaiting();
  evento.waitUntil(guardarApp().catch(() => {}));
});

async function guardarApp() {
  const cache = await caches.open(CACHE);
  const resposta = await fetch("/", { cache: "no-store" });
  if (!resposta.ok) return;
  const html = await resposta.clone().text();
  await cache.put("/", resposta);
  // Caminhos dos arquivos citados na página (scripts, CSS, fontes). A barra
  // invertida fica de fora: o HTML também traz esses caminhos escapados
  // dentro de JSON ("\/_next\/…"), e aí não são endereços de verdade.
  const arquivos = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])];
  await Promise.all(arquivos.map((arquivo) => cache.add(arquivo).catch(() => {})));
}

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      for (const nome of await caches.keys()) {
        if (nome !== CACHE) await caches.delete(nome);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return; // Supabase e afins: direto pra rede
  if (url.pathname === "/sw.js") return;

  if (pedido.mode === "navigate") {
    evento.respondWith(pagina(pedido, evento));
  } else if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(guardadoPrimeiro(pedido));
  } else {
    evento.respondWith(redeComReserva(pedido, evento));
  }
});

function comPrazo(promessa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("sem resposta")), ms);
    promessa.then(
      (r) => {
        clearTimeout(t);
        resolve(r);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function pagina(pedido, evento) {
  const cache = await caches.open(CACHE);
  const daRede = fetch(pedido).then(async (resposta) => {
    if (resposta.ok) await cache.put("/", resposta.clone());
    return resposta;
  });
  // Se a rede responder depois do prazo, a página guardada ainda é atualizada.
  evento.waitUntil(daRede.catch(() => {}));
  const guardada = await cache.match("/");
  // Sem página guardada, o prazo não vale: internet lenta não é falta dela.
  if (!guardada) return daRede.catch(semInternet);
  try {
    return await comPrazo(daRede, ESPERA_REDE_MS);
  } catch {
    return guardada;
  }
}

function semInternet() {
  return new Response(
    "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>" +
      "<title>Painel de Mesa</title><body style='font-family:system-ui;padding:24px'>" +
      "<h1>Sem internet</h1><p>Abra o Painel de Mesa uma vez com internet pra ele funcionar sem conexão depois.</p>",
    { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

async function guardadoPrimeiro(pedido) {
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(pedido);
  if (guardado) return guardado;
  const resposta = await fetch(pedido);
  if (resposta.ok) {
    await cache.put(pedido, resposta.clone());
    await aparar(cache);
  }
  return resposta;
}

async function redeComReserva(pedido, evento) {
  const cache = await caches.open(CACHE);
  const daRede = fetch(pedido).then(async (resposta) => {
    if (resposta.ok) await cache.put(pedido, resposta.clone());
    return resposta;
  });
  evento.waitUntil(daRede.catch(() => {}));
  try {
    return await comPrazo(daRede, ESPERA_REDE_MS);
  } catch {
    const guardada = await cache.match(pedido);
    return guardada ?? Response.error();
  }
}

async function aparar(cache) {
  const chaves = await cache.keys();
  const sobrando = chaves.length - MAX_GUARDADOS;
  if (sobrando <= 0) return;
  let tirados = 0;
  for (const chave of chaves) {
    if (tirados >= sobrando) break;
    if (new URL(chave.url).pathname === "/") continue;
    await cache.delete(chave);
    tirados++;
  }
}
