#!/bin/sh
# Imagem de mapa -> arquivo de paredes e portas, sozinho (o MESMO detector do botão "achar paredes sozinho" do app).
# Uso: gerar_paredes.sh imagem.png [saida.json] [escuras|claras|contorno|auto] [nivel 1-5]
# Saida: saida.json (formato do importador: cole no app ou escolha o arquivo) e saida.png (a imagem com o resultado por cima:
# vermelho = parede, amarelo = porta). "auto" escolhe contorno quando o fundo e liso e linhas escuras nos demais casos.
cd "$(dirname "$0")/../.." || exit 1
IMG=$(cd "$(dirname "$1")" && pwd)/$(basename "$1"); OUT="${2:-${1%.*}-paredes.json}"; OUT=$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")
MODO="${3:-auto}"; NIV="${4:-3}"
T="${TMPDIR:-/tmp}/gerar_paredes"; mkdir -p "$T"
DIM=$(.venv-mapas/bin/python - "$IMG" "$T" <<'P'
import sys,cv2
im=cv2.imread(sys.argv[1]);
if im is None: sys.exit("nao consegui abrir a imagem")
h,w=im.shape[:2]; e=min(1,1400/max(h,w))
if e<1: im=cv2.resize(im,(round(w*e),round(h*e)),interpolation=cv2.INTER_AREA)
h,w=im.shape[:2]; cv2.imwrite(sys.argv[2]+'/img.png',im)
cv2.cvtColor(im,cv2.COLOR_BGR2GRAY).tofile(sys.argv[2]+'/cinza.raw')
mx=im.max(axis=2).astype('float32'); mn=im.min(axis=2).astype('float32')
((mx-mn)/mx.clip(1)*255).round().astype('uint8').tofile(sys.argv[2]+'/sat.raw')
cv2.cvtColor(im,cv2.COLOR_BGR2RGBA).tofile(sys.argv[2]+'/rgba.raw'); print(w,h)
P
) || exit 1
W=${DIM% *}; H=${DIM#* }
cat > src/lib/tmp_gerar.test.ts <<TS
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { NIVEIS_DE_SENSIBILIDADE as N, aplicarComCor, aplicarDeteccao, prepararDeteccao } from "./detectarParedes";
import { LIMIAR_DO_FUNDO_POR_NIVEL, detectarContorno, distanciaDoFundo } from "./detectarContorno";
it("gerar", { timeout: 600000 }, () => {
  const nv = $NIV as 1 | 2 | 3 | 4 | 5;
  const n = N[nv];
  const cinza = new Uint8Array(readFileSync("$T/cinza.raw")), sat = new Uint8Array(readFileSync("$T/sat.raw")), rgba = new Uint8Array(readFileSync("$T/rgba.raw"));
  const f = distanciaDoFundo(rgba, $W, $H);
  const modo = "$MODO" === "auto" ? (f.fundoLiso ? "contorno" : "escuras") : "$MODO";
  const aj = { minimo: n.minimo, razao: n.razao };
  const r = modo === "contorno" ? detectarContorno(f.distancia, $W, $H, { limiarDoFundo: LIMIAR_DO_FUNDO_POR_NIVEL[nv], rgba })
    : modo === "claras" ? aplicarComCor(prepararDeteccao(cinza, $W, $H, { linhas: "claras", comp: n.comp, limiar: n.limiar, limiarLocal: n.limiarLocal }), prepararDeteccao(sat, $W, $H, { linhas: "escuras", comp: n.comp * 0.57, limiar: 0.6, limiarLocal: 0.4 }), { ...aj, minimoDaCor: n.minimo * 0.57, razaoDaCor: Math.min(0.9, n.razao + 0.15) })
    : aplicarDeteccao(prepararDeteccao(cinza, $W, $H, { linhas: "escuras", comp: n.comp, limiar: n.limiar, limiarLocal: n.limiarLocal }), aj);
  writeFileSync("$OUT", JSON.stringify({ largura: $W, altura: $H, paredes: r.paredes, portas: r.portas }));
  writeFileSync("$T/modo.txt", modo);
});
TS
npx vitest run src/lib/tmp_gerar.test.ts 2>&1 | grep -E "Error|FAIL|rror:" | head -5; rm -f src/lib/tmp_gerar.test.ts
.venv-mapas/bin/python - "$T" "$OUT" <<'P'
import sys,json,cv2
T,out=sys.argv[1:3]; d=json.load(open(out)); im=cv2.imread(T+'/img.png'); modo=open(T+'/modo.txt').read()
for s in d['paredes']: cv2.line(im,(int(s[0]),int(s[1])),(int(s[2]),int(s[3])),(0,0,255),2)
for s in d['portas']: cv2.line(im,(int(s[0]),int(s[1])),(int(s[2]),int(s[3])),(0,220,255),4)
png=out.rsplit('.',1)[0]+'.png'; cv2.imwrite(png,im)
print(f"modo {modo}: {len(d['paredes'])} paredes e {len(d['portas'])} portas -> {out}\nconferencia: {png}")
P
