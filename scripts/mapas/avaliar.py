#!/usr/bin/env python3
"""Compara paredes detectadas com um gabarito (mesmo formato do importador).
recall = % do gabarito coberto por algum detectado (a ate `tol` px);
precisao = % do detectado que fica perto de alguma parede do gabarito.
Uso: python avaliar.py detectado.json gabarito.json [--tol 6]"""
import json, sys, math
def pts(s,passo=2):
    x1,y1,x2,y2=s;L=math.hypot(x2-x1,y2-y1);n=max(1,int(L/passo))
    return [(x1+(x2-x1)*i/n,y1+(y2-y1)*i/n) for i in range(n+1)]
def dist(p,s):
    x1,y1,x2,y2=s;dx,dy=x2-x1,y2-y1;L2=dx*dx+dy*dy
    t=0 if L2==0 else max(0,min(1,((p[0]-x1)*dx+(p[1]-y1)*dy)/L2))
    return math.hypot(p[0]-x1-t*dx,p[1]-y1-t*dy)
def cobertura(a,b,tol):
    tot=ok=0
    for s in a:
        for p in pts(s):
            tot+=1;ok+=any(dist(p,t)<=tol for t in b)
    return ok/tot if tot else 0
def carregar(f):
    d=json.load(open(f));return d['paredes']+d.get('portas',[])
if __name__=="__main__":
    tol=float(sys.argv[sys.argv.index('--tol')+1]) if '--tol' in sys.argv else 6
    det,gab=carregar(sys.argv[1]),carregar(sys.argv[2])
    print(f"recall {cobertura(gab,det,tol):.0%}  precisao {cobertura(det,gab,tol):.0%}  ({len(det)} detectados)")
