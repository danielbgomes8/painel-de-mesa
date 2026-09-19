import type { MetadataRoute } from "next";

/** Deixa o navegador oferecer "adicionar à tela de início" — útil pra abrir
 *  o painel na mesa sem digitar a URL toda vez. Um app pra todas as mesas:
 *  `start_url: "/"` abre a última sala em que o aparelho entrou (ver
 *  `escolherSala` em src/lib/sala.ts), e o topo tem o atalho pra trocar. Por
 *  isso o nome aqui não é o de campanha nenhuma. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Painel de Mesa",
    short_name: "Painel de Mesa",
    description: "Painel de combate e fichas pra mesa de D&D 5.5.",
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
