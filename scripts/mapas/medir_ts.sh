#!/bin/sh
# Roda o detector TypeScript num cinza cru (.raw) e mede contra um gabarito.
# Uso: medir_ts.sh cinza.raw largura altura gabarito.json [minimo]
cd "$(dirname "$0")/../.." || exit 1
cat > src/lib/tmp_medir.test.ts <<T
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { detectarParedes } from "./detectarParedes";
it("medir", () => {
  const b = readFileSync("$1");
  const r = detectarParedes(new Uint8Array(b), $2, $3, { minimo: ${5:-0.12} });
  writeFileSync("/tmp/medir_ts.json", JSON.stringify(r));
});
T
npx vitest run src/lib/tmp_medir.test.ts >/dev/null 2>&1; rm -f src/lib/tmp_medir.test.ts
.venv-mapas/bin/python scripts/mapas/avaliar.py /tmp/medir_ts.json "$4"
