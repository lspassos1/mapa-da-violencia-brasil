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
import zipfile
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable, Iterator
from xml.etree import ElementTree as ET

from etl.sources.base import fetch_url_bytes_with_curl, normalize_header


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
SAMPLES_DIR = PROJECT_ROOT / "etl" / "samples"

MJSP_PACKAGE_API_URL = (
    "https://dados.mj.gov.br/api/3/action/package_show"
    "?id=sistema-nacional-de-estatisticas-de-seguranca-publica"
)
IBGE_POPULATION_DIR_URL = "https://ftp.ibge.gov.br/Estimativas_de_Populacao/Estimativas_2025/"
IBGE_MUNICIPALITIES_API_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"

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
        choices=["ibge_population", "sinesp_municipios", "sinesp_uf", "sinesp_vde"],
        default=[],
        help="Source to download. May be repeated. Defaults to ibge_population.",
    )
    download_parser.add_argument("--timeout", type=int, default=120, help="Download timeout in seconds")

    inspect_parser = subparsers.add_parser("inspect", help="Inspect local raw resources")
    inspect_parser.add_argument("--write-samples", action="store_true")

    normalize_parser = subparsers.add_parser("normalize", help="Normalize local official data")
    normalize_parser.add_argument("--write-samples", action="store_true")

    args = parser.parse_args()
    ensure_dirs()

    if args.command == "discover":
        catalog = discover_catalog()
        write_json(PROCESSED_DIR / "official_source_catalog.json", catalog)
        if args.write_samples:
            write_json(SAMPLES_DIR / "official_source_catalog.sample.json", catalog)
        print(json.dumps(catalog["summary"], ensure_ascii=False, indent=2))
        return 0

    if args.command == "download":
        sources = args.source or ["ibge_population"]
        manifest = download_sources(sources, timeout=args.timeout)
        write_json(PROCESSED_DIR / "download_manifest.json", manifest)
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
        print(json.dumps(result["validation"]["summary"], ensure_ascii=False, indent=2))
        return 0

    parser.error("unknown command")
    return 2


def ensure_dirs() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)


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


def download_sources(source_ids: list[str], timeout: int = 120) -> dict[str, object]:
    discovery_warning = None
    try:
        catalog = discover_catalog()
    except Exception as error:  # noqa: BLE001 - fallback keeps downloads auditable offline.
        catalog = load_cached_catalog()
        discovery_warning = str(error)
    resources = {item["source_id"]: item for item in catalog["resources"]}
    downloads = []
    for source_id in source_ids:
        resource = resources[source_id]
        suffix = suffix_for(resource["format"], resource["url"])
        target = RAW_DIR / f"{source_id}{suffix}"
        started_at = utc_now()
        try:
            payload = fetch_bytes(resource["url"], timeout=timeout)
            target.write_bytes(payload)
            downloads.append(
                {
                    "source_id": source_id,
                    "status": "downloaded",
                    "url": resource["url"],
                    "path": str(target.relative_to(PROJECT_ROOT)),
                    "bytes": len(payload),
                    "sha256": sha256_bytes(payload),
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
        },
        "downloads": downloads,
    }


def inspect_raw_sources() -> dict[str, object]:
    files = []
    for path in sorted(RAW_DIR.glob("*")):
        if not path.is_file():
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
        },
        "limitations": [
            "Dataset processado ainda nao alimenta o MVP visual.",
            "SINESP/MJSP ainda precisa de download bruto local e validacao de schema antes de normalizacao criminal.",
            "Populacao 2025 e usada apenas para preparar taxa por 100 mil em etapa futura.",
        ],
    }
    write_json(PROCESSED_DIR / "normalization_metadata.json", metadata)

    return {
        "population_rows": population_rows,
        "municipalities": municipalities,
        "validation": validation,
        "metadata": metadata,
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
    rows = list(read_xlsx_rows(path, max_rows=20))
    return {
        "sample_rows": [{"row_index": index, "values": row[:12]} for index, row in rows],
        "note": "XLSX inspection is limited to first worksheet and first rows.",
    }


def read_xlsx_rows(path: Path, max_rows: int | None = None) -> Iterator[tuple[int, list[str]]]:
    with zipfile.ZipFile(path) as archive:
        shared_strings = read_xlsx_shared_strings(archive)
        sheet_name = "xl/worksheets/sheet1.xml"
        root = ET.fromstring(archive.read(sheet_name))

    namespace = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    for index, row in enumerate(root.findall(".//main:sheetData/main:row", namespace)):
        if max_rows is not None and index >= max_rows:
            break
        values = []
        for cell in row.findall("main:c", namespace):
            cell_type = cell.attrib.get("t")
            value_element = cell.find("main:v", namespace)
            if value_element is None:
                values.append("")
                continue
            raw_value = value_element.text or ""
            if cell_type == "s":
                values.append(shared_strings[int(raw_value)])
            else:
                values.append(raw_value)
        yield index, values


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
        return {
            "file_count": len(members),
            "sample_members": [
                {"name": member.filename, "bytes": member.file_size}
                for member in members[:25]
            ],
        }


def write_population_sample(rows: list[dict[str, object]]) -> None:
    sample_rows = rows[:25]
    write_csv(
        SAMPLES_DIR / "ibge_population_2025.sample.csv",
        sample_rows,
        ["id_ibge", "uf", "cod_uf", "cod_municipio", "municipio", "populacao", "ano", "fonte"],
    )


def write_csv(path: Path, rows: Iterable[dict[str, object]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
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


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def fetch_bytes(url: str, timeout: int) -> bytes:
    return fetch_url_bytes_with_curl(url, timeout=timeout)


def utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
