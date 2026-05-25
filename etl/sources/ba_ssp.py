"""Bahia connector for SSP-BA intentional violent deaths dataset."""

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


BA_INDICATOR_NAMES = {
    "homicidio_doloso": "homicidio_doloso",
    "feminicidio": "feminicidio",
    "roubo_com_resultado_morte_latrocinio": "latrocinio",
    "latrocinio": "latrocinio",
    "lesao_corporal_seguida_de_morte": "lesao_corporal_seguida_de_morte",
    "homicidio_ocorrido_em_presidio": "homicidio_presidio",
    "homicidio_doloso_com_indicio_de_excludente_de_ilicitude": "homicidio_excludente_ilicitude",
    "homicidio_doloso_no_transito": "homicidio_doloso_transito",
}


class BahiaSSPConnector(CkanConnector):
    state = "BA"
    source_id = "ba_ssp_mortes_violentas_estado"
    source_name = "SSP-BA - Morte Violenta Intencional no Estado"
    package_api_url = "https://dados.ba.gov.br/api/3/action/package_show?id=morte_violenta_estado"

    def normalize_rows(self, rows: Iterable[Mapping[str, str]]) -> Iterator[CrimeRecord]:
        for raw_row in rows:
            row = normalize_row_keys(raw_row)
            raw_indicator = row.get("gr_natureza", "")
            indicator_code = canonical_indicator(raw_indicator, BA_INDICATOR_NAMES)
            if not indicator_code:
                continue

            victims = parse_int(row.get("qt_vitimas"))
            yield CrimeRecord(
                source_id=self.source_id,
                uf=self.state,
                year=parse_year(row.get("ano")),
                month=parse_month(row.get("mes")),
                indicator_code=indicator_code,
                value=victims,
                municipality=row.get("municipio") or None,
                municipality_code=normalize_city_code(row.get("id_municipio")),
                victims=victims,
                raw_indicator=raw_indicator,
            )

