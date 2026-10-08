#!/bin/sh
# Mede o detector do app em TODOS os mapas de uma pasta, nos tres modos, e imprime uma tabela.
# A pasta tem pares <nome>.png (lado maior <= 1400) + <nome>.json (gabarito: largura, altura, paredes, portas),
# como sai de gabarito_watabou.py. Uso: medir_todos.sh pasta [nivel 1-5]
cd "$(dirname "$0")/../.." || exit 1
PASTA=$(cd "$1" && pwd); NIV="${2:-3}"
T="${TMPDIR:-/tmp}/medir_todos"; mkdir -p "$T"
NOMES=$(cd "$PASTA" && ls *.json | sed 's/\.json$//' | tr '\n' ' ')
.venv-mapas/bin/python - "$PASTA" "$T" $NOMES <<'P'
import sys,cv2,json
pasta,T,*nomes=sys.argv[1:]
for n in nomes:
    im=cv2.imread(f'{pasta}/{n}.png'); h,w=im.shape[:2]
    cv2.cvtColor(im,cv2.COLOR_BGR2GRAY).tofile(f'{T}/{n}.cinza')
    mx=im.max(axis=2).astype('float32'); mn=im.min(axis=2).astype('float32')
    ((mx-mn)/mx.clip(1)*255).round().astype('uint8').tofile(f'{T}/{n}.sat')
    cv2.cvtColor(im,cv2.COLOR_BGR2RGBA).tofile(f'{T}/{n}.rgba')
    json.dump({'w':w,'h':h},open(f'{T}/{n}.dim','w'))
P
cat > src/lib/tmp_medir.test.ts <<TS
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { NIVEIS_DE_SENSIBILIDADE as N, aplicarComCor, aplicarDeteccao, prepararDeteccao } from "./detectarParedes";
import { LIMIAR_DO_FUNDO_POR_NIVEL, detectarContorno, distanciaDoFundo } from "./detectarContorno";
it("medir", { timeout: 600000 }, () => {
  const n = N[$NIV as 1 | 2 | 3 | 4 | 5];
  for (const nome of "$NOMES".trim().split(/\s+/)) {
    const { w, h } = JSON.parse(readFileSync("$T/" + nome + ".dim", "utf8"));
    const cinza = new Uint8Array(readFileSync("$T/" + nome + ".cinza")), sat = new Uint8Array(readFileSync("$T/" + nome + ".sat"));
    const rgba = new Uint8Array(readFileSync("$T/" + nome + ".rgba"));
    const sai: Record<string, unknown> = {};
    const aj = { minimo: n.minimo, razao: n.razao };
    const t = (f: () => { paredes: number[][]; portas: number[][] }) => { const t0 = performance.now(); const r = f(); return { ...r, ms: Math.round(performance.now() - t0) }; };
    sai.escuras = t(() => aplicarDeteccao(prepararDeteccao(cinza, w, h, { linhas: "escuras", comp: n.comp, limiar: n.limiar, limiarLocal: n.limiarLocal }), aj));
    sai.claras = t(() => aplicarComCor(prepararDeteccao(cinza, w, h, { linhas: "claras", comp: n.comp, limiar: n.limiar, limiarLocal: n.limiarLocal }), prepararDeteccao(sat, w, h, { linhas: "escuras", comp: n.comp * 0.57, limiar: 0.6, limiarLocal: 0.4 }), { ...aj, minimoDaCor: n.minimo * 0.57, razaoDaCor: Math.min(0.9, n.razao + 0.15) }));
    const f = distanciaDoFundo(rgba, w, h);
    sai.contorno = t(() => detectarContorno(f.distancia, w, h, { limiarDoFundo: LIMIAR_DO_FUNDO_POR_NIVEL[$NIV as 1 | 2 | 3 | 4 | 5], rgba }));
    sai.fundoLiso = f.fundoLiso;
    writeFileSync("$T/" + nome + ".res", JSON.stringify(sai));
  }
});
TS
npx vitest run src/lib/tmp_medir.test.ts 2>&1 | grep -E "Error|FAIL|rror:|✓|passed" | head -8; rm -f src/lib/tmp_medir.test.ts
.venv-mapas/bin/python - "$PASTA" "$T" $NOMES <<'P'
import sys,json,math,os
sys.path.insert(0,'scripts/mapas')
import importlib.util
sp=importlib.util.spec_from_file_location('av','scripts/mapas/avaliar.py'); av=importlib.util.module_from_spec(sp); sp.loader.exec_module(av)
pasta,T,*nomes=sys.argv[1:]
def pr(g,d,tol): return av.cobertura(g,d,tol),av.cobertura(d,g,tol)
print(f"{'mapa':<10}{'liso':<6}{'modo':<9}{'rec6':>6}{'pre6':>6}{'rec12':>7}{'pre12':>7}{'paredes':>8}{'portas ach/gab+falsas':>16}{'ms':>6}")
tot={}
for n in nomes:
    g=json.load(open(f'{pasta}/{n}.json')); r=json.load(open(f'{T}/{n}.res'))
    gp=g['paredes']; gd=g['portas']; tolp=0.02*max(g['largura'],g['altura'])
    for m in ('escuras','claras','contorno'):
        d=r[m]; det=d['paredes']+d['portas']; gab=gp+gd
        r6,p6=pr(gab,det,6); r12,p12=pr(gab,det,12)
        cd=[((s[0]+s[2])/2,(s[1]+s[3])/2) for s in d['portas']]; gc=[((s[0]+s[2])/2,(s[1]+s[3])/2) for s in gd]
        ach=sum(any(math.hypot(a[0]-b[0],a[1]-b[1])<=tolp for b in cd) for a in gc)
        fal=sum(not any(math.hypot(a[0]-b[0],a[1]-b[1])<=tolp for b in gc) for a in cd)
        import cv2
        im=cv2.imread(f'{pasta}/{n}.png')
        for a in gp+gd: cv2.line(im,(int(a[0]),int(a[1])),(int(a[2]),int(a[3])),(0,170,0),2)
        for a in d['paredes']: cv2.line(im,(int(a[0]),int(a[1])),(int(a[2]),int(a[3])),(0,0,255),2)
        for a in d['portas']: cv2.line(im,(int(a[0]),int(a[1])),(int(a[2]),int(a[3])),(0,200,255),4)
        cv2.imwrite(f'{T}/{n}_{m}.png',im)
        print(f"{n:<10}{str(r['fundoLiso']):<6}{m:<9}{r6:>6.0%}{p6:>6.0%}{r12:>7.0%}{p12:>7.0%}{len(d['paredes']):>8}{ach:>6}/{len(gc):<3}+{fal:<4}{d['ms']:>6}")
        for k,v in (('rec12',r12),('pre12',p12),('porta',ach/len(gc) if gc else 0),('pfal',fal/max(1,len(cd)))): tot.setdefault(m,{}).setdefault(k,[]).append(v)
print()
for m,t in tot.items(): print(f"MEDIA {m:<9} rec12 {sum(t['rec12'])/len(t['rec12']):.0%}  pre12 {sum(t['pre12'])/len(t['pre12']):.0%}  portas {sum(t['porta'])/len(t['porta']):.0%} (falsas {sum(t['pfal'])/len(t['pfal']):.0%} das achadas)")
P
