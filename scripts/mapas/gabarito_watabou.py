#!/usr/bin/env python3
"""Gabarito EXATO de um mapa do One Page Dungeon (Watabou), sem desenhar nada a mao.
O gerador exporta o desenho em JSON (retangulos de chao em quadradinhos + portas) e o PNG;
aqui a geometria vira paredes/portas e e alinhada ao PNG (escala e deslocamento achados por
correlacao com os pixels escuros). Saida: imagem reduzida (lado maior 1400, como o app analisa)
e gabarito no formato do importador, em px dessa imagem.
Uso: gabarito_watabou.py mapa.json mapa.png saida_prefixo [--debug]
Gera saida_prefixo.png e saida_prefixo.json (e saida_prefixo_debug.png com --debug).
Licenca dos mapas: o Watabou libera o uso dos mapas gerados (itch.io/watabou)."""
import json, sys, math
import cv2, numpy as np

LADO = 1400

def chao(d):
    """(celulas inteiras do chao, rotundas) a partir dos retangulos."""
    cel, rot = set(), []
    for r in d['rects']:
        if r.get('rotunda'):
            rot.append((r['x'] + r['w'] / 2, r['y'] + r['h'] / 2, r['w'] / 2))
        else:
            for i in range(r['w']):
                for j in range(r['h']): cel.add((r['x'] + i, r['y'] + j))
    return cel, rot

def dentro_rotunda(rot, x, y):
    return any((x - cx) ** 2 + (y - cy) ** 2 < (rr - 0.01) ** 2 for cx, cy, rr in rot)

def paredes_em_unidades(d):
    cel, rot = chao(d)
    seg = []
    def livre(i, j): return (i, j) in cel
    # arestas de celula entre chao e nao-chao; sem as que ficam dentro de uma rotunda
    for (i, j) in cel:
        for (di, dj, a, b) in ((0, -1, (i, j), (i + 1, j)), (0, 1, (i, j + 1), (i + 1, j + 1)),
                               (-1, 0, (i, j), (i, j + 1)), (1, 0, (i + 1, j), (i + 1, j + 1))):
            if livre(i + di, j + dj): continue
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            if dentro_rotunda(rot, mx, my): continue
            seg.append([a[0], a[1], b[0], b[1]])
    for cx, cy, rr in rot:
        n = 48
        for k in range(n):
            a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
            p, q = (cx + rr * math.cos(a0), cy + rr * math.sin(a0)), (cx + rr * math.cos(a1), cy + rr * math.sin(a1))
            mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
            if (math.floor(mx), math.floor(my)) in cel and not dentro_rotunda([(cx, cy, rr - 0.3)], mx, my) and False: continue
            # tira o pedaco do circulo que cai dentro de um corredor/comodo retangular vizinho
            if any((math.floor(mx + dx * 0.15), math.floor(my + dy * 0.15)) in cel for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) and (math.floor(mx), math.floor(my)) in cel:
                continue
            seg.append([p[0], p[1], q[0], q[1]])
    return seg, cel, rot

def juntar(seg):
    """Une segmentos colineares e encostados (horizontais/verticais)."""
    h, v, o = {}, {}, []
    for a, b, c, e in seg:
        if b == e and abs(a - c) > 0 and a == round(a) and c == round(c): h.setdefault(b, []).append(sorted((a, c)))
        elif a == c and a == round(a) and b == round(b): v.setdefault(a, []).append(sorted((b, e)))
        else: o.append([a, b, c, e])
    for y, l in h.items():
        l.sort(); cur = list(l[0])
        for s0, s1 in l[1:]:
            if s0 <= cur[1]: cur[1] = max(cur[1], s1)
            else: o.append([cur[0], y, cur[1], y]); cur = [s0, s1]
        o.append([cur[0], y, cur[1], y])
    for x, l in v.items():
        l.sort(); cur = list(l[0])
        for s0, s1 in l[1:]:
            if s0 <= cur[1]: cur[1] = max(cur[1], s1)
            else: o.append([x, cur[0], x, cur[1]]); cur = [s0, s1]
        o.append([x, cur[0], x, cur[1]])
    return o

def portas_em_unidades(d, ox=0.5, oy=0.5):
    out = []
    for p in d['doors']:
        dx, dy = p['dir']['x'], p['dir']['y']
        cx, cy = p['x'] + ox, p['y'] + oy   # a porta e a propria celula 1x1 (x, y); dir e o eixo por onde se passa
        if dx != 0: out.append([cx, cy - 0.5, cx, cy + 0.5])
        else: out.append([cx - 0.5, cy, cx + 0.5, cy])
    return out

