"""Offline pipeline for official national tabular sources.

The pipeline deliberately writes raw and processed artifacts outside Git-tracked
paths. Small samples and metadata summaries can be copied into `etl/samples/`
for review.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
import subprocess
import time
import zipfile
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Iterable, Iterator, Mapping
from xml.etree import ElementTree as ET

from etl.sources.base import USER_AGENT, fetch_url_bytes_with_curl, normalize_header


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
SAMPLES_DIR = PROJECT_ROOT / "etl" / "samples"
APP_READY_DIR = PROCESSED_DIR / "app-ready"
# Centroides municipais nacionais versionados (id_ibge -> lat, lng), derivados
# da malha municipal do IBGE. Servem de base padrao para a geracao app-ready.
MUNICIPAL_CENTROIDS_REFERENCE = PROJECT_ROOT / "etl" / "reference" / "municipal_centroids.csv"

MJSP_PACKAGE_API_URL = (
    "https://dados.mj.gov.br/api/3/action/package_show"
    "?id=sistema-nacional-de-estatisticas-de-seguranca-publica"
)
IBGE_POPULATION_DIR_URL = "https://ftp.ibge.gov.br/Estimativas_de_Populacao/Estimativas_2025/"
IBGE_MUNICIPALITIES_API_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
DOWNLOADABLE_SOURCE_IDS = [
    "ibge_population",
    "sinesp_dictionary_municipios",
    "sinesp_dictionary_uf",
    "sinesp_municipios",
    "sinesp_uf",
    "sinesp_vde",
]
SINESP_SOURCE_IDS = {"sinesp_municipios", "sinesp_uf", "sinesp_vde"}
SINESP_NORMALIZED_FIELDNAMES = [
    "source_id",
    "source_file",
    "nivel_geografico",
    "id_ibge",
    "uf",
    "municipio",
    "ano",
    "mes",
    "indicador_codigo",
    "indicador_nome",
    "valor",
    "unidade_medida",
    "ocorrencias",
    "vitimas",
    "fonte",
    "data_coleta",
    "limitacoes",
]
SINESP_WITH_POPULATION_FIELDNAMES = [
    "source_id",
    "id_ibge",
    "uf",
    "municipio",
    "ano",
    "mes",
    "indicador_codigo",
    "indicador_nome",
    "valor",
    "unidade_medida",
    "vitimas",
    "populacao",
    "taxa_100k",
    "taxa_status",
    "fonte",
    "fonte_populacao",
    "limitacoes",
]

SINESP_COLUMN_ALIASES = {
    "uf": ["uf", "sigla_uf", "sg_uf", "estado", "unidade_federativa"],
    "id_ibge": [
        "id_ibge",
        "codigo_ibge",
        "cod_ibge",
        "codigo_municipio",
        "cod_municipio",
        "cod_munic",
        "municipio_codigo",
    ],
    "municipio": ["municipio", "nome_municipio", "nome_do_municipio", "cidade"],
    "ano": ["ano", "ano_referencia", "ano_do_fato"],
    "mes": ["mes", "mes_referencia", "mes_do_fato"],
    "mes_ano": ["mes_ano", "competencia", "periodo"],
    "indicador": [
        "indicador",
        "indicador_criminal",
        "natureza",
        "natureza_criminal",
        "tipo_crime",
        "crime",
        "descricao_indicador",
    ],
    "ocorrencias": [
        "ocorrencias",
        "ocorrencia",
        "qtd_ocorrencias",
        "quantidade_ocorrencias",
        "quantidade",
        "total",
        "valor",
        "registros",
    ],
    "vitimas": ["vitimas", "qtd_vitimas", "quantidade_vitimas", "numero_vitimas"],
}

SINESP_INDICATOR_ALIASES = {
    "homicidio_doloso": ["homicidio_doloso", "homicidios_dolosos"],
    "feminicidio": ["feminicidio", "feminicidios"],
    "latrocinio": ["latrocinio", "roubo_seguido_de_morte"],
    "lesao_corporal_seguida_de_morte": ["lesao_corporal_seguida_de_morte"],
    "roubo_veiculos": ["roubo_de_veiculo", "roubo_de_veiculos", "roubo_veiculo"],
    "furto_veiculos": ["furto_de_veiculo", "furto_de_veiculos", "furto_veiculo"],
    "roubo_carga": ["roubo_de_carga", "roubo_carga"],
    "estupro": ["estupro", "estupros"],
    "trafico_drogas": ["trafico_de_drogas", "trafico_drogas"],
}
SINESP_MUNICIPAL_DEFAULT_INDICATOR = "Homicídio doloso"
APP_INDICATOR_KEYS = {
    "homicidio_doloso": "homicidioDoloso",
    "feminicidio": "feminicidio",
    "roubo_veiculos": "rouboVeiculos",
    "roubo_carga": "rouboCarga",
    "estupro": "estupro",
    "trafico_drogas": "traficoDrogas",
    "furto_veiculos": "furtoVeiculos",
}
APP_READY_SAMPLE_CENTROIDS = {
    "1200138": (-9.821, -67.949),
    "1200179": (-10.566, -67.686),
    "1200203": (-7.627, -72.675),
    "1200302": (-8.166, -70.354),
    "1200385": (-10.335, -67.185),
    "1200401": (-9.975, -67.824),
    "1200450": (-10.149, -67.736),
    "1200500": (-9.066, -68.657),
    "1200609": (-8.161, -70.765),
    "1200708": (-10.651, -68.496),
    "1200807": (-9.581, -67.547),
}

MONTH_NAMES = {
    "janeiro": 1,
    "fevereiro": 2,
    "marco": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}

ODS_NS = {
    "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
}
TABLE_ROW = f"{{{ODS_NS['table']}}}table-row"
TABLE_CELL = f"{{{ODS_NS['table']}}}table-cell"
ROWS_REPEATED = f"{{{ODS_NS['table']}}}number-rows-repeated"
COLUMNS_REPEATED = f"{{{ODS_NS['table']}}}number-columns-repeated"


@dataclass(frozen=True)
class OfficialResource:
    source_id: str
    title: str
    url: str
    format: str
    source_name: str
    license: str | None = None
    last_modified: str | None = None
    notes: str | None = None


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare official data in offline/local mode")
    subparsers = parser.add_subparsers(dest="command", required=True)

    discover_parser = subparsers.add_parser("discover", help="Discover source metadata")
    discover_parser.add_argument("--write-samples", action="store_true")

    download_parser = subparsers.add_parser("download", help="Download selected raw resources")
    download_parser.add_argument(
        "--source",
        action="append",
        choices=DOWNLOADABLE_SOURCE_IDS,
        default=[],
        help="Source to download. May be repeated. Defaults to ibge_population.",
    )
    download_parser.add_argument("--timeout", type=int, default=120, help="Download timeout in seconds")
    download_parser.add_argument("--retries", type=int, default=3, help="Total download attempts")
    download_parser.add_argument("--backoff-seconds", type=int, default=5, help="Delay between retries")

    manual_parser = subparsers.add_parser(
        "register-manual",
        help="Register a raw source downloaded manually outside this environment",
    )
    manual_parser.add_argument("--source", required=True, choices=DOWNLOADABLE_SOURCE_IDS)
    manual_parser.add_argument("--file", required=True, type=Path, help="Local file to copy into data/raw")
    manual_parser.add_argument("--note", default=None, help="Optional audit note")

    inspect_parser = subparsers.add_parser("inspect", help="Inspect local raw resources")
    inspect_parser.add_argument("--write-samples", action="store_true")

    normalize_parser = subparsers.add_parser("normalize", help="Normalize local official data")
    normalize_parser.add_argument("--write-samples", action="store_true")

    app_ready_parser = subparsers.add_parser("generate-app-ready", help="Generate compact JSON for the app")
    app_ready_parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="Combined SINESP+population CSV. Defaults to processed CSV, then sample CSV.",
    )
    app_ready_parser.add_argument(
        "--centroids",
        type=Path,
        default=None,
        help="Optional CSV with id_ibge,lat,lng. Built-in sample centroids cover only the versioned sample.",
    )
    app_ready_parser.add_argument("--output", type=Path, default=None)
    app_ready_parser.add_argument("--write-samples", action="store_true")

    fetch_vde_parser = subparsers.add_parser("fetch-sinesp-vde", help="Alias for VDE download with resume")
    fetch_vde_parser.add_argument("--timeout", type=int, default=900)
    fetch_vde_parser.add_argument("--retries", type=int, default=5)
    fetch_vde_parser.add_argument("--backoff-seconds", type=int, default=5)
    fetch_vde_parser.add_argument("--write-samples", action="store_true")

    inspect_vde_parser = subparsers.add_parser("inspect-vde", help="Inspect local SINESP VDE download status/schema")
    inspect_vde_parser.add_argument("--write-samples", action="store_true")

    normalize_vde_parser = subparsers.add_parser("normalize-vde", help="Normalize VDE only when its schema is recognized")
    normalize_vde_parser.add_argument("--write-samples", action="store_true")

    args = parser.parse_args()
    ensure_dirs()

    if args.command == "discover":
        try:
            catalog = discover_catalog()
        except Exception as error:  # noqa: BLE001 - keep offline/local workflow usable during portal timeouts.
            catalog = load_cached_catalog()
            catalog = dict(catalog)
            metadata = dict(catalog.get("metadata", {}))
            metadata["discovery_warning"] = str(error)
            metadata["used_cached_catalog"] = True
            catalog["metadata"] = metadata
        write_json(PROCESSED_DIR / "official_source_catalog.json", catalog)
        if args.write_samples:
            write_json(SAMPLES_DIR / "official_source_catalog.sample.json", catalog)
        print(json.dumps(catalog["summary"], ensure_ascii=False, indent=2))
        return 0

    if args.command == "download":
        sources = args.source or ["ibge_population"]
        manifest = download_sources(
            sources,
            timeout=args.timeout,
            retries=args.retries,
            backoff_seconds=args.backoff_seconds,
        )
        write_json(PROCESSED_DIR / "download_manifest.json", manifest)
        print(json.dumps(manifest, ensure_ascii=False, indent=2))
        return 0

    if args.command == "register-manual":
        manifest = register_manual_source(args.source, args.file, note=args.note)
        write_json(PROCESSED_DIR / "manual_source_manifest.json", manifest)
        print(json.dumps(manifest, ensure_ascii=False, indent=2))
        return 0

    if args.command == "inspect":
        inspection = inspect_raw_sources()
        write_json(PROCESSED_DIR / "inspection_summary.json", inspection)
        if args.write_samples:
            write_json(SAMPLES_DIR / "inspection_summary.sample.json", inspection)
        print(json.dumps(inspection["summary"], ensure_ascii=False, indent=2))
        return 0

    if args.command == "normalize":
        result = normalize_official_sources()
        if args.write_samples:
            write_population_sample(result["population_rows"])
            write_json(SAMPLES_DIR / "municipality_key_validation.sample.json", result["validation"])
            write_json(SAMPLES_DIR / "normalization_metadata.sample.json", result["metadata"])
            write_sinesp_samples(result["sinesp"])
            write_combined_samples(result["combined"])
        print(json.dumps(result["validation"]["summary"], ensure_ascii=False, indent=2))
        return 0

    if args.command == "generate-app-ready":
        result = generate_app_ready_dataset(
            input_path=args.input,
            centroids_path=args.centroids,
            output_path=args.output,
            write_samples=args.write_samples,
        )
        print(json.dumps(result["summary"], ensure_ascii=False, indent=2))
        return 0

    if args.command == "fetch-sinesp-vde":
        manifest = download_sources(
            ["sinesp_vde"],
            timeout=args.timeout,
            retries=args.retries,
            backoff_seconds=args.backoff_seconds,
        )
        write_json(PROCESSED_DIR / "download_manifest.json", manifest)
        if args.write_samples:
            write_json(SAMPLES_DIR / "download_manifest.sample.json", manifest)
        print(json.dumps(manifest, ensure_ascii=False, indent=2))
        return 0

    if args.command == "inspect-vde":
        result = inspect_vde_source()
        write_json(PROCESSED_DIR / "sinesp_vde_inspection_status.json", result)
        if args.write_samples:
            write_json(SAMPLES_DIR / "sinesp_vde_inspection_status.sample.json", result)
        print(json.dumps(result["summary"], ensure_ascii=False, indent=2))
        return 0

    if args.command == "normalize-vde":
        result = normalize_vde_source()
        write_json(PROCESSED_DIR / "sinesp_vde_normalization_status.json", result["status"])
        if args.write_samples:
            write_json(SAMPLES_DIR / "sinesp_vde_normalization_status.sample.json", result["status"])
            rows = list(result.get("rows", []))
            if rows:
                write_csv(SAMPLES_DIR / "sinesp_vde_normalized.sample.csv", rows[:25], SINESP_NORMALIZED_FIELDNAMES)
        print(json.dumps(result["status"]["summary"], ensure_ascii=False, indent=2))
        return 0

    parser.error("unknown command")
    return 2


def ensure_dirs() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    APP_READY_DIR.mkdir(parents=True, exist_ok=True)


def discover_catalog() -> dict[str, object]:
    collected_at = utc_now()
    resources: list[OfficialResource] = []

    mjsp = fetch_json(MJSP_PACKAGE_API_URL)
    package = mjsp["result"]
    for resource in package.get("resources", []):
        name = str(resource.get("name") or "")
        source_id = source_id_for_mjsp_resource(name)
        if source_id:
            resources.append(
                OfficialResource(
                    source_id=source_id,
                    title=name,
                    url=str(resource.get("url") or ""),
                    format=str(resource.get("format") or ""),
                    source_name="MJSP/SINESP",
                    license=str(package.get("license_title") or ""),
                    last_modified=string_or_none(resource.get("last_modified")),
                    notes=string_or_none(resource.get("description")),
                )
            )

    population_url = discover_latest_ibge_population_ods()
    resources.append(
        OfficialResource(
            source_id="ibge_population",
            title="Estimativas da população residente 2025",
            url=population_url,
            format="ODS",
            source_name="IBGE",
            license="Dados públicos IBGE",
            last_modified=None,
            notes="Estimativas de população residente com referência em 1 de julho de 2025.",
        )
    )
    resources.append(
        OfficialResource(
            source_id="ibge_municipalities_api",
            title="IBGE API de localidades - municípios",
            url=IBGE_MUNICIPALITIES_API_URL,
            format="JSON",
            source_name="IBGE",
            license="Dados públicos IBGE",
            notes="Usada para validar códigos IBGE municipais de 7 dígitos.",
        )
    )

    return {
        "metadata": {
            "collected_at": collected_at,
            "limitations": [
                "Catalogo registra metadados e URLs oficiais; arquivos brutos ficam fora do Git.",
                "SINESP/MJSP deve ser baixado localmente para confirmar schema tabular antes de uso no MVP.",
                "Dados ainda nao substituem os mocks da interface.",
            ],
        },
        "summary": {
            "resource_count": len(resources),
            "mjsp_dataset_modified": package.get("metadata_modified"),
            "mjsp_license": package.get("license_title"),
            "ibge_population_url": population_url,
        },
        "resources": [asdict(resource) for resource in resources],
    }


def download_sources(
    source_ids: list[str],
    timeout: int = 120,
    retries: int = 3,
    backoff_seconds: int = 5,
) -> dict[str, object]:
    discovery_warning = None
    try:
        catalog = discover_catalog()
    except Exception as error:  # noqa: BLE001 - fallback keeps downloads auditable offline.
        catalog = load_cached_catalog()
        discovery_warning = str(error)
    resources = {item["source_id"]: item for item in catalog["resources"]}
    downloads = []
    for source_id in source_ids:
        if source_id not in resources:
            downloads.append(
                {
                    "source_id": source_id,
                    "status": "failed",
                    "error": "source id not found in official catalog",
                    "started_at": utc_now(),
                    "finished_at": utc_now(),
                }
            )
            continue
        resource = resources[source_id]
        suffix = suffix_for(resource["format"], resource["url"])
        target = RAW_DIR / f"{source_id}{suffix}"
        started_at = utc_now()
        try:
            attempts = download_url_to_path(
                resource["url"],
                target,
                timeout=timeout,
                retries=retries,
                backoff_seconds=backoff_seconds,
            )
            downloads.append(
                {
                    "source_id": source_id,
                    "status": "downloaded",
                    "url": resource["url"],
                    "path": str(target.relative_to(PROJECT_ROOT)),
                    "bytes": target.stat().st_size,
                    "sha256": sha256_file(target),
                    "attempts": attempts,
                    "started_at": started_at,
                    "finished_at": utc_now(),
                }
            )
        except Exception as error:  # noqa: BLE001 - downloader records source-specific failures.
            downloads.append(
                {
                    "source_id": source_id,
                    "status": "failed",
                    "url": resource["url"],
                    "error": str(error),
                    "attempts": max(1, retries),
                    "automated_resume": (
                        "Reexecute o download para retomar o .part local: "
                        f"`python3 -m etl.official_data download --source {source_id} "
                        f"--timeout {timeout} --retries {max(1, retries)}`."
                    ),
                    "started_at": started_at,
                    "finished_at": utc_now(),
                }
            )
    return {
        "metadata": {
            "collected_at": utc_now(),
            "raw_directory": str(RAW_DIR.relative_to(PROJECT_ROOT)),
            "git_policy": "Raw downloads are ignored by Git.",
            "discovery_warning": discovery_warning,
            "download_policy": "curl writes to .part files with resume enabled and records failures for retry/manual fallback.",
        },
        "downloads": downloads,
    }


def register_manual_source(source_id: str, file_path: Path, note: str | None = None) -> dict[str, object]:
    source_file = file_path.expanduser().resolve()
    if not source_file.exists() or not source_file.is_file():
        raise FileNotFoundError(f"Manual source file not found: {source_file}")

    try:
        catalog = discover_catalog()
    except Exception:  # noqa: BLE001 - manual fallback must work offline after catalog cache exists.
        catalog = load_cached_catalog()

    resources = {item["source_id"]: item for item in catalog["resources"]}
    resource = resources.get(source_id)
    if source_file.suffix:
        suffix = source_file.suffix
    elif resource:
        suffix = suffix_for(str(resource.get("format", "")), str(resource.get("url", "")))
    else:
        suffix = ".dat"
    target = RAW_DIR / f"{source_id}{suffix}"
    shutil.copyfile(source_file, target)

    return {
        "metadata": {
            "registered_at": utc_now(),
            "raw_directory": str(RAW_DIR.relative_to(PROJECT_ROOT)),
            "git_policy": "Raw downloads are ignored by Git.",
            "note": note,
        },
        "source": {
            "source_id": source_id,
            "status": "manual_registered",
            "original_path": str(source_file),
            "path": str(target.relative_to(PROJECT_ROOT)),
            "bytes": target.stat().st_size,
            "sha256": sha256_file(target),
            "expected_url": resource.get("url") if resource else None,
            "title": resource.get("title") if resource else None,
        },
    }


def inspect_raw_sources() -> dict[str, object]:
    files = []
    for path in sorted(RAW_DIR.glob("*")):
        if not path.is_file() or path.suffix == ".part":
            continue
        entry: dict[str, object] = {
            "path": str(path.relative_to(PROJECT_ROOT)),
            "bytes": path.stat().st_size,
            "sha256": sha256_bytes(path.read_bytes()),
            "format": path.suffix.lower().lstrip("."),
        }
        if path.suffix.lower() == ".ods":
            entry["ods"] = inspect_ods(path)
        elif path.suffix.lower() == ".xlsx":
            entry["xlsx"] = inspect_xlsx(path)
        elif path.suffix.lower() == ".zip":
            entry["zip"] = inspect_zip(path)
        files.append(entry)
    return {
        "metadata": {
            "inspected_at": utc_now(),
            "limitations": [
                "Inspection does not certify methodology; it only records file shape and basic schema signals.",
            ],
        },
        "summary": {
            "file_count": len(files),
            "files": [item["path"] for item in files],
        },
        "files": files,
    }


def normalize_official_sources() -> dict[str, object]:
    population_path = RAW_DIR / "ibge_population.ods"
    if not population_path.exists():
        candidates = sorted(RAW_DIR.glob("ibge_pop*.ods"))
        if candidates:
            population_path = candidates[-1]
    if not population_path.exists():
        raise FileNotFoundError("Run `python3 -m etl.official_data download --source ibge_population` first")

    population_rows = parse_ibge_population_ods(population_path)
    municipalities = fetch_ibge_municipalities()
    validation = validate_municipality_keys(population_rows, municipalities)
    sinesp = normalize_sinesp_sources(municipalities)
    combined = combine_sinesp_with_population(sinesp["rows"], population_rows)

    write_csv(
        PROCESSED_DIR / "ibge_population_2025.csv",
        population_rows,
        ["id_ibge", "uf", "cod_uf", "cod_municipio", "municipio", "populacao", "ano", "fonte"],
    )
    write_csv(
        PROCESSED_DIR / "ibge_municipalities.csv",
        municipalities,
        ["id_ibge", "municipio", "uf", "uf_nome", "regiao"],
    )
    write_json(PROCESSED_DIR / "municipality_key_validation.json", validation)

    metadata = {
        "generated_at": utc_now(),
        "sources": {
            "population": str(population_path.relative_to(PROJECT_ROOT)),
            "municipalities": IBGE_MUNICIPALITIES_API_URL,
        },
        "outputs": {
            "population": "data/processed/ibge_population_2025.csv",
            "municipalities": "data/processed/ibge_municipalities.csv",
            "validation": "data/processed/municipality_key_validation.json",
            "sinesp_status": "data/processed/sinesp_normalization_status.json",
            "sinesp_with_population": combined["outputs"]["combined_csv"],
        },
        "limitations": [
            "Dataset processado ainda nao alimenta o MVP visual.",
            "SINESP/MJSP so gera dataset criminal quando arquivos brutos locais estao disponiveis e o schema e reconhecido.",
            "Populacao 2025 e usada apenas para preparar taxa por 100 mil em etapa futura.",
        ],
    }
    write_json(PROCESSED_DIR / "normalization_metadata.json", metadata)

    return {
        "population_rows": population_rows,
        "municipalities": municipalities,
        "validation": validation,
        "sinesp": sinesp,
        "combined": combined,
        "metadata": metadata,
    }


def combine_sinesp_with_population(
    sinesp_rows: list[dict[str, object]],
    population_rows: list[dict[str, object]],
) -> dict[str, object]:
    population_by_id = {str(row["id_ibge"]): row for row in population_rows}
    combined_rows: list[dict[str, object]] = []
    cross_year_suppressed = 0
    for row in sinesp_rows:
        id_ibge = str(row.get("id_ibge") or "")
        population_row = population_by_id.get(id_ibge)
        if not population_row:
            continue
        population = int(population_row["populacao"])
        value = int(row["valor"])
        indicator_year = parse_optional_int(str(row.get("ano") or ""))
        population_year = parse_optional_int(str(population_row.get("ano") or ""))
        years_aligned = (
            indicator_year is not None
            and population_year is not None
            and indicator_year == population_year
        )
        if not population:
            taxa_100k: object = ""
            taxa_status = "sem_populacao"
        elif not years_aligned:
            # Numerador e denominador de anos diferentes (ex.: vitimas 2018 sobre
            # populacao 2025) produzem uma taxa enganosa. Suprimimos a taxa ate
            # existir serie populacional do ano do indicador.
            taxa_100k = ""
            taxa_status = "populacao_indisponivel"
            cross_year_suppressed += 1
        else:
            taxa_100k = round((value / population) * 100000, 4)
            taxa_status = "disponivel"
        limitacoes = "Join inicial por id_ibge; revisar metodologia antes de uso no app."
        if taxa_status == "populacao_indisponivel":
            limitacoes = (
                f"{limitacoes} Taxa por 100 mil suprimida: ano do indicador "
                f"({indicator_year}) difere do ano da populacao ({population_year})."
            )
        combined_rows.append(
            {
                "source_id": row["source_id"],
                "id_ibge": id_ibge,
                "uf": row["uf"] or population_row["uf"],
                "municipio": row["municipio"] or population_row["municipio"],
                "ano": row["ano"],
                "mes": row["mes"],
                "indicador_codigo": row["indicador_codigo"],
                "indicador_nome": row["indicador_nome"],
                "valor": value,
                "unidade_medida": row["unidade_medida"],
                "vitimas": row["vitimas"],
                "populacao": population,
                "taxa_100k": taxa_100k,
                "taxa_status": taxa_status,
                "fonte": row["fonte"],
                "fonte_populacao": population_row["fonte"],
                "limitacoes": limitacoes,
            }
        )

    if combined_rows:
        write_csv(
            PROCESSED_DIR / "sinesp_municipal_indicators_with_population.csv",
            combined_rows,
            SINESP_WITH_POPULATION_FIELDNAMES,
        )

    status = {
        "metadata": {
            "generated_at": utc_now(),
            "join_key": "id_ibge",
            "rate_formula": "taxa_100k = (valor / populacao) * 100000 quando ano do indicador == ano da populacao",
        },
        "summary": {
            "sinesp_rows": len(sinesp_rows),
            "combined_rows": len(combined_rows),
            "rows_without_population": len(sinesp_rows) - len(combined_rows),
            "rows_taxa_suppressed_cross_year": cross_year_suppressed,
            "can_calculate_taxa_100k": any(
                row.get("taxa_status") == "disponivel" for row in combined_rows
            ),
        },
        "outputs": {
            "combined_csv": (
                "data/processed/sinesp_municipal_indicators_with_population.csv" if combined_rows else None
            ),
            "status": "data/processed/sinesp_population_join_status.json",
        },
        "limitations": [
            "Dataset combinado ainda nao alimenta o MVP visual.",
            "Taxa por 100 mil so e calculada quando o ano do indicador coincide com o ano da populacao; caso contrario fica suprimida (taxa_status=populacao_indisponivel).",
            "Sem serie populacional historica, indicadores anteriores a 2025 ficam sem taxa ate o IBGE do ano correspondente ser integrado.",
            "Comparacoes historicas exigem revisao metodologica antes de publicacao.",
        ],
    }
    write_json(PROCESSED_DIR / "sinesp_population_join_status.json", status)
    return {"rows": combined_rows, "status": status, "outputs": status["outputs"]}


def generate_app_ready_dataset(
    input_path: Path | None = None,
    centroids_path: Path | None = None,
    output_path: Path | None = None,
    write_samples: bool = False,
) -> dict[str, object]:
    source_path = resolve_app_ready_input(input_path)
    is_sample = is_relative_path(source_path, SAMPLES_DIR)
    rows = read_csv_file_rows(source_path)
    centroids = load_app_ready_centroids(centroids_path)
    app_rows, skipped_without_centroid = build_app_ready_rows(rows, centroids, is_sample=is_sample)
    periods = build_app_ready_periods(app_rows)
    indicators = build_app_ready_indicators(app_rows)
    latest_period = periods[0]["key"] if periods else None
    payload = {
        "status": {
            "source": "MJSP/SINESP" if not is_sample else "MJSP/SINESP - amostra oficial local",
            "lastUpdated": utc_now(),
            "latestPeriod": format_period_label(latest_period) if latest_period else "",
            "status": "Oficial processado localmente" if not is_sample else "Amostra oficial versionada",
            "mode": "official" if not is_sample else "official_sample",
            "sourceId": "sinesp_municipios",
            "unit": "vitimas",
            "limitations": [
                "O XLSX municipal SINESP/MJSP representa vitimas de homicidio doloso, nao ocorrencias.",
                "Taxas usam populacao IBGE 2025 ate haver serie populacional historica.",
                "Linhas sem centroide conhecido ficam fora do JSON do mapa ate a malha IBGE real ser integrada.",
            ],
        },
        "indicators": indicators,
        "periods": periods,
        "items": app_rows,
    }
    target = output_path or APP_READY_DIR / "crime-map.json"
    write_json(target, payload)
    if write_samples:
        sample_payload = dict(payload)
        sample_payload["items"] = app_rows[:25]
        write_json(SAMPLES_DIR / "crime_map_app_ready.sample.json", sample_payload)

    summary = {
        "input": project_relative_path(source_path),
        "output": project_relative_path(target),
        "is_sample": is_sample,
        "source_rows": len(rows),
        "app_rows": len(app_rows),
        "skipped_without_centroid": skipped_without_centroid,
        "period_count": len(periods),
        "indicator_count": len(indicators),
    }
    write_json(APP_READY_DIR / "crime-map.status.json", {"metadata": {"generated_at": utc_now()}, "summary": summary})
    return {"summary": summary, "payload": payload}


def resolve_app_ready_input(input_path: Path | None) -> Path:
    candidates = [
        input_path,
        PROCESSED_DIR / "sinesp_municipal_indicators_with_population.csv",
        SAMPLES_DIR / "sinesp_municipal_indicators_with_population.sample.csv",
    ]
    for candidate in candidates:
        if not candidate:
            continue
        possible_paths = (
            [candidate]
            if candidate.is_absolute()
            else [Path.cwd() / candidate, PROJECT_ROOT / candidate]
        )
        for possible_path in possible_paths:
            resolved = possible_path.resolve()
            if resolved.exists():
                return resolved
    raise FileNotFoundError(
        "No SINESP+population CSV found. Run normalize or pass --input to generate-app-ready."
    )


def is_relative_path(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
    except ValueError:
        return False
    return True


def _merge_centroids_csv(centroids: dict[str, tuple[float, float]], path: Path) -> None:
    for row in read_csv_file_rows(path):
        id_ibge = str(row.get("id_ibge") or row.get("idIbge") or "")
        lat = parse_optional_float(row.get("lat") or row.get("latitude"))
        lng = parse_optional_float(row.get("lng") or row.get("longitude"))
        if id_ibge and lat is not None and lng is not None:
            centroids[id_ibge] = (lat, lng)


def load_app_ready_centroids(path: Path | None) -> dict[str, tuple[float, float]]:
    centroids: dict[str, tuple[float, float]] = {}
    # Base nacional de centroides municipais (malha IBGE), quando versionada.
    # Desbloqueia a carga nacional: sem centroide o municipio fica fora do mapa.
    if MUNICIPAL_CENTROIDS_REFERENCE.exists():
        _merge_centroids_csv(centroids, MUNICIPAL_CENTROIDS_REFERENCE)
    # A amostra curada sobrepoe-se (mantem estaveis as coordenadas de fixtures).
    centroids.update(APP_READY_SAMPLE_CENTROIDS)
    # Override explicito via --centroids tem prioridade final.
    if path:
        _merge_centroids_csv(centroids, path)
    return centroids


def build_app_ready_rows(
    rows: list[dict[str, str]],
    centroids: dict[str, tuple[float, float]],
    is_sample: bool,
) -> tuple[list[dict[str, object]], int]:
    normalized = []
    skipped_without_centroid = 0
    for row in rows:
        id_ibge = str(row.get("id_ibge") or "")
        centroid = centroids.get(id_ibge)
        app_indicator = APP_INDICATOR_KEYS.get(str(row.get("indicador_codigo") or ""))
        if not id_ibge or not centroid or not app_indicator:
            if id_ibge and not centroid:
                skipped_without_centroid += 1
            continue
        year = parse_optional_int(str(row.get("ano") or ""))
        month = parse_optional_int(str(row.get("mes") or ""))
        if year is None or month is None:
            continue
        value = parse_optional_int(str(row.get("valor") or ""))
        population = parse_optional_int(str(row.get("populacao") or ""))
        taxa = parse_optional_float(row.get("taxa_100k"))
        data_status = app_ready_data_status(value, population, is_sample)
        normalized.append(
            {
                "idIbge": id_ibge,
                "municipio": clean_text(str(row.get("municipio") or "")),
                "uf": clean_text(str(row.get("uf") or "")).upper(),
                "estado": state_name_for_uf(clean_text(str(row.get("uf") or "")).upper()),
                "lat": centroid[0],
                "lng": centroid[1],
                "populacao": population or 0,
                "periodo": f"{year}-{month:02d}",
                "indicator": app_indicator,
                "metric": {
                    "total": value or 0,
                    "taxa100k": taxa,
                    "variacaoMensal": None,
                    "variacaoAnual": None,
                    "dataStatus": data_status,
                    "unidade": row.get("unidade_medida") or "vitimas",
                    "fonte": row.get("fonte") or "MJSP/SINESP",
                    "sourceId": row.get("source_id") or "sinesp_municipios",
                    "limitacoes": row.get("limitacoes") or "",
                },
            }
        )
    return score_app_ready_rows(normalized), skipped_without_centroid


def score_app_ready_rows(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    by_group: dict[tuple[str, str], list[dict[str, object]]] = {}
    for row in rows:
        by_group.setdefault((str(row["periodo"]), str(row["indicator"])), []).append(row)
    output = []
    for group_rows in by_group.values():
        # Quando ninguem no grupo tem taxa por 100 mil (ex.: populacao de ano
        # diferente suprimiu a taxa), o ranking recai sobre o total absoluto
        # para nao gerar um indice arbitrario a partir de taxas ausentes.
        group_has_rate = any(dict(row["metric"]).get("taxa100k") is not None for row in group_rows)
        rank_field = "taxa100k" if group_has_rate else "total"
        ordered = sorted(
            group_rows,
            key=lambda item: float(dict(item["metric"]).get(rank_field) or -1),
            reverse=True,
        )
        count = max(len(ordered), 1)
        for index, row in enumerate(ordered):
            score = round(((count - index) / count) * 100)
            metric = dict(row["metric"])
            metric["score"] = score
            metric["nivel"] = risk_level_from_score(score)
            indicator = str(row["indicator"])
            app_row = {key: value for key, value in row.items() if key not in {"indicator", "metric"}}
            app_row["indicadores"] = {indicator: metric}
            output.append(app_row)
    return sorted(output, key=lambda item: (str(item["periodo"]), str(item["uf"]), str(item["municipio"])))


def app_ready_data_status(value: int | None, population: int | None, is_sample: bool) -> str:
    if value is None:
        return "sem_dados"
    if value == 0:
        return "zero_registrado"
    if not population:
        return "populacao_indisponivel"
    return "amostra_oficial" if is_sample else "oficial"


def build_app_ready_periods(rows: list[dict[str, object]]) -> list[dict[str, str]]:
    periods = sorted({str(row["periodo"]) for row in rows}, reverse=True)
    return [{"key": period, "label": format_period_label(period), "updatedAt": utc_now()[:10]} for period in periods]


def build_app_ready_indicators(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    keys = sorted({next(iter(dict(row["indicadores"]).keys())) for row in rows})
    labels = {
        "homicidioDoloso": ("homicidio_doloso", "Homicidio doloso", "vitimas"),
        "feminicidio": ("feminicidio", "Feminicidio", "vitimas"),
        "rouboVeiculos": ("roubo_veiculos", "Roubo de veiculos", "ocorrencias"),
        "rouboCarga": ("roubo_carga", "Roubo de carga", "ocorrencias"),
        "estupro": ("estupro", "Estupro", "ocorrencias"),
        "traficoDrogas": ("trafico_drogas", "Trafico de drogas", "ocorrencias"),
        "furtoVeiculos": ("furto_veiculos", "Furto de veiculos", "ocorrencias"),
    }
    return [
        {
            "key": key,
            "codigo": labels.get(key, (key, key, "ocorrencias"))[0],
            "label": labels.get(key, (key, key, "ocorrencias"))[1],
            "unidade": labels.get(key, (key, key, "ocorrencias"))[2],
            "oficial": True,
        }
        for key in keys
    ]


def format_period_label(period: str | None) -> str:
    if not period:
        return ""
    year, month = period.split("-")
    labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    return f"{labels[int(month) - 1]}/{year}"


def risk_level_from_score(score: int) -> str:
    if score <= 20:
        return "baixo"
    if score <= 40:
        return "moderado"
    if score <= 60:
        return "atencao"
    if score <= 80:
        return "alto"
    return "critico"


def state_name_for_uf(uf: str) -> str:
    names = {
        "AC": "Acre",
        "AL": "Alagoas",
        "AP": "Amapa",
        "AM": "Amazonas",
        "BA": "Bahia",
        "CE": "Ceara",
        "DF": "Distrito Federal",
        "ES": "Espirito Santo",
        "GO": "Goias",
        "MA": "Maranhao",
        "MT": "Mato Grosso",
        "MS": "Mato Grosso do Sul",
        "MG": "Minas Gerais",
        "PA": "Para",
        "PB": "Paraiba",
        "PR": "Parana",
        "PE": "Pernambuco",
        "PI": "Piaui",
        "RJ": "Rio de Janeiro",
        "RN": "Rio Grande do Norte",
        "RS": "Rio Grande do Sul",
        "RO": "Rondonia",
        "RR": "Roraima",
        "SC": "Santa Catarina",
        "SP": "Sao Paulo",
        "SE": "Sergipe",
        "TO": "Tocantins",
    }
    return names.get(uf, uf)


def parse_optional_float(value: object) -> float | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return float(text.replace(",", "."))
    except ValueError:
        return None


def normalize_sinesp_sources(municipalities: list[dict[str, str]]) -> dict[str, object]:
    files = find_sinesp_raw_files()
    all_rows: list[dict[str, object]] = []
    file_results = []
    for path in files:
        try:
            rows, result = normalize_sinesp_file(path)
            all_rows.extend(rows)
            file_results.append(result)
        except Exception as error:  # noqa: BLE001 - status file should explain per-file blockers.
            file_results.append(
                {
                    "path": str(path.relative_to(PROJECT_ROOT)),
                    "status": "failed",
                    "error": str(error),
                }
            )

    if all_rows:
        write_csv(PROCESSED_DIR / "sinesp_indicators_normalized.csv", all_rows, SINESP_NORMALIZED_FIELDNAMES)

    key_validation = validate_sinesp_municipality_keys(all_rows, municipalities)
    status = {
        "metadata": {
            "generated_at": utc_now(),
            "source_family": "MJSP/SINESP",
            "git_policy": "Raw and full processed outputs remain ignored by Git.",
            "limitations": [
                "Normalizacao inicial e tolerante a schema; revisar dicionario oficial antes de uso publico.",
                "Linhas sem ano, indicador ou valor numerico nao entram no CSV normalizado.",
                "id_ibge so e validado quando a fonte traz codigo municipal de 7 digitos.",
                "O MVP visual continua usando dados demonstrativos.",
            ],
        },
        "summary": {
            "raw_files": len(files),
            "normalized_rows": len(all_rows),
            "files_with_rows": sum(1 for item in file_results if item.get("normalized_rows", 0)),
            "key_validation": key_validation["summary"],
        },
        "outputs": {
            "normalized_csv": "data/processed/sinesp_indicators_normalized.csv" if all_rows else None,
            "status": "data/processed/sinesp_normalization_status.json",
        },
        "indicator_resolution": sinesp_municipal_indicator_resolution(),
        "files": file_results,
        "municipality_key_validation": key_validation,
    }
    write_json(PROCESSED_DIR / "sinesp_normalization_status.json", status)
    return {"rows": all_rows, "status": status}


def sinesp_municipal_indicator_resolution() -> dict[str, object]:
    return {
        "source_id": "sinesp_municipios",
        "official_resource": "Dicionário de Dados - Município",
        "resource_url": (
            "https://dados.mj.gov.br/dataset/210b9ae2-21fc-4986-89c6-2006eb4db247/"
            "resource/f29f6034-8dfc-4270-974e-ceedd18d7244/download/dicionario-de-dadosmunicipios.pdf"
        ),
        "unit_column": "Vítimas",
        "unit_meaning": "Número de pessoas registradas como vítimas em um boletim de ocorrência.",
        "indicator_code": "homicidio_doloso",
        "indicator_name": SINESP_MUNICIPAL_DEFAULT_INDICATOR,
        "confidence": "high",
        "reasoning": (
            "O dicionario municipal lista a unidade de medida Vítimas e, na seção Indicadores, "
            "descreve Homicídio doloso conforme Portaria MJSP nº 229/2018. O XLSX municipal "
            "usa somente a coluna Vítimas, portanto o valor deve ser tratado como vítimas de "
            "homicídio doloso, não como ocorrências."
        ),
        "limitations": [
            "O XLSX municipal nao traz coluna explicita de indicador por linha.",
            "Para varios indicadores municipais por crime, usar a Base de Dados VDE se o schema trouxer indicador/natureza.",
        ],
    }


def find_sinesp_raw_files() -> list[Path]:
    files: list[Path] = []
    for source_id in SINESP_SOURCE_IDS:
        files.extend(
            path
            for path in sorted(RAW_DIR.glob(f"{source_id}.*"))
            if path.is_file() and path.suffix != ".part"
        )
    return files


def inspect_vde_source() -> dict[str, object]:
    complete = RAW_DIR / "sinesp_vde.zip"
    partial = RAW_DIR / "sinesp_vde.zip.part"
    if complete.exists():
        try:
            inspection = inspect_zip(complete)
            tabular_members = inspection.get("tabular_members", [])
            return {
                "metadata": {
                    "inspected_at": utc_now(),
                    "source_id": "sinesp_vde",
                    "path": project_relative_path(complete),
                    "sha256": sha256_file(complete),
                },
                "summary": {
                    "status": "downloaded",
                    "bytes": complete.stat().st_size,
                    "tabular_member_count": len(tabular_members),
                    "can_attempt_normalization": bool(tabular_members),
                },
                "inspection": inspection,
                "decision": "normalization_pending_schema_review",
            }
        except zipfile.BadZipFile as error:
            return vde_incomplete_status(complete, f"invalid zip: {error}")
    if partial.exists():
        return vde_incomplete_status(partial, "partial download present; resume before inspection")
    return {
        "metadata": {"inspected_at": utc_now(), "source_id": "sinesp_vde"},
        "summary": {
            "status": "missing",
            "bytes": 0,
            "tabular_member_count": 0,
            "can_attempt_normalization": False,
        },
        "decision": "download_required",
        "resume_command": (
            "python3 -m etl.official_data download --source sinesp_vde "
            "--timeout 900 --retries 5 --backoff-seconds 5"
        ),
    }


def vde_incomplete_status(path: Path, reason: str) -> dict[str, object]:
    return {
        "metadata": {
            "inspected_at": utc_now(),
            "source_id": "sinesp_vde",
            "path": project_relative_path(path),
        },
        "summary": {
            "status": "incomplete_download",
            "bytes": path.stat().st_size if path.exists() else 0,
            "tabular_member_count": 0,
            "can_attempt_normalization": False,
        },
        "decision": "resume_download_before_schema_assumption",
        "reason": reason,
        "resume_command": (
            "python3 -m etl.official_data download --source sinesp_vde "
            "--timeout 900 --retries 5 --backoff-seconds 5"
        ),
    }


def normalize_vde_source() -> dict[str, object]:
    path = RAW_DIR / "sinesp_vde.zip"
    if not path.exists():
        status = inspect_vde_source()
        status["summary"]["normalized_rows"] = 0
        return {"rows": [], "status": status}
    rows, result = normalize_sinesp_file(path)
    municipalities = fetch_ibge_municipalities()
    key_validation = validate_sinesp_municipality_keys(rows, municipalities)
    if rows:
        write_csv(PROCESSED_DIR / "sinesp_vde_normalized.csv", rows, SINESP_NORMALIZED_FIELDNAMES)
    status = {
        "metadata": {
            "generated_at": utc_now(),
            "source_id": "sinesp_vde",
            "path": project_relative_path(path),
            "sha256": sha256_file(path),
            "policy": "VDE rows are normalized only when explicit indicator and value columns are recognized.",
        },
        "summary": {
            "status": "normalized" if rows else "no_recognized_rows",
            "normalized_rows": len(rows),
            "can_support_multi_indicator_municipal_mvp": has_multi_indicator_municipal_rows(rows),
            "key_validation": key_validation["summary"],
        },
        "file": result,
        "municipality_key_validation": key_validation,
        "decision": (
            "vde_viavel_para_mvp_municipal"
            if has_multi_indicator_municipal_rows(rows)
            else "vde_nao_confirmada_para_mvp_municipal"
        ),
    }
    return {"rows": rows, "status": status}


def has_multi_indicator_municipal_rows(rows: list[dict[str, object]]) -> bool:
    municipal_rows = [row for row in rows if row.get("nivel_geografico") == "municipio" and row.get("id_ibge")]
    indicators = {str(row.get("indicador_codigo") or "") for row in municipal_rows}
    return len(municipal_rows) > 0 and len(indicators - {"", "vitimas_indicador_nao_informado"}) > 1


def normalize_sinesp_file(path: Path) -> tuple[list[dict[str, object]], dict[str, object]]:
    source_id = path.stem
    suffix = path.suffix.lower()
    if suffix == ".xlsx":
        return normalize_sinesp_xlsx(path, source_id)
    if suffix == ".csv":
        rows = csv_rows_to_indexed(read_csv_file_rows(path))
        normalized = normalize_sinesp_table_rows(rows, source_id=source_id, source_file=path)
        return normalized, sinesp_file_result(path, source_id, normalized, "csv")
    if suffix == ".zip":
        return normalize_sinesp_zip(path, source_id)
    return [], {
        "path": str(path.relative_to(PROJECT_ROOT)),
        "status": "skipped",
        "reason": f"unsupported SINESP raw format: {suffix}",
    }


def normalize_sinesp_xlsx(path: Path, source_id: str) -> tuple[list[dict[str, object]], dict[str, object]]:
    all_rows: list[dict[str, object]] = []
    sheets = []
    for sheet_path in list_xlsx_sheet_paths(path):
        rows = list(read_xlsx_rows(path, sheet_path=sheet_path))
        normalized = normalize_sinesp_table_rows(rows, source_id=source_id, source_file=path)
        all_rows.extend(normalized)
        sheets.append({"sheet_path": sheet_path, "normalized_rows": len(normalized)})
    result = sinesp_file_result(path, source_id, all_rows, "xlsx")
    result["sheets"] = sheets
    return all_rows, result


def normalize_sinesp_zip(path: Path, source_id: str) -> tuple[list[dict[str, object]], dict[str, object]]:
    all_rows: list[dict[str, object]] = []
    members = []
    with zipfile.ZipFile(path) as archive:
        for member in archive.infolist():
            suffix = Path(member.filename).suffix.lower()
            if suffix not in {".csv", ".xlsx"}:
                continue
            if member.file_size > 100_000_000:
                members.append(
                    {
                        "name": member.filename,
                        "status": "skipped",
                        "reason": "member larger than 100 MB; inspect manually before local normalization",
                    }
                )
                continue
            if suffix == ".csv":
                text = archive.read(member).decode("utf-8-sig", errors="replace")
                indexed_rows = csv_rows_to_indexed(read_csv_text_rows(text))
                normalized = normalize_sinesp_table_rows(
                    indexed_rows,
                    source_id=source_id,
                    source_file=path,
                    member_name=member.filename,
                )
                all_rows.extend(normalized)
                members.append({"name": member.filename, "status": "normalized", "normalized_rows": len(normalized)})
            else:
                members.append(
                    {
                        "name": member.filename,
                        "status": "skipped",
                        "reason": "xlsx inside zip is listed for inspection; extract/register manually if needed",
                    }
                )
    result = sinesp_file_result(path, source_id, all_rows, "zip")
    result["members"] = members
    return all_rows, result


def sinesp_file_result(
    path: Path,
    source_id: str,
    rows: list[dict[str, object]],
    format_name: str,
) -> dict[str, object]:
    return {
        "path": str(path.relative_to(PROJECT_ROOT)),
        "source_id": source_id,
        "format": format_name,
        "status": "normalized" if rows else "no_rows",
        "normalized_rows": len(rows),
        "sha256": sha256_file(path),
    }


def normalize_sinesp_table_rows(
    rows: list[tuple[int, list[str]]],
    source_id: str,
    source_file: Path,
    member_name: str | None = None,
) -> list[dict[str, object]]:
    header = detect_tabular_header(rows)
    if not header:
        return []

    header_index = int(header["row_index"])
    header_values = [str(value) for value in header["values"]]
    normalized_headers = make_unique_headers([normalize_header(value) for value in header_values])
    output_rows: list[dict[str, object]] = []
    for row_index, values in rows:
        if row_index <= header_index:
            continue
        row = {
            normalized_headers[index]: values[index].strip() if index < len(values) else ""
            for index in range(len(normalized_headers))
        }
        record = normalize_sinesp_row(row, source_id, source_file, member_name=member_name)
        if record:
            output_rows.append(record)
    return output_rows


def normalize_sinesp_row(
    row: Mapping[str, str],
    source_id: str,
    source_file: Path,
    member_name: str | None = None,
) -> dict[str, object] | None:
    indicator_name = pick_field(row, SINESP_COLUMN_ALIASES["indicador"])
    year = parse_optional_year(pick_field(row, SINESP_COLUMN_ALIASES["ano"]))
    month = parse_optional_month(pick_field(row, SINESP_COLUMN_ALIASES["mes"]))
    if year is None or month is None:
        period = parse_optional_month_year(pick_field(row, SINESP_COLUMN_ALIASES["mes_ano"]))
        if period:
            year = year or period[0]
            month = month or period[1]
    occurrences = parse_optional_int(pick_field(row, SINESP_COLUMN_ALIASES["ocorrencias"]))
    victims = parse_optional_int(pick_field(row, SINESP_COLUMN_ALIASES["vitimas"]))
    metric_value = occurrences if occurrences is not None else victims
    unit = "ocorrencias" if occurrences is not None else "vitimas"
    if not indicator_name and victims is not None and source_id == "sinesp_municipios":
        indicator_name = SINESP_MUNICIPAL_DEFAULT_INDICATOR
    elif not indicator_name and victims is not None:
        indicator_name = "Vítimas (indicador não informado no arquivo)"
    if not indicator_name or year is None or metric_value is None:
        return None

    id_ibge = normalize_sinesp_id_ibge(pick_field(row, SINESP_COLUMN_ALIASES["id_ibge"]))
    municipality = clean_text(pick_field(row, SINESP_COLUMN_ALIASES["municipio"]))
    uf = clean_text(pick_field(row, SINESP_COLUMN_ALIASES["uf"])).upper()
    source_label = project_relative_path(source_file)
    if member_name:
        source_label = f"{source_label}!{member_name}"

    return {
        "source_id": source_id,
        "source_file": source_label,
        "nivel_geografico": "municipio" if id_ibge or municipality else "uf",
        "id_ibge": id_ibge or "",
        "uf": uf if re.fullmatch(r"[A-Z]{2}", uf) else "",
        "municipio": municipality,
        "ano": year,
        "mes": month or "",
        "indicador_codigo": canonical_indicator_code(indicator_name),
        "indicador_nome": clean_text(indicator_name),
        "valor": metric_value,
        "unidade_medida": unit,
        "ocorrencias": occurrences if occurrences is not None else "",
        "vitimas": victims if victims is not None else "",
        "fonte": "MJSP/SINESP",
        "data_coleta": utc_now(),
        "limitacoes": sinesp_row_limitation(indicator_name, unit),
    }


def parse_ibge_population_ods(path: Path) -> list[dict[str, object]]:
    rows = []
    header_found = False
    for _, row in iter_ods_rows(path):
        values = trim_trailing_empty(row)
        if not values:
            continue
        normalized = [normalize_header(value) for value in values]
        if normalized[:5] == ["uf", "cod_uf", "cod_munic", "nome_do_municipio", "populacao_estimada"]:
            header_found = True
            continue
        if not header_found:
            continue
        if len(values) < 5:
            continue
        uf, cod_uf, cod_municipio, municipio, population = values[:5]
        if not re.fullmatch(r"[A-Z]{2}", uf.strip()):
            continue
        cod_uf_digits = only_digits(cod_uf).zfill(2)
        cod_municipio_digits = only_digits(cod_municipio).zfill(5)
        if len(cod_uf_digits) != 2 or len(cod_municipio_digits) != 5:
            continue
        rows.append(
            {
                "id_ibge": f"{cod_uf_digits}{cod_municipio_digits}",
                "uf": uf.strip(),
                "cod_uf": cod_uf_digits,
                "cod_municipio": cod_municipio_digits,
                "municipio": municipio.strip(),
                "populacao": int(only_digits(population)),
                "ano": 2025,
                "fonte": "IBGE Estimativas de População 2025",
            }
        )
    return rows


def fetch_ibge_municipalities() -> list[dict[str, str]]:
    data = fetch_json(IBGE_MUNICIPALITIES_API_URL)
    rows = []
    for item in data:
        uf = municipality_uf(item)
        region = uf["regiao"]
        rows.append(
            {
                "id_ibge": str(item["id"]),
                "municipio": item["nome"],
                "uf": uf["sigla"],
                "uf_nome": uf["nome"],
                "regiao": region["nome"],
            }
        )
    return rows


def municipality_uf(item: dict[str, object]) -> dict[str, object]:
    microregion = item.get("microrregiao")
    if isinstance(microregion, dict):
        return microregion["mesorregiao"]["UF"]
    immediate_region = item.get("regiao-imediata")
    if isinstance(immediate_region, dict):
        return immediate_region["regiao-intermediaria"]["UF"]
    raise ValueError(f"Municipality without UF in IBGE API payload: {item!r}")


def validate_municipality_keys(
    population_rows: list[dict[str, object]],
    municipalities: list[dict[str, str]],
) -> dict[str, object]:
    population_ids = [str(row["id_ibge"]) for row in population_rows]
    registry_ids = [row["id_ibge"] for row in municipalities]
    population_set = set(population_ids)
    registry_set = set(registry_ids)
    duplicate_population_ids = sorted({item for item in population_ids if population_ids.count(item) > 1})
    duplicate_registry_ids = sorted({item for item in registry_ids if registry_ids.count(item) > 1})
    missing_in_registry = sorted(population_set - registry_set)
    missing_population = sorted(registry_set - population_set)

    return {
        "metadata": {
            "validated_at": utc_now(),
            "key": "id_ibge",
            "key_rule": "cod_uf(2) + cod_municipio(5)",
        },
        "summary": {
            "population_rows": len(population_rows),
            "municipality_registry_rows": len(municipalities),
            "matched_ids": len(population_set & registry_set),
            "missing_in_registry_count": len(missing_in_registry),
            "missing_population_count": len(missing_population),
            "duplicate_population_ids_count": len(duplicate_population_ids),
            "duplicate_registry_ids_count": len(duplicate_registry_ids),
            "is_complete_match": not missing_in_registry and not missing_population,
        },
        "missing_in_registry": missing_in_registry[:50],
        "missing_population": missing_population[:50],
        "duplicate_population_ids": duplicate_population_ids[:50],
        "duplicate_registry_ids": duplicate_registry_ids[:50],
    }


def validate_sinesp_municipality_keys(
    sinesp_rows: list[dict[str, object]],
    municipalities: list[dict[str, str]],
) -> dict[str, object]:
    registry_ids = {row["id_ibge"] for row in municipalities}
    sinesp_ids = [str(row["id_ibge"]) for row in sinesp_rows if str(row.get("id_ibge") or "")]
    unique_sinesp_ids = set(sinesp_ids)
    unknown_ids = sorted(set(sinesp_ids) - registry_ids)
    duplicate_rows = len(sinesp_ids) - len(set(sinesp_ids))
    return {
        "summary": {
            "sinesp_rows": len(sinesp_rows),
            "rows_with_id_ibge": len(sinesp_ids),
            "unique_id_count": len(unique_sinesp_ids),
            "matched_id_count": len(unique_sinesp_ids & registry_ids),
            "unknown_id_count": len(unknown_ids),
            "repeated_time_series_id_rows": duplicate_rows,
            "is_complete_id_match": bool(sinesp_rows) and not unknown_ids and bool(sinesp_ids),
            "can_join_known_ids_by_id_ibge": bool(unique_sinesp_ids & registry_ids),
        },
        "unknown_ids": unknown_ids[:50],
    }


def detect_tabular_header(rows: list[tuple[int, list[str]]]) -> dict[str, object] | None:
    best: dict[str, object] | None = None
    for row_index, values in rows[:100]:
        normalized = [normalize_header(value) for value in trim_trailing_empty(values)]
        if not normalized:
            continue
        score = sinesp_header_score(normalized)
        if best is None or score > int(best["score"]):
            best = {
                "row_index": row_index,
                "score": score,
                "values": trim_trailing_empty(values),
                "normalized_values": normalized,
            }
    if best and int(best["score"]) >= 3:
        return best
    return None


def sinesp_header_score(normalized_headers: list[str]) -> int:
    score = 0
    for aliases in SINESP_COLUMN_ALIASES.values():
        if any(alias in normalized_headers for alias in aliases):
            score += 1
    return score


def make_unique_headers(headers: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    unique = []
    for index, header in enumerate(headers):
        name = header or f"coluna_{index + 1}"
        count = seen.get(name, 0)
        seen[name] = count + 1
        unique.append(name if count == 0 else f"{name}_{count + 1}")
    return unique


def pick_field(row: Mapping[str, str], aliases: list[str]) -> str:
    for alias in aliases:
        value = row.get(alias)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def normalize_sinesp_id_ibge(value: str) -> str:
    digits = only_digits(value)
    if len(digits) == 7:
        return digits
    return ""


def canonical_indicator_code(value: str) -> str:
    normalized = normalize_header(value)
    if "indicador_nao_informado" in normalized:
        return "vitimas_indicador_nao_informado"
    for code, aliases in SINESP_INDICATOR_ALIASES.items():
        if normalized in aliases:
            return code
    return normalized[:80]


def parse_optional_int(value: str) -> int | None:
    text = str(value or "").strip()
    if not text:
        return None
    text = text.replace(".", "").replace(",", ".")
    try:
        return int(float(text))
    except ValueError:
        return None


def parse_optional_year(value: str) -> int | None:
    number = parse_optional_int(value)
    if number is None or number < 2000 or number > 2100:
        return None
    return number


def parse_optional_month(value: str) -> int | None:
    text = str(value or "").strip()
    if not text:
        return None
    normalized = normalize_header(text)
    if normalized in MONTH_NAMES:
        return MONTH_NAMES[normalized]
    number = parse_optional_int(text)
    if number is None or number < 1 or number > 12:
        return None
    return number


def parse_optional_month_year(value: str) -> tuple[int, int] | None:
    text = str(value or "").strip()
    if not text:
        return None

    if re.fullmatch(r"\d+(\.0)?", text):
        serial = int(float(text))
        if serial > 30000:
            date_value = datetime(1899, 12, 30) + timedelta(days=serial)
            return date_value.year, date_value.month

    match = re.fullmatch(r"(\d{1,2})[/.-](\d{4})", text)
    if match:
        month = int(match.group(1))
        year = int(match.group(2))
        if 1 <= month <= 12 and 2000 <= year <= 2100:
            return year, month

    match = re.fullmatch(r"(\d{4})[/.-](\d{1,2})", text)
    if match:
        year = int(match.group(1))
        month = int(match.group(2))
        if 1 <= month <= 12 and 2000 <= year <= 2100:
            return year, month
    return None


def sinesp_row_limitation(indicator_name: str, unit: str) -> str:
    limitations = ["Normalizacao inicial; revisar dicionario oficial antes de uso no app."]
    if canonical_indicator_code(indicator_name) == "homicidio_doloso":
        limitations.append(
            "Indicador inferido do Dicionario de Dados - Municipio, que descreve o XLSX municipal como Homicidio doloso."
        )
    elif canonical_indicator_code(indicator_name) == "vitimas_indicador_nao_informado":
        limitations.append("Arquivo informa vitimas, mas nao explicita o tipo de crime/indicador.")
    if unit == "vitimas":
        limitations.append("Valor canonico usa a coluna Vitimas porque nao ha coluna de ocorrencias no arquivo.")
    return " ".join(limitations)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def read_csv_file_rows(path: Path) -> list[dict[str, str]]:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    return read_csv_text_rows(text)


def read_csv_text_rows(text: str) -> list[dict[str, str]]:
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    return list(csv.DictReader(text.splitlines(), dialect=dialect))


def csv_rows_to_indexed(rows: list[dict[str, str]]) -> list[tuple[int, list[str]]]:
    if not rows:
        return []
    headers = list(rows[0].keys())
    indexed = [(0, headers)]
    for index, row in enumerate(rows, start=1):
        indexed.append((index, [row.get(header, "") for header in headers]))
    return indexed


def iter_ods_rows(path: Path) -> Iterator[tuple[int, list[str]]]:
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("content.xml"))

    logical_index = 0
    for row in root.findall(".//table:table-row", ODS_NS):
        repeat = int(row.attrib.get(ROWS_REPEATED, "1"))
        values: list[str] = []
        for cell in row.findall(TABLE_CELL, ODS_NS):
            column_repeat = int(cell.attrib.get(COLUMNS_REPEATED, "1"))
            text = cell_text(cell)
            values.extend([text] * min(column_repeat, 32))

        if repeat > 1 and not any(values):
            logical_index += repeat
            continue
        for _ in range(repeat):
            yield logical_index, values
            logical_index += 1


def cell_text(cell: ET.Element) -> str:
    parts = []
    for paragraph in cell.findall(".//text:p", ODS_NS):
        text = "".join(paragraph.itertext()).strip()
        if text:
            parts.append(text)
    return " ".join(parts).strip()


def inspect_ods(path: Path) -> dict[str, object]:
    samples = []
    row_count = 0
    for row_index, row in iter_ods_rows(path):
        row_count += 1
        values = trim_trailing_empty(row)
        if values and len(samples) < 10:
            samples.append({"row_index": row_index, "values": values[:8]})
    return {"logical_nonempty_or_repeated_rows": row_count, "sample_rows": samples}


def inspect_xlsx(path: Path) -> dict[str, object]:
    sheets = []
    for sheet in list_xlsx_sheets(path)[:5]:
        rows = list(read_xlsx_rows(path, sheet_path=sheet["path"], max_rows=50))
        sheets.append(
            {
                "sheet_name": sheet["name"],
                "sheet_path": sheet["path"],
                "sample_rows": [{"row_index": index, "values": row[:12]} for index, row in rows[:20]],
                "header_candidate": detect_tabular_header(rows),
            }
        )
    return {
        "sheets": sheets,
        "note": "XLSX inspection reads worksheet XML directly and samples up to five sheets.",
    }


def list_xlsx_sheet_paths(path: Path) -> list[str]:
    return [sheet["path"] for sheet in list_xlsx_sheets(path)]


def list_xlsx_sheets(path: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(path) as archive:
        try:
            workbook = ET.fromstring(archive.read("xl/workbook.xml"))
            relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        except KeyError:
            sheet_paths = sorted(
                name
                for name in archive.namelist()
                if name.startswith("xl/worksheets/") and name.endswith(".xml")
            )
            return [{"name": Path(sheet_path).stem, "path": sheet_path} for sheet_path in sheet_paths]

    workbook_ns = {
        "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    }
    rel_ns = {"rel": "http://schemas.openxmlformats.org/package/2006/relationships"}
    targets = {
        relationship.attrib["Id"]: relationship.attrib["Target"]
        for relationship in relationships.findall("rel:Relationship", rel_ns)
        if relationship.attrib.get("Type", "").endswith("/worksheet")
    }
    sheets = []
    for sheet in workbook.findall(".//main:sheet", workbook_ns):
        relationship_id = sheet.attrib.get(f"{{{workbook_ns['rel']}}}id", "")
        target = targets.get(relationship_id)
        if not target:
            continue
        sheet_path = target.lstrip("/")
        if not sheet_path.startswith("xl/"):
            sheet_path = f"xl/{sheet_path}"
        sheets.append({"name": sheet.attrib.get("name", Path(sheet_path).stem), "path": sheet_path})
    return sheets or [{"name": "sheet1", "path": "xl/worksheets/sheet1.xml"}]


def read_xlsx_rows(
    path: Path,
    sheet_path: str = "xl/worksheets/sheet1.xml",
    max_rows: int | None = None,
) -> Iterator[tuple[int, list[str]]]:
    with zipfile.ZipFile(path) as archive:
        shared_strings = read_xlsx_shared_strings(archive)
        root = ET.fromstring(archive.read(sheet_path))

    namespace = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    for index, row in enumerate(root.findall(".//main:sheetData/main:row", namespace)):
        if max_rows is not None and index >= max_rows:
            break
        values = []
        for cell in row.findall("main:c", namespace):
            column_index = xlsx_column_index(cell.attrib.get("r"))
            while len(values) < column_index:
                values.append("")
            values.append(xlsx_cell_value(cell, shared_strings, namespace))
        yield index, values


def xlsx_cell_value(cell: ET.Element, shared_strings: list[str], namespace: Mapping[str, str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        text_parts = [node.text or "" for node in cell.findall(".//main:t", namespace)]
        return "".join(text_parts)

    value_element = cell.find("main:v", namespace)
    if value_element is None:
        return ""

    raw_value = value_element.text or ""
    if cell_type == "s" and raw_value.isdigit():
        index = int(raw_value)
        return shared_strings[index] if index < len(shared_strings) else ""
    return raw_value


def xlsx_column_index(cell_reference: str | None) -> int:
    if not cell_reference:
        return 0
    match = re.match(r"([A-Z]+)", cell_reference)
    if not match:
        return 0
    index = 0
    for character in match.group(1):
        index = index * 26 + (ord(character) - ord("A") + 1)
    return index - 1


def read_xlsx_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    namespace = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    values = []
    for item in root.findall("main:si", namespace):
        text_parts = [node.text or "" for node in item.findall(".//main:t", namespace)]
        values.append("".join(text_parts))
    return values


def inspect_zip(path: Path) -> dict[str, object]:
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        tabular_members = [
            member
            for member in members
            if Path(member.filename).suffix.lower() in {".csv", ".xlsx", ".xls", ".ods"}
        ]
        return {
            "file_count": len(members),
            "sample_members": [
                {"name": member.filename, "bytes": member.file_size}
                for member in members[:25]
            ],
            "tabular_members": [
                {"name": member.filename, "bytes": member.file_size}
                for member in tabular_members[:25]
            ],
            "note": "ZIP inspection lists likely tabular members; extraction/normalization happens only for supported tabular files.",
        }


def write_population_sample(rows: list[dict[str, object]]) -> None:
    sample_rows = rows[:25]
    write_csv(
        SAMPLES_DIR / "ibge_population_2025.sample.csv",
        sample_rows,
        ["id_ibge", "uf", "cod_uf", "cod_municipio", "municipio", "populacao", "ano", "fonte"],
    )


def write_sinesp_samples(sinesp: dict[str, object]) -> None:
    rows = list(sinesp.get("rows", []))
    if rows:
        write_csv(
            SAMPLES_DIR / "sinesp_indicators_normalized.sample.csv",
            rows[:25],
            SINESP_NORMALIZED_FIELDNAMES,
        )
    status = sinesp.get("status")
    if status:
        write_json(SAMPLES_DIR / "sinesp_normalization_status.sample.json", status)


def write_combined_samples(combined: dict[str, object]) -> None:
    rows = list(combined.get("rows", []))
    if rows:
        write_csv(
            SAMPLES_DIR / "sinesp_municipal_indicators_with_population.sample.csv",
            rows[:25],
            SINESP_WITH_POPULATION_FIELDNAMES,
        )
    status = combined.get("status")
    if status:
        write_json(SAMPLES_DIR / "sinesp_population_join_status.sample.json", status)


def write_csv(path: Path, rows: Iterable[dict[str, object]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fieldnames})


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_cached_catalog() -> dict[str, object]:
    for path in (
        PROCESSED_DIR / "official_source_catalog.json",
        SAMPLES_DIR / "official_source_catalog.sample.json",
    ):
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    raise FileNotFoundError("No cached source catalog available. Run discover when official portals are reachable.")


def fetch_json(url: str) -> object:
    return json.loads(fetch_bytes(url, timeout=60).decode("utf-8"))


def download_url_to_path(
    url: str,
    target: Path,
    timeout: int,
    retries: int,
    backoff_seconds: int,
) -> int:
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(f"{target.name}.part")
    attempts = max(1, retries)
    try:
        for attempt in range(1, attempts + 1):
            try:
                subprocess.run(
                    [
                        "curl",
                        "-fsSL",
                        "-A",
                        USER_AGENT,
                        "--connect-timeout",
                        str(min(timeout, 20)),
                        "--max-time",
                        str(timeout),
                        "-C",
                        "-",
                        "-o",
                        str(partial),
                        url,
                    ],
                    check=True,
                    capture_output=True,
                    text=True,
                )
                partial.replace(target)
                return attempt
            except subprocess.CalledProcessError as error:
                if attempt >= attempts:
                    stderr = (error.stderr or "").strip()
                    partial_bytes = partial.stat().st_size if partial.exists() else 0
                    raise RuntimeError(
                        f"failed to download {url}: {stderr or error}; partial_bytes={partial_bytes}"
                    ) from error
                time.sleep(max(0, backoff_seconds))
    except FileNotFoundError:
        payload = fetch_bytes_with_retry(url, timeout=timeout, attempts=attempts, backoff_seconds=backoff_seconds)
        target.write_bytes(payload)
        return attempts
    raise RuntimeError(f"failed to download {url}")


def fetch_bytes_with_retry(url: str, timeout: int, attempts: int, backoff_seconds: int) -> bytes:
    errors = []
    for attempt in range(1, attempts + 1):
        try:
            return fetch_bytes(url, timeout=timeout)
        except Exception as error:  # noqa: BLE001 - retries need to preserve final context.
            errors.append(f"attempt {attempt}: {error}")
            if attempt < attempts:
                time.sleep(max(0, backoff_seconds))
    raise RuntimeError("; ".join(errors))


def discover_latest_ibge_population_ods() -> str:
    html = fetch_bytes(IBGE_POPULATION_DIR_URL, timeout=60).decode("utf-8", errors="ignore")
    candidates = sorted(set(re.findall(r"POP2025_\d{8}\.ods", html)))
    if not candidates:
        raise RuntimeError("No POP2025 ODS file found in IBGE directory")
    return IBGE_POPULATION_DIR_URL + candidates[-1]


def source_id_for_mjsp_resource(name: str) -> str | None:
    normalized = normalize_header(name)
    if "dicionario" in normalized and "municip" in normalized:
        return "sinesp_dictionary_municipios"
    if "dicionario" in normalized and normalized.endswith("_uf"):
        return "sinesp_dictionary_uf"
    if "municip" in normalized and "dados_nacionais" in normalized:
        return "sinesp_municipios"
    if normalized.endswith("_uf") or "dados_nacionais_de_seguranca_publica_uf" in normalized:
        return "sinesp_uf"
    if "base_de_dados_vde" in normalized:
        return "sinesp_vde"
    return None


def suffix_for(format_name: str, url: str) -> str:
    suffix = Path(url.split("?", 1)[0]).suffix
    if suffix:
        return suffix
    normalized = format_name.lower().strip(".")
    return f".{normalized}" if normalized else ".dat"


def trim_trailing_empty(values: list[str]) -> list[str]:
    result = list(values)
    while result and result[-1] == "":
        result.pop()
    return result


def only_digits(value: object) -> str:
    return re.sub(r"\D", "", str(value))


def string_or_none(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def project_relative_path(path: Path) -> str:
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch_bytes(url: str, timeout: int) -> bytes:
    return fetch_url_bytes_with_curl(url, timeout=timeout)


def utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
