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
UF_POPULATION_CSV = PROJECT_ROOT / "etl" / "reference" / "uf_population.csv"

UF_SIGLAS = {
    "RO", "AC", "AM", "RR", "PA", "AP", "TO", "MA", "PI", "CE", "RN", "PB",
    "PE", "AL", "SE", "BA", "MG", "ES", "RJ", "SP", "PR", "SC", "RS", "MS",
    "MT", "GO", "DF",
}
UF_NOME = {
    "RO": "Rondonia", "AC": "Acre", "AM": "Amazonas", "RR": "Roraima",
    "PA": "Para", "AP": "Amapa", "TO": "Tocantins", "MA": "Maranhao",
    "PI": "Piaui", "CE": "Ceara", "RN": "Rio Grande do Norte", "PB": "Paraiba",
    "PE": "Pernambuco", "AL": "Alagoas", "SE": "Sergipe", "BA": "Bahia",
    "MG": "Minas Gerais", "ES": "Espirito Santo", "RJ": "Rio de Janeiro",
    "SP": "Sao Paulo", "PR": "Parana", "SC": "Santa Catarina",
    "RS": "Rio Grande do Sul", "MS": "Mato Grosso do Sul", "MT": "Mato Grosso",
    "GO": "Goias", "DF": "Distrito Federal",
}

# Unidade canonica por indicador da app (os municipais do VDE sao de vitima).
INDICATOR_UNIT = {
    "homicidioDoloso": "vitimas",
    "tentativaHomicidio": "vitimas",
    "latrocinio": "vitimas",
    "lesaoCorporalMorte": "vitimas",
    "morteIntervencaoEstado": "vitimas",
    "feminicidio": "vitimas",
    # estupro/estupro de vulneravel sao contados por vitima no VDE (coluna
    # total_vitima); marca-los como "ocorrencias" leria a coluna errada (0).
    "estupro": "vitimas",
    "estuproVulneravel": "vitimas",
    "rouboVeiculos": "ocorrencias",
    "furtoVeiculos": "ocorrencias",
    "rouboCarga": "ocorrencias",
    "rouboInstituicaoFinanceira": "ocorrencias",
    "traficoDrogas": "ocorrencias",
}

# Indicadores que o VDE so fornece a nivel de UF (municipio "NAO INFORMADO"):
# patrimoniais, sexuais e morte por intervencao do Estado. Sao agregados por
# estado e servidos em `ufData` (degrade nacional dos estados; sem detalhe
# municipal). Os restantes 5 sao municipais (por vitima).
UF_LEVEL_INDICATORS = {
    "morteIntervencaoEstado",
    "estupro",
    "estuproVulneravel",
    "rouboVeiculos",
    "furtoVeiculos",
    "rouboCarga",
    "rouboInstituicaoFinanceira",
    "traficoDrogas",
}

