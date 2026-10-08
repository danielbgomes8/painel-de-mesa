#!/bin/sh
# Desenha o resultado do detector TypeScript por cima da imagem (3x), pra olhar.
# Uso: ver_ts.sh imagem.jpg cinza.raw largura altura saida.png [minimo]
cd "$(dirname "$0")/.." && cd .. || exit 1
cat > src/lib/tmp_ver.test.ts <<T
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { detectarParedes } from "./detectarParedes";
it("ver", () => {
  const r = detectarParedes(new Uint8Array(readFileSync("$2")), $3, $4, { minimo: ${6:-0.12} });
  writeFileSync("${TMPDIR:-/tmp}/ver_ts.json", JSON.stringify(r));
});
T
npx vitest run src/lib/tmp_ver.test.ts >/dev/null 2>&1; rm -f src/lib/tmp_ver.test.ts
.venv-mapas/bin/python - <<P
import json,cv2,os
d=json.load(open(os.environ.get('TMPDIR','/tmp')+'/ver_ts.json'));k=3
im=cv2.resize(cv2.imread('$1'),None,fx=k,fy=k,interpolation=cv2.INTER_CUBIC)
for s in d['paredes']:cv2.line(im,(int(s[0]*k),int(s[1]*k)),(int(s[2]*k),int(s[3]*k)),(0,0,255),2)
for s in d['portas']:cv2.line(im,(int(s[0]*k),int(s[1]*k)),(int(s[2]*k),int(s[3]*k)),(0,220,255),5)
cv2.imwrite('$5',im);print(len(d['paredes']),'paredes',len(d['portas']),'portas')
P
