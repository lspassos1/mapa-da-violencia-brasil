#!/usr/bin/env python3
"""Gera malhas municipais por estado em public/geo/municipios/{UF}.json.gz.

A partir da malha municipal do IBGE (qualidade minima), agrupa os municipios por
UF e escreve um GeoJSON gzipado por estado, com `properties.id` = id_ibge (7
digitos). Sao carregados sob demanda quando o utilizador clica num estado, para
desenhar as cidades com fronteiras reais (em vez de circulos).

A precisao das coordenadas e reduzida (4 casas ~ 11 m) para encolher os ficheiros
sem perda visual relevante. Cada ficheiro fica bem abaixo do limite de 5 MB do CI.

Uso:
    # baixa a malha e gera os 27 ficheiros
    python3 scripts/build_state_municipal_meshes.py

    # usa uma malha ja baixada
    python3 scripts/build_state_municipal_meshes.py --input /tmp/ibge_mun.geojson
"""
from __future__ import annotations

import argparse
import gzip
import json
import urllib.request
from collections import defaultdict
from pathlib import Path

IBGE_MESH_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
OUT_DIR = Path(__file__).resolve().parents[1] / "public" / "geo" / "municipios"

# Codigo IBGE da UF (2 primeiros digitos do id do municipio) -> sigla.
UF_BY_CODE = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP",
    "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB",
    "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES",
    "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS",
    "51": "MT", "52": "GO", "53": "DF",
}

PRECISION = 4  # casas decimais (~11 m)


def round_coords(node):
    """Reduz a precisao das coordenadas recursivamente (listas aninhadas)."""
    if isinstance(node, list):
        if node and isinstance(node[0], (int, float)):
            return [round(node[0], PRECISION), round(node[1], PRECISION)]
        return [round_coords(child) for child in node]
    return node


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="GeoJSON da malha (senao baixa do IBGE)")
    parser.add_argument("--out", type=Path, default=OUT_DIR)
    args = parser.parse_args()

    if args.input:
        mesh = json.loads(args.input.read_text(encoding="utf-8"))
    else:
        with urllib.request.urlopen(IBGE_MESH_URL, timeout=180) as response:  # noqa: S310
            mesh = json.loads(response.read().decode("utf-8"))

    by_uf: dict[str, list] = defaultdict(list)
    for feature in mesh["features"]:
        id_ibge = str(feature["properties"]["codarea"])
        uf = UF_BY_CODE.get(id_ibge[:2])
        if not uf:
            continue
        by_uf[uf].append(
            {
                "type": "Feature",
                "properties": {"id": id_ibge},
                "geometry": {
                    "type": feature["geometry"]["type"],
                    "coordinates": round_coords(feature["geometry"]["coordinates"]),
                },
            }
        )

    args.out.mkdir(parents=True, exist_ok=True)
    total = 0
    for uf, feats in sorted(by_uf.items()):
        fc = {"type": "FeatureCollection", "features": feats}
        raw = json.dumps(fc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        path = args.out / f"{uf}.json.gz"
        with gzip.open(path, "wb", compresslevel=9) as handle:
            handle.write(raw)
        kb = round(path.stat().st_size / 1024, 1)
        total += path.stat().st_size
        print(f"{uf}: {len(feats):>4} municipios -> {path.name} ({kb} KB gz)")
    print(f"27 UF -> {round(total/1e6, 2)} MB gz total em {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
