#!/usr/bin/env python3
"""Converte o resultado do detectar_topologia.py no arquivo do "Importar paredes".

Uso:
    python converter_para_importacao.py resultado.json -o paredes.json [--max 400] [--confianca 0.3]

- Cada contorno vira trechos retos (Douglas-Peucker). A tolerancia sobe sozinha
  ate o total (paredes + portas) caber no limite do app (400 por cena).
- Portas com confianca abaixo do corte sao descartadas (o detector marca sem querer).
- O arquivo sai no formato { largura, altura, paredes: [[x1,y1,x2,y2]], portas: [...] }.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


def _dp(p, e):
    if len(p) < 3:
        return p
    (x1, y1), (x2, y2) = p[0], p[-1]
    L = math.hypot(x2 - x1, y2 - y1) or 1e-9
    m, idx = 0.0, 0
    for k in range(1, len(p) - 1):
        d = abs((x2 - x1) * (y1 - p[k][1]) - (x1 - p[k][0]) * (y2 - y1)) / L
        if d > m:
            m, idx = d, k
    if m > e:
        return _dp(p[: idx + 1], e)[:-1] + _dp(p[idx:], e)
    return [p[0], p[-1]]


def simplificar_anel(pts, e, ancoras=()):
    """Contorno fechado -> lista de pontos (sem repetir o primeiro no fim).

    `ancoras` sao indices de pontos que NAO podem sumir (onde uma porta encosta):
    sem isso a parede simplificada se afasta ate alguns pixels da ponta da porta
    e sobra fresta.
    """
    n = len(pts)
    marcas = sorted(set([0, n // 2, *ancoras]))
    saida = []
    for i, ini in enumerate(marcas):
        fim = marcas[i + 1] if i + 1 < len(marcas) else n
        trecho = pts[ini:fim] + [pts[fim % n]]
        saida += _dp(trecho, e)[:-1]
    return saida


def _ancoras_do_anel(anel, portas):
    """Indice do ponto do contorno mais perto de cada ponta de porta (ate 8 px)."""
    out = set()
    for d in portas:
        for x, y in ((d["x1"], d["y1"]), (d["x2"], d["y2"])):
            melhor, idx = 64.0, None
            for k, (px, py) in enumerate(anel):
                dd = (px - x) ** 2 + (py - y) ** 2
                if dd < melhor:
                    melhor, idx = dd, k
            if idx is not None:
                out.add(idx)
    return out


def montar(dados, tolerancia, confianca, maximo):
    paredes = []
    boas = [d for d in dados["doors"] if d.get("confidence", 1) >= confianca]
    for anel in dados["walls"]:
        if len(anel) < 4:
            continue
        pts = [tuple(p) for p in anel]
        pts = simplificar_anel(pts, tolerancia, _ancoras_do_anel(pts, boas))
        for i in range(len(pts)):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % len(pts)]
            if math.hypot(x2 - x1, y2 - y1) >= 3:
                paredes.append([round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)])
    portas = [
        [round(d["x1"], 1), round(d["y1"], 1), round(d["x2"], 1), round(d["y2"], 1)]
        for d in boas
    ]
    return paredes, portas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("entrada", type=Path)
    ap.add_argument("-o", "--saida", type=Path, default=Path("paredes.json"))
    ap.add_argument("--max", type=int, default=400, dest="maximo")
    ap.add_argument("--confianca", type=float, default=0.3)
    a = ap.parse_args()

    dados = json.loads(a.entrada.read_text(encoding="utf-8"))
    tol = 1.5
    while True:
        paredes, portas = montar(dados, tol, a.confianca, a.maximo)
        if len(paredes) + len(portas) <= a.maximo or tol > 40:
            break
        tol *= 1.25
    if len(paredes) + len(portas) > a.maximo:
        raise SystemExit(f"Nem com tolerancia {tol:.1f}px coube em {a.maximo} trechos.")

    saida = {
        "largura": dados["image"]["width"],
        "altura": dados["image"]["height"],
        "paredes": paredes,
        "portas": portas,
    }
    a.saida.write_text(json.dumps(saida, ensure_ascii=False), encoding="utf-8")
    print(f"{len(paredes)} paredes + {len(portas)} portas (tolerancia {tol:.1f}px) -> {a.saida}")


if __name__ == "__main__":
    main()
