"""Minas Gerais connector for SEJUSP crimes-violentos CSV resources."""

from __future__ import annotations

from typing import Iterable, Iterator, Mapping

from .base import (
    CkanConnector,
    CrimeRecord,
    canonical_indicator,
    normalize_city_code,
    normalize_row_keys,
    parse_int,
    parse_month,
    parse_year,
)


MG_INDICATOR_NAMES = {
    "estupro_consumado": "estupro",
    "estupro_tentado": "estupro_tentado",
    "estupro_de_vulneravel_consumado": "estupro_vulneravel",
    "estupro_de_vulneravel_tentado": "estupro_vulneravel_tentado",
    "homicidio_consumado": "homicidio_doloso",
    "homicidio_tentado": "homicidio_tentado",
    "roubo_consumado": "roubo",
    "roubo_tentado": "roubo_tentado",
    "extorsao_consumado": "extorsao",
    "extorsao_tentado": "extorsao_tentado",
    "extorsao_mediante_sequestro_consumado": "extorsao_mediante_sequestro",
    "sequestro_e_carcere_privado_consumado": "sequestro_carcere_privado",
    "sequestro_e_carcere_privado_tentado": "sequestro_carcere_privado_tentado",
}


class MinasGeraisSegurancaConnector(CkanConnector):
    state = "MG"
    source_id = "mg_seguranca_crimes_violentos"
    source_name = "SEJUSP-MG - Crimes Violentos"
    package_api_url = "https://dados.mg.gov.br/api/3/action/package_show?id=crimes-violentos"

    def normalize_rows(self, rows: Iterable[Mapping[str, str]]) -> Iterator[CrimeRecord]:
        for raw_row in rows:
            row = normalize_row_keys(raw_row)
            raw_indicator = row.get("natureza", "")
            indicator_code = canonical_indicator(raw_indicator, MG_INDICATOR_NAMES)
            if not indicator_code:
                continue

            yield CrimeRecord(
                source_id=self.source_id,
                uf=self.state,
                year=parse_year(row.get("ano")),
                month=parse_month(row.get("mes")),
                indicator_code=indicator_code,
                value=parse_int(row.get("registros")),
                municipality=row.get("municipio") or None,
                municipality_code=normalize_city_code(row.get("cod_municipio")),
                raw_indicator=raw_indicator,
            )