# Rotulos para o catalogo de indicadores (codigo, label, unidade).
UF_INDICATOR_LABELS = {
    "morteIntervencaoEstado": ("morte_intervencao_estado", "Morte por intervencao do Estado", "vitimas"),
    "estupro": ("estupro", "Estupro", "vitimas"),
    "estuproVulneravel": ("estupro_vulneravel", "Estupro de vulneravel", "vitimas"),
    "rouboVeiculos": ("roubo_veiculos", "Roubo de veiculos", "ocorrencias"),
    "furtoVeiculos": ("furto_veiculos", "Furto de veiculos", "ocorrencias"),
    "rouboCarga": ("roubo_carga", "Roubo de carga", "ocorrencias"),
    "rouboInstituicaoFinanceira": ("roubo_instituicao_financeira", "Roubo a instituicao financeira", "ocorrencias"),
    "traficoDrogas": ("trafico_drogas", "Trafico de drogas", "ocorrencias"),
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


def load_uf_population() -> dict[tuple[str, int], int]:
    """(uf, ano) -> populacao, a partir de etl/reference/uf_population.csv."""
    import csv

    pop: dict[tuple[str, int], int] = {}
    if not UF_POPULATION_CSV.exists():
        return pop
    with open(UF_POPULATION_CSV, encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            value = parse_optional_int(row.get("populacao", ""))
            ano = parse_optional_int(row.get("ano", ""))
            uf = (row.get("uf") or "").strip().upper()
            if uf and ano and value:
                pop[(uf, ano)] = value
    return pop


def _uf_score_and_level(value_by_uf: dict[str, float]) -> dict[str, tuple[int, str]]:
    """Pontua as UFs por quantil de rank (0-100) dentro de um indicador/periodo,
    devolvendo (score, nivel). Coerente com o degrade do mapa (ranking relativo)."""
    levels = [(20, "baixo"), (40, "moderado"), (60, "atencao"), (80, "alto"), (101, "critico")]
    ordered = sorted(value_by_uf.items(), key=lambda kv: kv[1])
    n = len(ordered)
    out: dict[str, tuple[int, str]] = {}
    for index, (uf, _value) in enumerate(ordered):
        score = round(((index + 0.5) / n) * 100) if n else 0
        nivel = next(name for threshold, name in levels if score < threshold)
        out[uf] = (score, nivel)
    return out


def build_uf_data(uf_agg_by_year: dict[int, dict[tuple[str, int, str], int]]) -> list[dict]:
    """Constroi `ufData`: um registo por (uf, ano, indicador) com total, taxa por
    100 mil (populacao UF do ano), score (quantil) e nivel. Alimenta o degrade
    nacional dos estados nos indicadores que so existem a nivel UF."""
    uf_pop = load_uf_population()
    records: list[dict] = []
    for year, uf_agg in uf_agg_by_year.items():
        # totais anuais por (uf, indicador): soma os meses (mes=0 ja e anual).
        totals: dict[str, dict[str, int]] = defaultdict(dict)
        for (uf, _month, indicador), value in uf_agg.items():
            totals[indicador][uf] = totals[indicador].get(uf, 0) + value
        for indicador, by_uf in totals.items():
            unidade = INDICATOR_UNIT.get(indicador, "ocorrencias")
            # taxa por 100 mil por UF (populacao do ano); score por quantil do total.
            scores = _uf_score_and_level({uf: float(v) for uf, v in by_uf.items()})
            for uf, value in by_uf.items():
                pop = uf_pop.get((uf, year))
                taxa = round((value / pop) * 100000, 4) if pop else None
                score, nivel = scores[uf]
                records.append(
                    {
                        "uf": uf,
                        "periodo": str(year),
                        "indicador": indicador,
                        "total": value,
                        "taxa100k": taxa,
                        "score": score,
                        "nivel": nivel,
                        "unidade": unidade,
                        "dataStatus": "oficial",
                    }
                )
    return records


def build_uf_data_from_items(items: list[dict]) -> list[dict]:
    """Agrega os indicadores MUNICIPAIS (incl. indiceGeral) por (uf, periodo,
    indicador), para que a comparacao entre estados funcione em qualquer
    indicador — nao so nos que o VDE fornece a nivel UF. Taxa por 100 mil com a
    populacao UF do ano; score por quantil de rank entre as UFs do periodo.

    Limitacao: pensado para a serie ANUAL (periodo "YYYY"). Com granularidade
    mensal os items trazem "YYYY-MM", enquanto build_uf_data emite "YYYY" — os
    formatos divergiriam no ufData concatenado. A serie mensal tera dataset
    proprio (issue #72) em vez de passar por aqui."""
    uf_pop = load_uf_population()
    totals: dict[tuple[str, str], dict[str, int]] = defaultdict(lambda: defaultdict(int))
    units: dict[str, str] = {}
    for item in items:
        for indicador, metric in item["indicadores"].items():
            totals[(str(item["periodo"]), indicador)][str(item["uf"])] += int(metric.get("total") or 0)
            units.setdefault(indicador, str(metric.get("unidade") or "ocorrencias"))

    records: list[dict] = []
    for (periodo, indicador), by_uf in sorted(totals.items()):
        scores = _uf_score_and_level({uf: float(value) for uf, value in by_uf.items()})
        year = int(periodo[:4])
        for uf, value in by_uf.items():
            pop = uf_pop.get((uf, year))
            score, nivel = scores[uf]
            records.append(
                {
                    "uf": uf,
                    "periodo": periodo,
                    "indicador": indicador,
                    "total": value,
                    "taxa100k": round((value / pop) * 100000, 4) if pop else None,
                    "score": score,
                    "nivel": nivel,
                    "unidade": units.get(indicador, "ocorrencias"),
                    "dataStatus": "oficial",
                }
            )
    return records


def build_combined_csv(year: int, granularity: str) -> tuple[Path, dict[tuple[str, int, str], int]]:
    """Agrega um ano do VDE para o CSV combinado (schema SINESP+populacao).

    granularity: "mensal" (periodo = ano-mes) ou "anual" (periodo = ano-00,
    soma dos 12 meses). Os indicadores municipais (por vitima) vao para o CSV;
    os indicadores so-UF (patrimoniais/sexuais) sao agregados por estado e
    devolvidos como `uf_agg` para alimentar `ufData`.
    """
    path = VDE_DIR / f"BancoVDE {year}.xlsx"
    registry = load_registry()
    registry_by_id = load_registry_by_id()
    population = load_population()

    # (id_ibge, mes, indicador) -> valor (municipal); (uf, mes, indicador) -> valor (UF)
    agg: dict[tuple[str, int, str], int] = defaultdict(int)
    uf_agg: dict[tuple[str, int, str], int] = defaultdict(int)
    header = None
    for values in stream_rows(path):
        if header is None:
            header = values
            continue
        if len(values) <= COL["total"]:
            values = values + [""] * (COL["total"] + 1 - len(values))
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

        if app_indicator in UF_LEVEL_INDICATORS:
            uf = strip_accents_upper(values[COL["uf"]]).strip()
            if uf in UF_SIGLAS:
                uf_agg[(uf, period_month, app_indicator)] += value
            continue

        id_ibge = registry.get(name_key(values[COL["uf"]], values[COL["municipio"]]))
        if not id_ibge:
            continue  # municipio nao identificado (ex.: NAO INFORMADO)
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
    print(f"{len(rows)} linhas municipais + {len(uf_agg)} agregados UF -> {out}")
    return out, uf_agg


def finalize(year: int, granularity: str) -> Path:
    """Pipeline completo e reproduzivel: agrega -> app-ready -> funde por
    municipio -> reescreve o periodo anual -> gzip para public/.
    """
    csv_path, uf_agg = build_combined_csv(year, granularity)
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
    add_general_index(items)

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
        f"Base VDE do SINESP/MJSP, ano {year}, agregada por municipio (vitima) e por estado.",
        "Indicadores so-UF (patrimoniais/sexuais, morte por intervencao do Estado) "
        "coloreiam o mapa nacional dos estados; sem detalhe municipal.",
        "Taxa por 100 mil: municipal com populacao IBGE 2025; estadual com estimativa IBGE/UF.",
    ]

    payload["ufData"] = build_uf_data({year: uf_agg}) + build_uf_data_from_items(items)
    existing_keys = {ind["key"] for ind in payload.get("indicators", [])}
    # Indice geral em 1.o (indicators[0] e o indicador padrao da app).
    payload["indicators"] = (
        ([GENERAL_INDEX_ENTRY] if "indiceGeral" not in existing_keys else [])
        + payload.get("indicators", [])
        + [ind for ind in _uf_indicator_catalog() if ind["key"] not in existing_keys]
    )

    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    OFFICIAL_DATASET_GZ.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OFFICIAL_DATASET_GZ, "wb", compresslevel=9) as handle:
        handle.write(raw)
    size_kb = round(OFFICIAL_DATASET_GZ.stat().st_size / 1024, 1)
    print(f"{len(items)} municipios -> {OFFICIAL_DATASET_GZ} ({size_kb} KB gz; {round(len(raw)/1e6,2)} MB cru)")
    return OFFICIAL_DATASET_GZ


