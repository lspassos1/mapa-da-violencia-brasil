#!/usr/bin/env bash
# Gera a carga nacional oficial e coloca-a onde o app a serve (modo 'official').
#
# Reproduz, de ponta a ponta, o caminho documentado em docs/CARGA_NACIONAL.md:
#   1. baixa as fontes oficiais (XLSX municipal SINESP/MJSP + populacao IBGE)
#   2. normaliza e faz o join SINESP + populacao
#   3. gera o JSON app-ready usando os centroides municipais nacionais
#   4. publica o resultado em public/officialCrimeData.json (asset estatico)
#
# A carga nacional e servida como asset estatico em public/ e carregada via fetch
# no modo 'official' — assim NAO entra no bundle JavaScript (nem do demo nem do
# official_sample). Depois: fazer commit do asset e publicar com
# NEXT_PUBLIC_CRIME_DATA_MODE=official.
#
# Nota: o download do XLSX do MJSP e grande/lento; corra isto numa maquina com
# rede estavel (nao em sandboxes com timeout curto).
set -euo pipefail

cd "$(dirname "$0")/.."

OUT_APP_READY="data/processed/app-ready/crime-map.json"
OUT_SERVED="public/officialCrimeData.json"

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
echo "Servido como asset estatico (fetch no modo 'official'); NAO entra no bundle JS."
if [ "$SIZE_KB" -gt 5120 ]; then
  echo "" >&2
  echo "AVISO: $OUT_SERVED tem ${SIZE_KB} KB (> 5 MB)." >&2
  echo "       O ficheiro e versionado (public/), logo o check 'Check tracked file size'" >&2
  echo "       do CI (ci.yml) vai FALHAR. Reduza o escopo (menos periodos/indicadores)" >&2
  echo "       ou sirva-o de outro storage em vez de o committar." >&2
fi
echo ""
echo "Proximos passos:"
echo "  - git add $OUT_SERVED && git commit"
echo "  - publicar com NEXT_PUBLIC_CRIME_DATA_MODE=official"
