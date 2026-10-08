#!/bin/sh
# Baixa os mapas do Watabou e monta os gabaritos exatos. Uso: preparar_watabou.sh pasta
# Fica em <pasta>/bruto (PNG grande + JSON do gerador) e <pasta>/gab (PNG 1400 px + gabarito) — esta e a
# que o medir_todos.sh le. Nada disso vai pro Git (as imagens sao regeneraveis).
cd "$(dirname "$0")/../.." || exit 1
mkdir -p "$1"; P=$(cd "$1" && pwd); mkdir -p "$P/bruto" "$P/gab"
node scripts/mapas/baixar_watabou.mjs "$P/bruto" || exit 1
for j in "$P"/bruto/*.json; do
  n=$(basename "$j" .json)
  .venv-mapas/bin/python scripts/mapas/gabarito_watabou.py "$j" "$P/bruto/$n.png" "$P/gab/$n" || exit 1
done
echo "pronto: scripts/mapas/medir_todos.sh $P/gab"
