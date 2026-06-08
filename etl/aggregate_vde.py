#!/usr/bin/env python3
"""Agrega a Base VDE do SINESP (XLSX por ano) numa carga nacional compacta.

Os ficheiros do VDE sao grandes (~28 MB cada, ~286 MB de XML por ano), por isso
sao lidos por streaming (iterparse) com a memoria limitada. Cada linha e
agregada por (id_ibge, periodo, indicador) somando as vitimas/ocorrencias.

Schema de entrada (colunas):
  uf, municipio, evento, data_referencia, agente, arma, faixa_etaria,
  feminino, masculino, nao_informado, total_vitima, total, total_peso, abrangencia

Uso:
  python3 -m etl.aggregate_vde diagnose --year 2025
  python3 -m etl.aggregate_vde build --granularity anual --out public/officialCrimeData.json
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import unicodedata
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

from etl.official_data import (
    APP_INDICATOR_KEYS,
    PROCESSED_DIR,
    SINESP_WITH_POPULATION_FIELDNAMES,
    canonical_indicator_code,
    generate_app_ready_dataset,
    list_xlsx_sheets,
    parse_optional_int,
    parse_optional_month_year,
    utc_now,
    write_csv,
)

OFFICIAL_DATASET_GZ = Path(__file__).resolve().parents[1] / "public" / "officialCrimeData.json.gz"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
VDE_DIR = PROJECT_ROOT / "data" / "raw" / "vde"
REGISTRY_CSV = PROJECT_ROOT / "data" / "processed" / "ibge_municipalities.csv"
POPULATION_CSV = PROJECT_ROOT / "data" / "processed" / "ibge_population_2025.csv"

# Unidade canonica por indicador da app (os municipais do VDE sao de vitima).
INDICATOR_UNIT = {
    "homicidioDoloso": "vitimas",
    "tentativaHomicidio": "vitimas",
    "latrocinio": "vitimas",
    "lesaoCorporalMorte": "vitimas",
    "morteIntervencaoEstado": "vitimas",
    "feminicidio": "vitimas",
    "estupro": "ocorrencias",
    "estuproVulneravel": "ocorrencias",
    "rouboVeiculos": "ocorrencias",
    "furtoVeiculos": "ocorrencias",
    "rouboCarga": "ocorrencias",
    "rouboInstituicaoFinanceira": "ocorrencias",
    "traficoDrogas": "ocorrencias",
}
APP_KEY_TO_CODE = {app_key: code for code, app_key in APP_INDICATOR_KEYS.items()}

MAIN_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# Indice de coluna (A=0) -> nome logico, conforme o cabecalho do VDE.
COL = {
    "uf": 0,
    "municipio": 1,
    "evento": 2,
    "data_referencia": 3,
    "total_vitima": 10,
    "total": 11,
}


def strip_accents_upper(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text or "")
    no_accents = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", no_accents).strip().upper()


def name_key(uf: str, municipio: str) -> str:
    return f"{strip_accents_upper(uf)}|{strip_accents_upper(municipio)}"


def column_letter_index(ref: str) -> int:
    letters = "".join(ch for ch in ref if ch.isalpha())
    index = 0
    for ch in letters:
        index = index * 26 + (ord(ch) - ord("A") + 1)
    return index - 1


def load_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    strings = []
    for si in root.findall(f"{MAIN_NS}si"):
        parts = [node.text or "" for node in si.iter(f"{MAIN_NS}t")]
        strings.append("".join(parts))
    return strings


def cell_value(cell: ET.Element, shared: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.iter(f"{MAIN_NS}t"))
    value = cell.find(f"{MAIN_NS}v")
    if value is None or value.text is None:
        return ""
    if cell_type == "s":
        try:
            return shared[int(value.text)]
        except (ValueError, IndexError):
            return ""
    return value.text


def stream_rows(path: Path):
    """Itera linhas (lista de strings indexada por coluna) com memoria limitada."""
    sheets = list_xlsx_sheets(path)
    sheet_path = sheets[0]["path"] if sheets else "xl/worksheets/sheet1.xml"
    with zipfile.ZipFile(path) as archive:
        shared = load_shared_strings(archive)
        with archive.open(sheet_path) as handle:
            for _event, elem in ET.iterparse(handle, events=("end",)):
                if elem.tag != f"{MAIN_NS}row":
                    continue
                values: list[str] = []
                for cell in elem.findall(f"{MAIN_NS}c"):
                    idx = column_letter_index(cell.attrib.get("r", "A1"))
                    while len(values) <= idx:
                        values.append("")
                    values[idx] = cell_value(cell, shared)
                yield values
                elem.clear()


def load_registry() -> dict[str, str]:
    import csv

    mapping: dict[str, str] = {}
    with open(REGISTRY_CSV, encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            mapping[name_key(row["uf"], row["municipio"])] = row["id_ibge"]
    return mapping


def load_registry_by_id() -> dict[str, tuple[str, str]]:
    import csv

    mapping: dict[str, tuple[str, str]] = {}
    with open(REGISTRY_CSV, encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            mapping[row["id_ibge"]] = (row["municipio"], row["uf"])
    return mapping


def year_files() -> list[Path]:
    return sorted(VDE_DIR.glob("BancoVDE *.xlsx"))


def diagnose(year: int) -> None:
    path = VDE_DIR / f"BancoVDE {year}.xlsx"
    registry = load_registry()
    events: Counter[str] = Counter()
    value_by_col: dict[str, list[int]] = defaultdict(lambda: [0, 0])  # evento -> [total_vitima, total]
    rows = 0
    header = None
    matched = set()
    unmatched: Counter[str] = Counter()
    for values in stream_rows(path):
        if header is None:
            header = values
            continue
        rows += 1
        evento = values[COL["evento"]] if len(values) > COL["evento"] else ""
        events[evento] += 1
        tv = parse_optional_int(values[COL["total_vitima"]]) if len(values) > COL["total_vitima"] else None
        tt = parse_optional_int(values[COL["total"]]) if len(values) > COL["total"] else None
        value_by_col[evento][0] += tv or 0
        value_by_col[evento][1] += tt or 0
        uf = values[COL["uf"]] if len(values) > COL["uf"] else ""
        mun = values[COL["municipio"]] if len(values) > COL["municipio"] else ""
        key = name_key(uf, mun)
        if key in registry:
            matched.add(key)
        else:
            unmatched[f"{uf}/{mun}"] += 1

    print(f"== Diagnostico {year} ==")
    print(f"linhas: {rows}")
    print(f"\neventos distintos ({len(events)}):")
    for ev, n in events.most_common():
        code = canonical_indicator_code(ev)
        app = APP_INDICATOR_KEYS.get(code, "—")
        tv, tt = value_by_col[ev]
        print(f"  {n:>8}  tv={tv:>8} tot={tt:>8}  [{app:>24}]  {ev}")
    print(f"\nmunicipios distintos com match: {len(matched)}")
    print(f"chaves sem match (top 10): {unmatched.most_common(10)}")


def load_population() -> dict[str, int]:
    import csv

    pop: dict[str, int] = {}
    with open(POPULATION_CSV, encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            value = parse_optional_int(row.get("populacao", ""))
            if row.get("id_ibge") and value:
                pop[row["id_ibge"]] = value
    return pop


def build_combined_csv(year: int, granularity: str) -> Path:
    """Agrega um ano do VDE para o CSV combinado (schema SINESP+populacao).

    granularity: "mensal" (periodo = ano-mes) ou "anual" (periodo = ano-00,
    soma dos 12 meses). So inclui linhas com municipio identificado (id_ibge).
    """
    path = VDE_DIR / f"BancoVDE {year}.xlsx"
    registry = load_registry()
    registry_by_id = load_registry_by_id()
    population = load_population()

    # chave -> [valor, unidade] agregado
    agg: dict[tuple[str, int, str], int] = defaultdict(int)
    header = None
    for values in stream_rows(path):
        if header is None:
            header = values
            continue
        if len(values) <= COL["total"]:
            values = values + [""] * (COL["total"] + 1 - len(values))
        id_ibge = registry.get(name_key(values[COL["uf"]], values[COL["municipio"]]))
        if not id_ibge:
            continue  # municipio nao identificado (ex.: NAO INFORMADO) ou nivel UF
        code = canonical_indicator_code(values[COL["evento"]])
        app_indicator = APP_INDICATOR_KEYS.get(code)
        if not app_indicator:
            continue  # evento sem indicador na app (ex.: bombeiros, mandados)
        year_month = parse_optional_month_year(values[COL["data_referencia"]])
        if not year_month:
            continue
        _y, month = year_month
        tv = parse_optional_int(values[COL["total_vitima"]]) or 0
        tt = parse_optional_int(values[COL["total"]]) or 0
        # A coluna correta depende da unidade do indicador (deterministico):
        # crimes de vitima -> total_vitima; ocorrencias -> total. Evita somar a
        # coluna errada quando total_vitima e zero explicito.
        value = tv if INDICATOR_UNIT.get(app_indicator) == "vitimas" else tt
        period_month = month if granularity == "mensal" else 0
        agg[(id_ibge, period_month, app_indicator)] += value

    rows = []
    for (id_ibge, month, app_indicator), value in agg.items():
        pop = population.get(id_ibge, 0)
        municipio, uf = registry_by_id.get(id_ibge, ("", ""))
        code = APP_KEY_TO_CODE.get(app_indicator, app_indicator)
        unit = INDICATOR_UNIT.get(app_indicator, "ocorrencias")
        # Populacao IBGE 2025 alinhada ao ano do VDE 2025 -> taxa valida.
        taxa = round((value / pop) * 100000, 4) if pop and year == 2025 else ""
        taxa_status = "disponivel" if taxa != "" else "populacao_indisponivel"
        rows.append(
            {
                "source_id": "sinesp_vde",
                "id_ibge": id_ibge,
                "uf": uf,
                "municipio": municipio,
                "ano": year,
                # mes=0 e a sentinela anual (periodo "ANO-00"), distinta de
                # Dezembro (12); finalize() reescreve o periodo anual para "ANO".
                "mes": month,
                "indicador_codigo": code,
                "indicador_nome": app_indicator,
                "valor": value,
                "unidade_medida": unit,
                "vitimas": value if unit == "vitimas" else "",
                "populacao": pop,
                "taxa_100k": taxa,
                "taxa_status": taxa_status,
                "fonte": "MJSP/SINESP - Base VDE",
                "fonte_populacao": "IBGE Estimativas 2025",
                "limitacoes": "Base VDE SINESP/MJSP agregada por municipio.",
            }
        )

    out = PROCESSED_DIR / f"vde_combined_{year}_{granularity}.csv"
    write_csv(out, rows, SINESP_WITH_POPULATION_FIELDNAMES)
    print(f"{len(rows)} linhas agregadas -> {out}")
    return out


def finalize(year: int, granularity: str) -> Path:
    """Pipeline completo e reproduzivel: agrega -> app-ready -> funde por
    municipio -> reescreve o periodo anual -> gzip para public/.
    """
    csv_path = build_combined_csv(year, granularity)
    result = generate_app_ready_dataset(
        input_path=csv_path,
        output_path=PROCESSED_DIR / "app-ready" / f"vde-{year}.json",
    )
    payload = result["payload"]

    # Funde um item por municipio (todos os indicadores), removendo a duplicacao
    # de metadados do municipio por indicador.
    merged: dict[str, dict] = {}
    for item in payload["items"]:
        key = item["idIbge"]
        if key not in merged:
            merged[key] = {k: v for k, v in item.items() if k != "indicadores"}
            merged[key]["indicadores"] = {}
        merged[key]["indicadores"].update(item["indicadores"])
    items = list(merged.values())

    period_key = str(year)  # anual: "2025"
    if granularity == "anual":
        for item in items:
            item["periodo"] = period_key
        payload["periods"] = [{"key": period_key, "label": period_key, "updatedAt": utc_now()[:10]}]
        payload["status"]["latestPeriod"] = period_key
    payload["items"] = items
    payload["status"]["source"] = f"MJSP/SINESP - Base VDE {year}"
    payload["status"]["status"] = f"Carga nacional oficial (Base VDE {year})"
    payload["status"]["limitations"] = [
        f"Base VDE do SINESP/MJSP, ano {year}, agregada por municipio (total anual).",
        "Cobre os indicadores municipais de vitima do VDE; crimes patrimoniais do "
        "VDE so existem a nivel UF e nao entram no mapa municipal.",
        "Taxa por 100 mil calculada com populacao IBGE 2025.",
    ]

    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    OFFICIAL_DATASET_GZ.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OFFICIAL_DATASET_GZ, "wb", compresslevel=9) as handle:
        handle.write(raw)
    size_kb = round(OFFICIAL_DATASET_GZ.stat().st_size / 1024, 1)
    print(f"{len(items)} municipios -> {OFFICIAL_DATASET_GZ} ({size_kb} KB gz; {round(len(raw)/1e6,2)} MB cru)")
    return OFFICIAL_DATASET_GZ


def _merged_year_items(year: int, granularity: str) -> tuple[list[dict], dict]:
    """Agrega um ano e funde um item por municipio (todos os indicadores),
    rotulando o periodo anual como "ANO". Reutilizado pela carga multi-ano."""
    csv_path = build_combined_csv(year, granularity)
    result = generate_app_ready_dataset(
        input_path=csv_path,
        output_path=PROCESSED_DIR / "app-ready" / f"vde-{year}.json",
    )
    payload = result["payload"]
    merged: dict[str, dict] = {}
    for item in payload["items"]:
        key = item["idIbge"]
        if key not in merged:
            merged[key] = {k: v for k, v in item.items() if k != "indicadores"}
            merged[key]["indicadores"] = {}
        merged[key]["indicadores"].update(item["indicadores"])
    items = list(merged.values())
    if granularity == "anual":
        for item in items:
            item["periodo"] = str(year)
    return items, payload


def discover_years() -> list[int]:
    """Anos com ficheiro `BancoVDE <ano>.xlsx` presente em data/raw/vde/."""
    years = []
    for path in VDE_DIR.glob("BancoVDE *.xlsx"):
        match = re.search(r"(\d{4})", path.stem)
        if match:
            years.append(int(match.group(1)))
    return sorted(years)


def finalize_multi(years: list[int], granularity: str, partial_years: set[int]) -> Path:
    """Carga multi-ano: concatena os itens de varios anos num so dataset com
    multiplos periodos (um item por municipio+ano). O periodo por omissao
    (periods[0]) e o ano completo mais recente, que tem taxa por 100 mil."""
    all_items: list[dict] = []
    base_payload: dict | None = None
    for year in years:
        items, payload = _merged_year_items(year, granularity)
        all_items.extend(items)
        if base_payload is None:
            base_payload = payload
        print(f"  {year}: {len(items)} municipios")

    if base_payload is None:
        raise SystemExit("Nenhum ano agregado; verifique data/raw/vde/.")

    # Ordena os periodos: anos completos do mais recente para o mais antigo,
    # e os anos parciais (ex.: ano corrente incompleto) no fim. Assim o periodo
    # que abre por omissao e o ano completo mais recente (com taxa valida).
    full = sorted((y for y in years if y not in partial_years), reverse=True)
    partial = sorted((y for y in years if y in partial_years), reverse=True)
    ordered = full + partial

    def _label(y: int) -> str:
        return f"{y} (parcial)" if y in partial_years else str(y)

    today = utc_now()[:10]
    payload = base_payload
    payload["items"] = all_items
    payload["periods"] = [
        {"key": str(y), "label": _label(y), "updatedAt": today} for y in ordered
    ]
    span = f"{min(years)}-{max(years)}"
    payload["status"]["latestPeriod"] = str(ordered[0])
    payload["status"]["source"] = f"MJSP/SINESP - Base VDE {span}"
    payload["status"]["status"] = f"Carga nacional oficial (Base VDE {span})"
    payload["status"]["limitations"] = [
        f"Base VDE do SINESP/MJSP, anos {span}, agregada por municipio (total anual).",
        "Cobre os indicadores municipais de vitima do VDE; crimes patrimoniais do "
        "VDE so existem a nivel UF e nao entram no mapa municipal.",
        "Taxa por 100 mil so esta disponivel para 2025 (populacao IBGE 2025); nos "
        "demais anos mostra-se o total absoluto.",
    ]

    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    OFFICIAL_DATASET_GZ.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OFFICIAL_DATASET_GZ, "wb", compresslevel=9) as handle:
        handle.write(raw)
    size_mb = round(OFFICIAL_DATASET_GZ.stat().st_size / 1e6, 2)
    print(
        f"{len(years)} anos, {len(all_items)} itens -> {OFFICIAL_DATASET_GZ} "
        f"({size_mb} MB gz; {round(len(raw)/1e6,2)} MB cru)"
    )
    return OFFICIAL_DATASET_GZ


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    d = sub.add_parser("diagnose")
    d.add_argument("--year", type=int, default=2025)
    b = sub.add_parser("build")
    b.add_argument("--year", type=int, default=2025)
    b.add_argument("--granularity", choices=["mensal", "anual"], default="anual")
    f = sub.add_parser("finalize", help="Pipeline completo -> public/officialCrimeData.json.gz")
    f.add_argument("--year", type=int, default=2025)
    f.add_argument("--granularity", choices=["mensal", "anual"], default="anual")
    m = sub.add_parser("finalize-multi", help="Carga multi-ano -> public/officialCrimeData.json.gz")
    m.add_argument("--years", help="Lista 'ini-fim' (ex.: 2015-2026); por omissao, todos os encontrados")
    m.add_argument("--granularity", choices=["mensal", "anual"], default="anual")
    m.add_argument("--partial", default="2026", help="Anos parciais (CSV), rotulados e colocados no fim")
    args = parser.parse_args()
    if args.command == "diagnose":
        diagnose(args.year)
    elif args.command == "build":
        build_combined_csv(args.year, args.granularity)
    elif args.command == "finalize":
        finalize(args.year, args.granularity)
    elif args.command == "finalize-multi":
        if args.years:
            ini, fim = (int(x) for x in args.years.split("-"))
            years = list(range(ini, fim + 1))
        else:
            years = discover_years()
        partial = {int(x) for x in args.partial.split(",") if x.strip()}
        years = [y for y in years if (VDE_DIR / f"BancoVDE {y}.xlsx").exists()]
        finalize_multi(years, args.granularity, partial)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
