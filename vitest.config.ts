import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // O mesmo "@/" do tsconfig: o teste do useSala carrega o hook de verdade,
  // que importa tudo por esse caminho.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // O Vercel roda o build (e este `vitest`, via `npm run verificar`) com
    // NODE_ENV=production, e o Vitest só põe "test" quando está vazio. Em
    // produção o React não tem `act`, e o teste do useSala quebrava SÓ lá
    // ("React.act is not a function") — o GitHub e a máquina daqui passavam.
    env: { NODE_ENV: "test" },
  },
});
