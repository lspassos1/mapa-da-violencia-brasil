"""Shared primitives for state-level public security connectors.

The connectors intentionally stop at a normalized in-memory record format.
Database loading, deduplication, and source precedence belong to later ETL
stages so each state adapter stays small and auditable.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import subprocess
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, Mapping, Sequence


USER_AGENT = "MapaViolenciaBrasil/0.1 (+https://github.com/lspassos1/mapa-da-violencia-brasil)"


@dataclass(frozen=True)
class SourceResource:
    """A downloadable or inspectable source resource."""

    state: str
    source_id: str
    title: str
    url: str
    format: str
    license: str | None = None
    last_modified: str | None = None
    size: int | None = None
    notes: str | None = None
    direct_download: bool = True


@dataclass(frozen=True)
class CrimeRecord:
    """Canonical crime record before database loading."""

    source_id: str
    uf: str
    year: int
    month: int
    indicator_code: str
    value: int
    municipality: str | None = None
    municipality_code: str | None = None
    victims: int | None = None
    raw_indicator: str | None = None


class ConnectorError(RuntimeError):
    """Raised when a source cannot be fetched or parsed safely."""


class BaseStateConnector:
    """Base class for official state source connectors."""

    state: str
    source_id: str
    source_name: str

    def discover(self) -> list[SourceResource]:
        raise NotImplementedError

    def normalize_rows(self, rows: Iterable[Mapping[str, str]]) -> Iterator[CrimeRecord]:
        raise NotImplementedError

    def download(self, resource: SourceResource, destination_dir: str | Path) -> Path:
        if not resource.direct_download:
            raise ConnectorError(f"{resource.title} is not a direct download resource")

        destination = Path(destination_dir)
        destination.mkdir(parents=True, exist_ok=True)
        suffix = guess_suffix(resource.url, resource.format)
        file_name = f"{resource.source_id}-{sha256_text(resource.url)[:12]}{suffix}"
        target = destination / file_name
        target.write_bytes(fetch_url_bytes(resource.url, timeout=60))

        return target


class CkanConnector(BaseStateConnector):
    """Small CKAN package adapter used by BA, MG, and SP."""

    package_api_url: str
    direct_formats: Sequence[str] = ("csv", "xlsx", "xls", "zip", "json")

    def fetch_package(self) -> Mapping[str, object]:
        payload = json.loads(fetch_url_bytes(self.package_api_url, timeout=30).decode("utf-8"))

        if not payload.get("success"):
            raise ConnectorError(f"CKAN package request failed for {self.package_api_url}")

        result = payload.get("result")
        if not isinstance(result, Mapping):
            raise ConnectorError("CKAN package response does not contain a result object")

        return result

    def discover(self) -> list[SourceResource]:
        package = self.fetch_package()
        license_title = string_or_none(package.get("license_title"))
        resources = package.get("resources", [])
        if not isinstance(resources, list):
            raise ConnectorError("CKAN package resources field is not a list")

        discovered: list[SourceResource] = []
        for item in resources:
            if not isinstance(item, Mapping):
                continue
            url = string_or_none(item.get("url"))
            if not url:
                continue

            declared_format = string_or_none(item.get("format")) or guess_format(url)
            is_direct = declared_format.lower() in self.direct_formats
            discovered.append(
                SourceResource(
                    state=self.state,
                    source_id=self.source_id,
                    title=string_or_none(item.get("name")) or string_or_none(package.get("title")) or self.source_name,
                    url=url,
                    format=declared_format.upper() if declared_format else "",
                    license=license_title,
                    last_modified=string_or_none(item.get("last_modified"))
                    or string_or_none(item.get("metadata_modified")),
                    size=int(item["size"]) if isinstance(item.get("size"), int) else None,
                    notes=string_or_none(item.get("description")) or string_or_none(package.get("notes")),
                    direct_download=is_direct,
                )
            )

        return discovered


def parse_csv_text(text: str, delimiter: str = ",") -> list[dict[str, str]]:
    return list(csv.DictReader(text.splitlines(), delimiter=delimiter))


def fetch_url_bytes(url: str, timeout: int = 30) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"Accept": "*/*", "User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read()
    except urllib.error.URLError as error:
        if "CERTIFICATE_VERIFY_FAILED" not in str(error):
            raise
        return fetch_url_bytes_with_curl(url, timeout=timeout)


def fetch_url_bytes_with_curl(url: str, timeout: int = 30) -> bytes:
    try:
        completed = subprocess.run(
            [
                "curl",
                "-fsSL",
                "-A",
                USER_AGENT,
                "--connect-timeout",
                str(min(timeout, 20)),
                "--max-time",
                str(timeout),
                url,
            ],
            check=True,
            capture_output=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as error:
        raise ConnectorError(f"failed to fetch {url}") from error
    return completed.stdout


def normalize_header(value: str) -> str:
    text = strip_accents(value).lower().strip()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def normalize_row_keys(row: Mapping[str, str]) -> dict[str, str]:
    return {normalize_header(key): value for key, value in row.items()}


def normalize_city_code(value: object) -> str | None:
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    if not digits:
        return None
    return digits


def parse_int(value: object) -> int:
    if value is None:
        return 0
    text = str(value).strip()
    if not text:
        return 0
    text = text.replace(".", "").replace(",", ".")
    return int(float(text))


def parse_year(value: object) -> int:
    year = parse_int(value)
    if year < 2000 or year > 2100:
        raise ConnectorError(f"invalid year: {value!r}")
    return year


def parse_month(value: object) -> int:
    month = parse_int(value)
    if month < 1 or month > 12:
        raise ConnectorError(f"invalid month: {value!r}")
    return month


def strip_accents(value: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(char)
    )


def canonical_indicator(value: str, mapping: Mapping[str, str]) -> str | None:
    key = normalize_header(value)
    return mapping.get(key)


def string_or_none(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def guess_format(url: str) -> str:
    suffix = Path(url.split("?", 1)[0]).suffix.lower().lstrip(".")
    return suffix


def guess_suffix(url: str, declared_format: str) -> str:
    suffix = Path(url.split("?", 1)[0]).suffix
    if suffix:
        return suffix
    clean_format = declared_format.lower().strip(".")
    return f".{clean_format}" if clean_format else ".dat"


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
