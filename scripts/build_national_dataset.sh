#!/usr/bin/env bash
# Gera a carga nacional oficial e coloca-a onde o app a serve (modo 'official').
#
# Reproduz, de ponta a ponta, o caminho documentado em docs/CARGA_NACIONAL.md:
#   1. baixa as fontes oficiais (XLSX municipal SINESP/MJSP + populacao IBGE)
#   2. normaliza e faz o join SINESP + populacao
#   3. gera o JSON app-ready usando os centroides municipais nacionais
#   4. copia o resultado para src/data/officialCrimeData.json
#
# Depois: rever o tamanho do ficheiro (limite de 5 MB do CI), fazer commit e
# publicar com NEXT_PUBLIC_CRIME_DATA_MODE=official.
#
# Nota: o download do XLSX do MJSP e grande/lento; corra isto numa maquina com
# rede estavel (nao em sandboxes com timeout curto).
set -euo pipefail

cd "$(dirname "$0")/.."

OUT_APP_READY="data/processed/app-ready/crime-map.json"
OUT_SERVED="src/data/officialCrimeData.json"

echo "==> 1/4 Baixar fontes oficiais (populacao IBGE + XLSX municipal SINESP)"
python3 -m etl.official_data download --source ibge_population --source sinesp_municipios

echo "==> 2/4 Normalizar e juntar SINESP + populacao"
python3 -m etl.official_data normalize

echo "==> 3/4 Gerar JSON app-ready (centroides nacionais por omissao)"
python3 -m etl.official_data generate-app-ready

if [ ! -f "$OUT_APP_READY" ]; then
  echo "ERRO: $OUT_APP_READY nao foi gerado. Verifique os passos acima." >&2
  exit 1
fi

echo "==> 4/4 Publicar para o app: $OUT_SERVED"
cp "$OUT_APP_READY" "$OUT_SERVED"

SIZE_KB=$(du -k "$OUT_SERVED" | cut -f1)
echo ""
echo "Concluido. $OUT_SERVED (${SIZE_KB} KB)."
if [ "$SIZE_KB" -gt 5120 ]; then
  echo "AVISO: ficheiro acima de 5 MB — o check de tamanho do CI vai falhar." >&2
  echo "       Reduza o escopo (ex.: menos periodos) ou sirva o JSON de public/ via fetch." >&2
fi
echo ""
echo "Proximos passos:"
echo "  - git add $OUT_SERVED && git commit"
echo "  - publicar com NEXT_PUBLIC_CRIME_DATA_MODE=official"