def _merged_year_items(year: int, granularity: str) -> tuple[list[dict], dict, dict]:
    """Agrega um ano e funde um item por municipio (todos os indicadores),
    rotulando o periodo anual como "ANO". Reutilizado pela carga multi-ano.
    Devolve tambem o agregado UF do ano (para `ufData`)."""
    csv_path, uf_agg = build_combined_csv(year, granularity)
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
    # Indice geral (todos os crimes municipais somados), pontuado dentro do ano.
    add_general_index(items)
    return items, payload, uf_agg


def _uf_indicator_catalog() -> list[dict]:
    """Entradas de catalogo para os indicadores so-UF (degrade nacional)."""
    return [
        {
            "key": key,
            "codigo": codigo,
            "label": label,
            "unidade": unidade,
            "oficial": True,
            "nivelDado": "uf",
        }
        for key, (codigo, label, unidade) in UF_INDICATOR_LABELS.items()
    ]


GENERAL_INDEX_ENTRY = {
    "key": "indiceGeral",
    "codigo": "indice_geral",
    "label": "Indice geral (todos os crimes)",
    "unidade": "vitimas",
    "oficial": True,
}

_LEVELS = [(20, "baixo"), (40, "moderado"), (60, "atencao"), (80, "alto"), (101, "critico")]


