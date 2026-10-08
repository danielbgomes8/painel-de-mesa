#!/bin/sh
# Roda o detector por CONTORNO do app numa imagem (fundo liso) e desenha por cima.
# Uso: contorno_no_app.sh imagem saida.png [limiar do fundo] [referencia.json do detectar_topologia.py]
cd "$(dirname "$0")/../.." || exit 1
T="${TMPDIR:-/tmp}/contorno_no_app"; mkdir -p "$T"
DIM=$(.venv-mapas/bin/python - "$1" "$T" <<'P'
import sys,cv2
im=cv2.imread(sys.argv[1]); h,w=im.shape[:2]; e=min(1,1400/max(h,w))
if e<1: im=cv2.resize(im,(round(w*e),round(h*e)),interpolation=cv2.INTER_AREA)
h,w=im.shape[:2]; cv2.imwrite(sys.argv[2]+'/img.png',im)
cv2.cvtColor(im,cv2.COLOR_BGR2RGBA).tofile(sys.argv[2]+'/rgba.raw'); print(w,h)
P
)
W=${DIM% *}; H=${DIM#* }
cat > src/lib/tmp_cont.test.ts <<TS
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { detectarContorno, distanciaDoFundo } from "./detectarContorno";
import { lerParedesDoTexto } from "./importarParedes";
import { comoTextoDeImportacao } from "./detectarParedes";
it("contorno", () => {
  const t0 = performance.now();
  const f = distanciaDoFundo(new Uint8Array(readFileSync("$T/rgba.raw")), $W, $H);
  const r = detectarContorno(f.distancia, $W, $H, { limiarDoFundo: ${3:-16} });
  const ms = Math.round(performance.now() - t0);
  const l = lerParedesDoTexto(comoTextoDeImportacao(r), { largura: $W, altura: $H }, []);
  writeFileSync("$T/r.json", JSON.stringify({ ...r, ms, fundoLiso: f.fundoLiso, importa: l.ok ? { p: l.paredes, d: l.portas, emendadas: l.emendadas, ignoradas: l.ignoradas } : l.erro }));
});
TS
npx vitest run src/lib/tmp_cont.test.ts 2>&1 | grep -E "Error|FAIL|rror:" | head -5; rm -f src/lib/tmp_cont.test.ts
.venv-mapas/bin/python - "$T" "$2" "${4:-}" <<'P'
import sys,json,cv2,math
T,out,ref=sys.argv[1:4]; d=json.load(open(T+'/r.json')); im=cv2.imread(T+'/img.png')
for s in d['paredes']: cv2.line(im,(int(s[0]),int(s[1])),(int(s[2]),int(s[3])),(0,0,255),2)
for s in d['portas']: cv2.line(im,(int(s[0]),int(s[1])),(int(s[2]),int(s[3])),(0,220,255),4)
cv2.imwrite(out,im); print(len(d['paredes']),'paredes',len(d['portas']),'portas',d['ms'],'ms | fundo liso:',d['fundoLiso'],'| importador:',d['importa'])
if ref:
    R=json.load(open(ref)); e=d['largura']/R['image']['width']
    rd=[(x['cx']*e,x['cy']*e) for x in R['doors'] if x['confidence']>=0.3]; md=[((s[0]+s[2])/2,(s[1]+s[3])/2) for s in d['portas']]
    tol=0.02*max(d['largura'],d['altura'])
    ac=sum(any(math.hypot(a[0]-b[0],a[1]-b[1])<=tol for b in md) for a in rd); so=sum(not any(math.hypot(a[0]-b[0],a[1]-b[1])<=tol for b in rd) for a in md)
    print(f'portas da referencia achadas: {ac}/{len(rd)} | minhas que a referencia nao tem: {so}')
P
