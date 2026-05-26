import io
import unittest
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

from etl.official_data import (
    cell_text,
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


if __name__ == "__main__":
    unittest.main()
