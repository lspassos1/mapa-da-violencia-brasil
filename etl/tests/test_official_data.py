import unittest
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from etl import official_data
from etl.official_data import (
    canonical_indicator_code,
    combine_sinesp_with_population,
    detect_tabular_header,
    generate_app_ready_dataset,
    load_app_ready_centroids,
    normalize_sinesp_table_rows,
    parse_optional_month_year,
    parse_ibge_population_ods,
    validate_municipality_keys,
)


def _sinesp_row(year: int, value: int = 10) -> dict:
    return {
        "source_id": "sinesp_municipios",
        "id_ibge": "3550308",
        "uf": "SP",
        "municipio": "Sao Paulo",
        "ano": year,
        "mes": 3,
        "indicador_codigo": "homicidio_doloso",
        "indicador_nome": "Homicidio doloso",
        "valor": value,
        "unidade_medida": "vitimas",
        "vitimas": value,
        "fonte": "MJSP/SINESP",
    }


def _population_row(year: int, populacao: int = 1000000) -> dict:
    return {
        "id_ibge": "3550308",
        "uf": "SP",
        "municipio": "Sao Paulo",
        "populacao": populacao,
        "ano": year,
        "fonte": "IBGE Estimativas de Populacao",
    }


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

    def test_generate_app_ready_dataset_distinguishes_zero_registered(self):
        with TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            csv_path = root / "combined.csv"
            output_path = root / "crime-map.json"
            csv_path.write_text(
                "source_id,id_ibge,uf,municipio,ano,mes,indicador_codigo,indicador_nome,"
                "valor,unidade_medida,vitimas,populacao,taxa_100k,fonte,fonte_populacao,limitacoes\n"
                "sinesp_municipios,1200401,AC,Rio Branco,2018,3,homicidio_doloso,"
                "Homicídio doloso,0,vitimas,0,389001,0,MJSP/SINESP,IBGE,teste\n",
                encoding="utf-8",
            )

            result = generate_app_ready_dataset(input_path=csv_path, output_path=output_path)

        self.assertEqual(result["summary"]["app_rows"], 1)
        item = result["payload"]["items"][0]
        metric = item["indicadores"]["homicidioDoloso"]
        self.assertEqual(metric["dataStatus"], "zero_registrado")
        self.assertEqual(metric["total"], 0)
        self.assertIsNone(metric["variacaoMensal"])
        self.assertIsNone(metric["variacaoAnual"])

    def test_generate_app_ready_dataset_marks_relative_sample_inputs(self):
        with TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "crime-map.json"
            result = generate_app_ready_dataset(
                input_path=Path("etl/samples/sinesp_municipal_indicators_with_population.sample.csv"),
                output_path=output_path,
            )

        self.assertTrue(result["summary"]["is_sample"])
        self.assertEqual(result["payload"]["status"]["mode"], "official_sample")
        metric = result["payload"]["items"][0]["indicadores"]["homicidioDoloso"]
        self.assertIn(metric["dataStatus"], {"amostra_oficial", "zero_registrado"})
        self.assertIsNone(metric["variacaoMensal"])
        self.assertIsNone(metric["variacaoAnual"])

    def test_generate_app_ready_dataset_skips_rows_without_centroid(self):
        with TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            csv_path = root / "combined.csv"
            output_path = root / "crime-map.json"
            csv_path.write_text(
                "source_id,id_ibge,uf,municipio,ano,mes,indicador_codigo,indicador_nome,"
                "valor,unidade_medida,vitimas,populacao,taxa_100k,fonte,fonte_populacao,limitacoes\n"
                "sinesp_municipios,9999999,ZZ,Sem Centroide,2018,3,homicidio_doloso,"
                "Homicídio doloso,1,vitimas,1,1000,100,MJSP/SINESP,IBGE,teste\n",
                encoding="utf-8",
            )

            result = generate_app_ready_dataset(input_path=csv_path, output_path=output_path)

        self.assertEqual(result["summary"]["app_rows"], 0)
        self.assertEqual(result["summary"]["skipped_without_centroid"], 1)

    def test_combine_suppresses_taxa_when_years_differ(self):
        with TemporaryDirectory() as tmpdir:
            with mock.patch.object(official_data, "PROCESSED_DIR", Path(tmpdir)):
                result = combine_sinesp_with_population(
                    [_sinesp_row(2018, value=10)],
                    [_population_row(2025)],
                )

        row = result["rows"][0]
        self.assertEqual(row["taxa_100k"], "")
        self.assertEqual(row["taxa_status"], "populacao_indisponivel")
        self.assertIn("suprimida", row["limitacoes"])
        self.assertEqual(result["status"]["summary"]["rows_taxa_suppressed_cross_year"], 1)
        self.assertFalse(result["status"]["summary"]["can_calculate_taxa_100k"])

    def test_combine_keeps_taxa_when_years_match(self):
        with TemporaryDirectory() as tmpdir:
            with mock.patch.object(official_data, "PROCESSED_DIR", Path(tmpdir)):
                result = combine_sinesp_with_population(
                    [_sinesp_row(2025, value=10)],
                    [_population_row(2025, populacao=1000000)],
                )

        row = result["rows"][0]
        self.assertEqual(row["taxa_status"], "disponivel")
        self.assertEqual(row["taxa_100k"], 1.0)  # 10 / 1_000_000 * 100_000
        self.assertEqual(result["status"]["summary"]["rows_taxa_suppressed_cross_year"], 0)
        self.assertTrue(result["status"]["summary"]["can_calculate_taxa_100k"])

    def test_municipal_centroids_reference_is_national_and_valid(self):
        centroids = load_app_ready_centroids(None)
        # Cobertura nacional (todos os municipios da malha IBGE).
        self.assertGreaterEqual(len(centroids), 5500)
        for id_ibge, (lat, lng) in centroids.items():
            self.assertTrue(id_ibge.isdigit() and len(id_ibge) == 7, f"id invalido: {id_ibge}")
            self.assertTrue(-34.0 <= lat <= 6.0, f"{id_ibge} lat fora do Brasil: {lat}")
            self.assertTrue(-74.5 <= lng <= -32.0, f"{id_ibge} lng fora do Brasil: {lng}")

    def test_combine_marks_missing_population(self):
        with TemporaryDirectory() as tmpdir:
            with mock.patch.object(official_data, "PROCESSED_DIR", Path(tmpdir)):
                result = combine_sinesp_with_population(
                    [_sinesp_row(2025, value=10)],
                    [_population_row(2025, populacao=0)],
                )

        row = result["rows"][0]
        self.assertEqual(row["taxa_100k"], "")
        self.assertEqual(row["taxa_status"], "sem_populacao")


if __name__ == "__main__":
    unittest.main()
