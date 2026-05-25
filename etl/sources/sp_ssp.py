"""Sao Paulo connector for SSP-SP open data catalogue discovery."""

from __future__ import annotations

from typing import Iterable, Iterator, Mapping

from .base import CkanConnector, ConnectorError, CrimeRecord


class SaoPauloSSPConnector(CkanConnector):
    state = "SP"
    source_id = "sp_ssp_numeros_sem_misterio"
    source_name = "SSP-SP - Numeros sem Misterio"
    package_api_url = "https://dadosabertos.sp.gov.br/api/3/action/package_show?id=numeros-sem-misterio"

    def normalize_rows(self, rows: Iterable[Mapping[str, str]]) -> Iterator[CrimeRecord]:
        raise ConnectorError(
            "SSP-SP exposes this catalogue as portal pages/consultas; "
            "direct CSV/XLSX resource normalization must be implemented after "
            "selecting the specific download endpoint."
        )

