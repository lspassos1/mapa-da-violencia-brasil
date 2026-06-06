#!/usr/bin/env python3
"""Gera etl/reference/municipal_centroids.csv a partir da malha municipal IBGE.

Cada linha e `id_ibge,lat,lng`, onde o ponto e o centroide (formula do
shoelace) do maior poligono de cada municipio. Reproduz exatamente o ficheiro
versionado, para que a base de centroides possa ser regenerada apos uma
atualizacao da malha do IBGE.

Uso:
    # baixa a malha e gera o CSV
    python3 scripts/build_municipal_centroids.py

    # usa uma malha ja baixada
    python3 scripts/build_municipal_centroids.py --input /caminho/malha.geojson
"""
from __future__ import annotations

import argparse
import csv
import json
import urllib.request
from pathlib import Path

IBGE_MESH_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
OUTPUT = Path(__file__).resolve().parents[1] / "etl" / "reference" / "municipal_centroids.csv"


def ring_centroid_area(ring: list[list[float]]) -> tuple[float, float, float]:
    """Centroide e area (shoelace) do anel; cai na media dos vertices se degenerado."""
    a = cx = cy = 0.0
    for i in range(len(ring) - 1):
        x0, y0 = ring[i]
        x1, y1 = ring[i + 1]
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if a == 0:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return sum(xs) / len(xs), sum(ys) / len(ys), 0.0
    a *= 0.5
    return cx / (6 * a), cy / (6 * a), abs(a)


def feature_centroid(geom: dict) -> tuple[float, float]:
    if geom["type"] == "Polygon":
        cx, cy, _ = ring_centroid_area(geom["coordinates"][0])
        return cx, cy
    # MultiPolygon: usa o poligono de maior area (anel exterior).
    best = None
    for poly in geom["coordinates"]:
        cx, cy, area = ring_centroid_area(poly[0])
        if best is None or area > best[2]:
            best = (cx, cy, area)
    return best[0], best[1]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="GeoJSON da malha municipal (senao baixa do IBGE)")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()

    if args.input:
        mesh = json.loads(args.input.read_text(encoding="utf-8"))
    else:
        with urllib.request.urlopen(IBGE_MESH_URL, timeout=180) as response:  # noqa: S310
            mesh = json.loads(response.read().decode("utf-8"))

    rows = []
    for feature in mesh["features"]:
        id_ibge = str(feature["properties"]["codarea"])
        lon, lat = feature_centroid(feature["geometry"])
        rows.append((id_ibge, round(lat, 5), round(lon, 5)))
    rows.sort(key=lambda r: r[0])

    args.output.parent.mkdir(parents=True, exist_ok=True)
    # newline="\n" garante terminador Unix (LF), exigido pelo check de whitespace.
    with open(args.output, "w", newline="\n", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["id_ibge", "lat", "lng"])
        writer.writerows(rows)

    print(f"{len(rows)} municipios escritos em {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
