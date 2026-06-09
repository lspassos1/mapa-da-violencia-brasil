#!/usr/bin/env python3
"""Gera etl/reference/uf_population.csv (uf,ano,populacao) a partir do IBGE.

Usa a estimativa de populacao residente por UF (SIDRA agregado 6579, variavel
9324). Anos sem estimativa publicada (ex.: censo/anos futuros) sao preenchidos
pelo ano disponivel mais proximo, para que a taxa por 100 mil dos indicadores
estaduais exista em toda a serie do VDE (2015-2026).
"""
from __future__ import annotations

import csv
import json
import urllib.request
from pathlib import Path

YEARS = list(range(2015, 2027))  # 2015..2026 (serie do VDE)
AGG_URL = (
    "https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/"
    + "|".join(str(y) for y in YEARS)
    + "/variaveis/9324?localidades=N3[all]"
)
OUTPUT = Path(__file__).resolve().parents[1] / "etl" / "reference" / "uf_population.csv"

UF_BY_CODE = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP",
    "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB",
    "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES",
    "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS",
    "51": "MT", "52": "GO", "53": "DF",
}


def nearest_fill(by_year: dict[int, int]) -> dict[int, int]:
    """Preenche todos os YEARS a partir do ano disponivel mais proximo."""
    have = sorted(by_year)
    out: dict[int, int] = {}
    for year in YEARS:
        if year in by_year:
            out[year] = by_year[year]
        else:
            nearest = min(have, key=lambda y: (abs(y - year), y))
            out[year] = by_year[nearest]
    return out


def main() -> int:
    with urllib.request.urlopen(AGG_URL, timeout=120) as response:  # noqa: S310
        payload = json.loads(response.read().decode("utf-8"))

    series = payload[0]["resultados"][0]["series"]
    rows = []
    for entry in series:
        code = str(entry["localidade"]["id"])
        uf = UF_BY_CODE.get(code)
        if not uf:
            continue
        by_year = {}
        for year_str, value in entry["serie"].items():
            try:
                by_year[int(year_str)] = int(value)
            except (TypeError, ValueError):
                continue
        filled = nearest_fill(by_year)
        for year, pop in filled.items():
            rows.append((uf, year, pop))

    rows.sort(key=lambda r: (r[0], r[1]))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["uf", "ano", "populacao"])
        writer.writerows(rows)
    print(f"{len(rows)} linhas ({len(set(r[0] for r in rows))} UF x {len(YEARS)} anos) -> {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