def alinhar(img, seg):
    """Acha escala e deslocamento (unidade -> px) casando as paredes com os pixels escuros.
    1) escala e posicao aproximada com os pixels escuros crus; 2) posicao fina, na escala achada,
    com a abertura morfologica que tira o pontilhado do sombreado e deixa so as linhas."""
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    cru = (g < 80).astype(np.uint8)
    xs = [v for s in seg for v in (s[0], s[2])]; ys = [v for s in seg for v in (s[1], s[3])]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    h, w = g.shape
    def molde(esc, esp=2):
        tw, th = int((x1 - x0) * esc) + 8, int((y1 - y0) * esc) + 8
        if tw >= w or th >= h: return None
        mod = np.zeros((th, tw), np.float32)
        for a, b, c, e in seg:
            cv2.line(mod, (round((a - x0) * esc) + 4, round((b - y0) * esc) + 4), (round((c - x0) * esc) + 4, round((e - y0) * esc) + 4), 1.0, esp)
        return cv2.GaussianBlur(mod, (0, 0), 1.5)
    escuro = cv2.GaussianBlur(cru.astype(np.float32), (0, 0), 2)
    melhor = [-1, None]
    def tentar(esc, base, guardar=True):
        mod = molde(esc)
        if mod is None: return False
        r = cv2.matchTemplate(base, mod, cv2.TM_CCORR)
        _, mx, _, loc = cv2.minMaxLoc(r); mx /= (mod.sum() + 1e-6)
        if guardar and mx > melhor[0]: melhor[:] = [mx, (esc, loc[0] - 4 - x0 * esc, loc[1] - 4 - y0 * esc)]
        return True
    for esc in np.arange(16, 70, 0.5):
        if not tentar(esc, escuro): break
    e0 = melhor[1][0]
    for esc in np.arange(e0 - 0.7, e0 + 0.71, 0.04): tentar(esc, escuro)
    esc, ox, oy = melhor[1]
    # posicao fina na escala achada, sobre as linhas sem pontilhado
    aberto = cv2.morphologyEx(cru, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    base = cv2.GaussianBlur(aberto.astype(np.float32), (0, 0), 1.2)
    mod = molde(esc, 3)
    mx0, my0 = int(round(ox + x0 * esc)) - 4, int(round(oy + y0 * esc)) - 4
    m = 24
    xa, ya = max(0, mx0 - m), max(0, my0 - m)
    recorte = base[ya:min(h, my0 + mod.shape[0] + m), xa:min(w, mx0 + mod.shape[1] + m)]
    r = cv2.matchTemplate(recorte, mod, cv2.TM_CCORR)
    _, mx, _, loc = cv2.minMaxLoc(r)
    nx, ny = xa + loc[0] + 4, ya + loc[1] + 4
    ox, oy = nx - x0 * esc, ny - y0 * esc
    return mx / (mod.sum() + 1e-6), (esc, ox, oy)

def main():
    jf, pf, pre = sys.argv[1:4]; dbg = '--debug' in sys.argv
    d = json.load(open(jf)); im = cv2.imread(pf)
    h, w = im.shape[:2]; e = min(1, LADO / max(h, w))
    if e < 1: im = cv2.resize(im, (round(w * e), round(h * e)), interpolation=cv2.INTER_AREA)
    h, w = im.shape[:2]
    seg, cel, rot = paredes_em_unidades(d)
    seg = juntar(seg)
    sc, (esc, ox, oy) = alinhar(im, seg)
    # refino fino ao redor da escala achada
    f = lambda s: [round(s[0] * esc + ox, 1), round(s[1] * esc + oy, 1), round(s[2] * esc + ox, 1), round(s[3] * esc + oy, 1)]
    pa = [f(s) for s in seg]; po = [f(s) for s in portas_em_unidades(d)]
    json.dump({'largura': w, 'altura': h, 'paredes': pa, 'portas': po, 'escala_px_por_quadrado': esc}, open(pre + '.json', 'w'))
    cv2.imwrite(pre + '.png', im)
    print(f'{pre}: {w}x{h} escala {esc:.1f}px/quadrado, {len(pa)} paredes, {len(po)} portas, ajuste {sc:.2f}')
    if dbg:
        k = 1; o = im.copy()
        for s in pa: cv2.line(o, (int(s[0]), int(s[1])), (int(s[2]), int(s[3])), (0, 0, 255), 2)
        for s in po: cv2.line(o, (int(s[0]), int(s[1])), (int(s[2]), int(s[3])), (0, 200, 255), 4)
        cv2.imwrite(pre + '_debug.png', o)
main()
