#!/usr/bin/env python3
"""Detector v3 (experimental): acha paredes pelo CONTRASTE, sem exigir fundo preto.

Ideia: parede de mapa e uma linha escura e fina em cima de um chao mais claro.
O "black-hat" morfologico realca justamente isso (escuro e mais fino que o
nucleo), e funciona com fundo de papel, madeira ou textura. Depois o
esqueleto da mascara vira segmentos (Hough) e so ficam os retos e compridos.

Uso: python paredes_por_contraste.py mapa.png -o paredes.json [--debug anotado.png]
"""
from __future__ import annotations
import argparse, json, math
from pathlib import Path
import cv2, numpy as np


def detectar(img, espessura=None, minimo=None):
    h, w = img.shape[:2]
    lado = max(h, w)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    esp = espessura or max(5, lado // 28)          # tamanho do nucleo > espessura da parede
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (esp | 1, esp | 1))
    bh = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, k)
    _, m = cv2.threshold(bh, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # so retas: abre com linhas horizontais e verticais compridas
    comp = minimo or max(15, lado // 18)
    hor = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (comp, 1)))
    ver = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, comp)))
    return hor, ver


def segmentos(mascara, vertical):
    n, lab, st, _ = cv2.connectedComponentsWithStats(mascara, 8)
    out = []
    for i in range(1, n):
        x, y, ww, hh, a = st[i]
        if vertical:
            if hh < ww * 3: continue
            cx = x + ww / 2
            out.append([float(round(cx, 1)), int(y), float(round(cx, 1)), int(y + hh)])
        else:
            if ww < hh * 3: continue
            cy = y + hh / 2
            out.append([int(x), float(round(cy, 1)), int(x + ww), float(round(cy, 1))])
    return out


def fundir(segs, lado, folga_off=4, folga_vao=None, vao_minimo=None):
    """Junta segmentos na mesma linha. Cada VAO entre dois pedaços da mesma linha,
    com largura de porta (entre `vao_minimo` e `folga_vao`), vira candidato a porta."""
    folga_vao = folga_vao or lado * 0.09
    vao_minimo = vao_minimo or lado * 0.025
    hs = sorted([s for s in segs if s[1] == s[3]], key=lambda s: (s[1], s[0]))
    vs = sorted([s for s in segs if s[0] == s[2]], key=lambda s: (s[0], s[1]))
    vaos = []
    def juntar(lista, eixo):
        out = []
        off = 1 if eixo == "h" else 0
        a, b = (0, 2) if eixo == "h" else (1, 3)
        for s in lista:
            for o in out:
                if abs(o[off] - s[off]) <= folga_off and s[a] <= o[b] + folga_vao and s[b] >= o[a] - folga_vao:
                    if s[a] - o[b] >= vao_minimo:
                        pos = (o[off] + s[off]) / 2
                        vaos.append((eixo, pos, o[b], s[a]))
                    o[a] = min(o[a], s[a]); o[b] = max(o[b], s[b])
                    o[off] = o[off + 2] = (o[off] + s[off]) / 2
                    break
            else:
                out.append(list(s))
        return out
    return juntar(hs, "h") + juntar(vs, "v"), vaos


def portas_dos_vaos(vaos, paredes):
    """So vale vao que ficou DENTRO de uma parede que sobreviveu ao filtro."""
    portas = []
    for eixo, pos, ini, fim in vaos:
        for w in paredes:
            if eixo == "h" and w[1] == w[3] and abs(w[1] - pos) <= 4 and w[0] <= ini + 1 and w[2] >= fim - 1:
                portas.append([round(ini, 1), round(pos, 1), round(fim, 1), round(pos, 1)]); break
            if eixo == "v" and w[0] == w[2] and abs(w[0] - pos) <= 4 and w[1] <= ini + 1 and w[3] >= fim - 1:
                portas.append([round(pos, 1), round(ini, 1), round(pos, 1), round(fim, 1)]); break
    return portas


def filtrar(segs, lado, frac=0.12):
    return [s for s in segs if math.hypot(s[2] - s[0], s[3] - s[1]) >= lado * frac]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mapa", type=Path)
    ap.add_argument("-o", "--saida", type=Path, default=Path("paredes.json"))
    ap.add_argument("--debug", type=Path)
    ap.add_argument("--minimo", type=float, default=0.12, help="comprimento minimo (fracao do lado maior)")
    a = ap.parse_args()
    img = cv2.imread(str(a.mapa))
    hor, ver = detectar(img)
    segs = segmentos(hor, False) + segmentos(ver, True)
    h, w = img.shape[:2]
    juntas, vaos = fundir(segs, max(h, w))
    segs = filtrar(juntas, max(h, w), a.minimo)
    portas = portas_dos_vaos(vaos, segs)
    a.saida.write_text(json.dumps({"largura": w, "altura": h, "paredes": segs, "portas": portas}))
    if a.debug:
        o = img.copy()
        for s in segs: cv2.line(o, (int(s[0]), int(s[1])), (int(s[2]), int(s[3])), (0, 0, 255), 2)
        for s in portas: cv2.line(o, (int(s[0]), int(s[1])), (int(s[2]), int(s[3])), (0, 255, 255), 4)
        cv2.imwrite(str(a.debug), o)
    print(len(segs), "paredes,", len(portas), "portas")


if __name__ == "__main__":
    main()
