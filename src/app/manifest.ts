import type { MetadataRoute } from "next";

/** Deixa o navegador oferecer "adicionar à tela de início" — útil pra abrir
 *  o painel na mesa sem digitar a URL toda vez. `start_url: "/"` cai na sala
 *  padrão (`setimo-raio`, ver src/lib/sala.ts); quem joga em outra mesa
 *  continua abrindo `?sala=...` direto no navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Painel de Mesa — Sétimo Raio",
    short_name: "Painel de Mesa",
    description:
      "Painel de combate e fichas da mesa de D&D 5.5 Sétimo Raio.",
    start_url: "/",
    display: "standalone",
    background_color: "#171310",
    theme_color: "#171310",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
