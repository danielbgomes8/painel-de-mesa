#!/usr/bin/env python3
"""Imagem ampliada com grade numerada, pra ler coordenadas a olho.
Uso: python grade.py mapa.jpg saida.png [--k 3] [--passo 25] [--recorte x0 y0 x1 y1]"""
import sys, cv2
a=sys.argv; k=int(a[a.index('--k')+1]) if '--k' in a else 3
passo=int(a[a.index('--passo')+1]) if '--passo' in a else 25
im=cv2.imread(a[1]); x0=y0=0
if '--recorte' in a:
    i=a.index('--recorte'); x0,y0,x1,y1=map(int,a[i+1:i+5]); im=im[y0:y1,x0:x1]
h,w=im.shape[:2]; b=cv2.resize(im,(w*k,h*k),interpolation=cv2.INTER_CUBIC)
for v in range((x0//passo+1)*passo, x0+w, passo):
    X=(v-x0)*k; cv2.line(b,(X,0),(X,h*k),(255,255,0),1); cv2.putText(b,str(v),(X+2,12),0,0.4,(0,255,255),1)
for v in range((y0//passo+1)*passo, y0+h, passo):
    Y=(v-y0)*k; cv2.line(b,(0,Y),(w*k,Y),(255,255,0),1); cv2.putText(b,str(v),(2,Y-2),0,0.4,(0,255,255),1)
cv2.imwrite(a[2],b)
