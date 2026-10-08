#!/bin/sh
# Roda o detector do app (TypeScript) numa imagem, do jeito que a tela roda, e desenha o
# resultado por cima dela. Uso: como_no_app.sh imagem saida.png [escuras|claras] [nivel 1-5] [gabarito.json]
cd "$(dirname "$0")/../.." || exit 1
T="${TMPDIR:-/tmp}/como_no_app"; mkdir -p "$T"
LIN="${3:-escuras}"; NIV="${4:-3}"
DIM=$(.venv-mapas/bin/python - "$1" "$T" <<'P'
import sys,cv2
im=cv2.imread(sys.argv[1]); h,w=im.shape[:2]; e=min(1,1400/max(h,w))
if e<1: im=cv2.resize(im,(round(w*e),round(h*e)),interpolation=cv2.INTER_AREA)
h,w=im.shape[:2]; cv2.imwrite(sys.argv[2]+'/img.png',im)
cv2.cvtColor(im,cv2.COLOR_BGR2GRAY).tofile(sys.argv[2]+'/cinza.raw')
mx=im.max(axis=2).astype('float32'); mn=im.min(axis=2).astype('float32')
((mx-mn)/mx.clip(1)*255).round().astype('uint8').tofile(sys.argv[2]+'/sat.raw')
print(w,h)
P
)
W=${DIM% *}; H=${DIM#* }
cat > src/lib/tmp_app.test.ts <<TS
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { NIVEIS_DE_SENSIBILIDADE as N, aplicarComCor, aplicarDeteccao, prepararDeteccao } from "./detectarParedes";
it("app", () => {
  const n = N[$NIV as 1 | 2 | 3 | 4 | 5];
  const t0 = performance.now();
  const p = prepararDeteccao(new Uint8Array(readFileSync("$T/cinza.raw")), $W, $H, { linhas: "$LIN", comp: n.comp, limiar: n.limiar, limiarLocal: n.limiarLocal });
  const aj = { minimo: n.minimo, razao: n.razao };
  const r = "$LIN" === "claras"
    ? aplicarComCor(p, prepararDeteccao(new Uint8Array(readFileSync("$T/sat.raw")), $W, $H, { linhas: "escuras", comp: ${CC:-n.comp * 0.57}, limiar: ${CL:-0.6}, limiarLocal: ${CLL:-0.4} }), { ...aj, minimoDaCor: ${CM:-n.minimo * 0.57}, razaoDaCor: ${CR:-Math.min(0.9, n.razao + 0.15)} })
    : aplicarDeteccao(p, aj);
  writeFileSync("$T/r.json", JSON.stringify({ ...r, ms: Math.round(performance.now() - t0) }));
});
TS
npx vitest run src/lib/tmp_app.test.ts 2>&1 | grep -E "Error|FAIL" | head -3; rm -f src/lib/tmp_app.test.ts
.venv-mapas/bin/python - "$T" "$2" <<'P'
import sys,json,cv2
T,out=sys.argv[1:3]; d=json.load(open(T+'/r.json')); im=cv2.imread(T+'/img.png'); k=max(1,round(1100/max(im.shape[:2])))
im=cv2.resize(im,None,fx=k,fy=k,interpolation=cv2.INTER_CUBIC)
for s in d['paredes']: cv2.line(im,(int(s[0]*k),int(s[1]*k)),(int(s[2]*k),int(s[3]*k)),(0,0,255),2)
for s in d['portas']: cv2.line(im,(int(s[0]*k),int(s[1]*k)),(int(s[2]*k),int(s[3]*k)),(0,220,255),4)
cv2.imwrite(out,im); print(len(d['paredes']),'paredes',len(d['portas']),'portas',d['ms'],'ms')
P
[ -n "$5" ] && .venv-mapas/bin/python scripts/mapas/avaliar.py "$T/r.json" "$5"
exit 0
