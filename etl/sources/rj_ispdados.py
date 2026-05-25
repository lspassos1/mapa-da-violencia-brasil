"""Rio de Janeiro connector for ISPdados municipal monthly statistics."""

from __future__ import annotations

from typing import Iterable, Iterator, Mapping

from .base import (
    CrimeRecord,
    SourceResource,
    normalize_row_keys,
    parse_int,
    parse_month,
    parse_year,
)


RJ_INDICATOR_COLUMNS = {
    "hom_doloso": "homicidio_doloso",
    "feminicidio": "feminicidio",
    "latrocinio": "latrocinio",
    "lesao_corp_morte": "lesao_corporal_seguida_de_morte",
    "estupro": "estupro",
    "roubo_veiculo": "roubo_veiculos",
    "roubo_carga": "roubo_carga",
    "furto_veiculos": "furto_veiculos",
    "trafico_drogas": "trafico_drogas",
    "pessoas_desaparecidas": "pessoa_desaparecida",
}


class RioDeJaneiroISPConnector:
    state = "RJ"
    source_id = "rj_ispdados_base_municipio_mensal"
    source_name = "ISPdados - Base Municipio Mensal"
    csv_url = "https://www.ispdados.rj.gov.br/Arquivos/BaseMunicipioMensal.csv"

    def discover(self) -> list[SourceResource]:
        return [
            SourceResource(
                state=self.state,
                source_id=self.source_id,
                title="BaseMunicipioMensal.csv",
                url=self.csv_url,
                format="CSV",
                license=None,
                notes="Base municipal mensal publicada pelo ISPdados/RJ.",
                direct_download=True,
            )
        ]

    def normalize_rows(self, rows: Iterable[Mapping[str, str]]) -> Iterator[CrimeRecord]:
        for raw_row in rows:
            row = normalize_row_keys(raw_row)
            year = parse_year(row.get("ano"))
            month = parse_month(row.get("mes"))
            municipality = row.get("fmun") or None
            municipality_code = row.get("fmun_cod") or None

            for column, indicator_code in RJ_INDICATOR_COLUMNS.items():
                if column not in row:
                    continue
                value = parse_int(row.get(column))
                yield CrimeRecord(
                    source_id=self.source_id,
                    uf=self.state,
                    year=year,
                    month=month,
                    indicator_code=indicator_code,
                    value=value,
                    municipality=municipality,
                    municipality_code=municipality_code,
                    raw_indicator=column,
                )