def add_general_index(items: list[dict]) -> None:
    """Acrescenta o indicador `indiceGeral` a cada municipio de UM ano: a soma
    das vitimas de todos os crimes municipais do VDE, com taxa por 100 mil
    (quando ha populacao alinhada) e score por quantil de rank dentro do ano.
    E o indicador padrao da app (vai em 1.o no catalogo)."""
    totals: list[tuple[dict, int]] = []
    for item in items:
        # Exclui o proprio indiceGeral da soma: torna a funcao re-entrante (uma
        # segunda chamada recalcula em vez de inflar o total com o agregado previo).
        total = sum(
            int(metric.get("total") or 0)
            for key, metric in item["indicadores"].items()
            if key != "indiceGeral"
        )
        totals.append((item, total))

    ordered = sorted(totals, key=lambda pair: pair[1])
    n = len(ordered)
    for index, (item, total) in enumerate(ordered):
        score = round(((index + 0.5) / n) * 100) if n else 0
        nivel = next(name for threshold, name in _LEVELS if score < threshold)
        pop = item.get("populacao") or 0
        # So calcula a taxa quando os sub-indicadores tambem a tem (populacao do
        # mesmo ano); evita misturar vintages.
        has_taxa = any(
            isinstance(metric.get("taxa100k"), (int, float))
            for metric in item["indicadores"].values()
        )
        item["indicadores"]["indiceGeral"] = {
            "score": score,
            "nivel": nivel,
            "total": total,
            "taxa100k": round((total / pop) * 100000, 4) if pop and has_taxa else None,
            "variacaoMensal": None,
            "variacaoAnual": None,
            "dataStatus": "oficial",
            "unidade": "vitimas",
            "fonte": "MJSP/SINESP - Base VDE (agregado)",
        }


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
    (periods[0]) e sempre o ANO ATUAL, mesmo que parcial — o rotulo '(parcial)'
    sinaliza a cobertura incompleta."""
    all_items: list[dict] = []
    uf_agg_by_year: dict[int, dict] = {}
    base_payload: dict | None = None
    for year in years:
        items, payload, uf_agg = _merged_year_items(year, granularity)
        all_items.extend(items)
        uf_agg_by_year[year] = uf_agg
        if base_payload is None:
            base_payload = payload
        print(f"  {year}: {len(items)} municipios")

    if base_payload is None:
        raise SystemExit("Nenhum ano agregado; verifique data/raw/vde/.")

    # Ordena os periodos do mais recente para o mais antigo: o periodo que abre
    # por omissao (periods[0]) e sempre o ANO ATUAL, mesmo que parcial — o rotulo
    # "(parcial)" sinaliza a cobertura incompleta.
    ordered = sorted(years, reverse=True)

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
        f"Base VDE do SINESP/MJSP, anos {span}, agregada por municipio (vitima) e "
        "por estado (patrimoniais/sexuais).",
        "Indicadores municipais (homicidio, feminicidio, etc.) tem detalhe por "
        "cidade; os so-UF (roubo/furto de veiculos, carga, trafico, estupro, morte "
        "por intervencao do Estado) so existem por estado e coloreiam o mapa nacional.",
        "Taxa por 100 mil: municipal com populacao IBGE 2025; estadual com "
        "estimativa IBGE por ano (UF).",
    ]

    # ufData: indicadores so-UF (degrade nacional dos estados). Catalogo de
    # indicadores estendido com esses indicadores (marcados nivelDado=uf).
    payload["ufData"] = build_uf_data(uf_agg_by_year) + build_uf_data_from_items(all_items)
    existing_keys = {ind["key"] for ind in payload.get("indicators", [])}
    # Indice geral em 1.o (indicators[0] e o indicador padrao da app).
    payload["indicators"] = (
        ([GENERAL_INDEX_ENTRY] if "indiceGeral" not in existing_keys else [])
        + payload.get("indicators", [])
        + [ind for ind in _uf_indicator_catalog() if ind["key"] not in existing_keys]
    )

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
