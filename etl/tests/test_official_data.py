import unittest
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

from etl.official_data import (
    canonical_indicator_code,
    detect_tabular_header,
    normalize_sinesp_table_rows,
    parse_optional_month_year,
    parse_ibge_population_ods,
    validate_municipality_keys,
)


ODS_CONTENT = """<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body>
    <office:spreadsheet>
      <table:table table:name="Tabela1">
        <table:table-row table:number-rows-repeated="3"/>
        <table:table-row>
          <table:table-cell><text:p>UF</text:p></table:table-cell>
          <table:table-cell><text:p>COD. UF</text:p></table:table-cell>
          <table:table-cell><text:p>COD. MUNIC</text:p></table:table-cell>
          <table:table-cell><text:p>NOME DO MUNICÍPIO</text:p></table:table-cell>
          <table:table-cell><text:p>POPULAÇÃO ESTIMADA</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell><text:p>SP</text:p></table:table-cell>
          <table:table-cell><text:p>35</text:p></table:table-cell>
          <table:table-cell><text:p>50308</text:p></table:table-cell>
          <table:table-cell><text:p>São Paulo</text:p></table:table-cell>
          <table:table-cell><text:p>11.895.578</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:spreadsheet>
  </office:body>
</office:document-content>
"""


class OfficialDataTests(unittest.TestCase):
    def test_parse_ibge_population_ods_builds_seven_digit_code(self):
        with TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "population.ods"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("content.xml", ODS_CONTENT)

            rows = parse_ibge_population_ods(path)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id_ibge"], "3550308")
        self.assertEqual(rows[0]["populacao"], 11895578)

    def test_validate_municipality_keys_reports_complete_match(self):
        population = [{"id_ibge": "3550308"}]
        registry = [{"id_ibge": "3550308", "municipio": "São Paulo", "uf": "SP"}]

        validation = validate_municipality_keys(population, registry)

        self.assertTrue(validation["summary"]["is_complete_match"])
        self.assertEqual(validation["summary"]["matched_ids"], 1)

    def test_detect_tabular_header_finds_sinesp_schema(self):
        rows = [
            (0, ["Relatorio demonstrativo"]),
            (1, ["UF", "Codigo IBGE", "Municipio", "Ano", "Mes", "Indicador", "Ocorrencias"]),
        ]

        header = detect_tabular_header(rows)

        self.assertIsNotNone(header)
        self.assertEqual(header["row_index"], 1)

    def test_normalize_sinesp_table_rows_builds_canonical_record(self):
        with TemporaryDirectory() as tmpdir:
            source_file = Path(tmpdir) / "sinesp_municipios.xlsx"
            source_file.write_text("placeholder", encoding="utf-8")
            rows = [
                (0, ["UF", "Codigo IBGE", "Municipio", "Ano", "Mes", "Indicador", "Ocorrencias", "Vitimas"]),
                (1, ["SP", "3550308", "Sao Paulo", "2025", "Janeiro", "Homicidio doloso", "12", "12"]),
            ]

            normalized = normalize_sinesp_table_rows(
                rows,
                source_id="sinesp_municipios",
                source_file=source_file,
            )

        self.assertEqual(len(normalized), 1)
        self.assertEqual(normalized[0]["id_ibge"], "3550308")
        self.assertEqual(normalized[0]["mes"], 1)
        self.assertEqual(normalized[0]["indicador_codigo"], "homicidio_doloso")
        self.assertEqual(normalized[0]["valor"], 12)
        self.assertEqual(normalized[0]["unidade_medida"], "ocorrencias")
        self.assertEqual(normalized[0]["ocorrencias"], 12)

    def test_canonical_indicator_code_maps_known_labels(self):
        self.assertEqual(canonical_indicator_code("Roubo de veículos"), "roubo_veiculos")

    def test_normalize_sinesp_rows_accepts_municipal_xlsx_victims_schema(self):
        with TemporaryDirectory() as tmpdir:
            source_file = Path(tmpdir) / "sinesp_municipios.xlsx"
            source_file.write_text("placeholder", encoding="utf-8")
            rows = [
                (0, ["Cód_IBGE", "Município", "Sigla UF", "Região", "Mês/Ano", "Vítimas"]),
                (1, ["1200401", "Rio Branco", "AC", "NORTE", "43101", "31"]),
            ]

            normalized = normalize_sinesp_table_rows(
                rows,
                source_id="sinesp_municipios",
                source_file=source_file,
            )

        self.assertEqual(len(normalized), 1)
        self.assertEqual(normalized[0]["ano"], 2018)
        self.assertEqual(normalized[0]["mes"], 1)
        self.assertEqual(normalized[0]["valor"], 31)
        self.assertEqual(normalized[0]["unidade_medida"], "vitimas")
        self.assertEqual(normalized[0]["indicador_codigo"], "homicidio_doloso")

    def test_parse_optional_month_year_supports_excel_serial(self):
        self.assertEqual(parse_optional_month_year("43101"), (2018, 1))


if __name__ == "__main__":
    unittest.main()
