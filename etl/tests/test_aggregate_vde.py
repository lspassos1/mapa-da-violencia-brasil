import unittest

from etl.aggregate_vde import (
    APP_KEY_TO_CODE,
    build_uf_data_from_items,
    column_letter_index,
    name_key,
    strip_accents_upper,
)
from etl.official_data import APP_INDICATOR_KEYS


class AggregateVdeTests(unittest.TestCase):
    def test_strip_accents_upper_normaliza(self):
        self.assertEqual(strip_accents_upper("São Paulo"), "SAO PAULO")
        self.assertEqual(strip_accents_upper("  ACRELÂNDIA "), "ACRELANDIA")
        self.assertEqual(strip_accents_upper("Olho d'Água  do  Borges"), "OLHO D'AGUA DO BORGES")

    def test_name_key_combina_uf_e_municipio_normalizados(self):
        self.assertEqual(name_key("sp", "São Paulo"), "SP|SAO PAULO")

    def test_column_letter_index(self):
        self.assertEqual(column_letter_index("A1"), 0)
        self.assertEqual(column_letter_index("B2"), 1)
        self.assertEqual(column_letter_index("L10"), 11)
        self.assertEqual(column_letter_index("AA1"), 26)

    def test_app_key_to_code_inverte_o_mapeamento(self):
        # Cada app key conhecido tem de ser invertivel para o seu codigo canonico.
        for code, app_key in APP_INDICATOR_KEYS.items():
            self.assertEqual(APP_KEY_TO_CODE[app_key], code)

    def _item(self, uf, periodo, total, unidade="vitimas"):
        return {
            "idIbge": f"{uf}-{total}",
            "uf": uf,
            "periodo": periodo,
            "indicadores": {
                "homicidioDoloso": {"total": total, "unidade": unidade},
            },
        }

    def test_build_uf_data_from_items_agrega_municipios_por_uf(self):
        # Dois municipios de SP somam; AC fica com o seu proprio total.
        items = [
            self._item("SP", "2015", 100),
            self._item("SP", "2015", 50),
            self._item("AC", "2015", 5),
        ]
        records = build_uf_data_from_items(items)
        by_uf = {r["uf"]: r for r in records if r["indicador"] == "homicidioDoloso"}
        self.assertEqual(by_uf["SP"]["total"], 150)
        self.assertEqual(by_uf["AC"]["total"], 5)
        # Score por quantil: SP (maior) acima de AC; ambos em 0-100.
        self.assertGreater(by_uf["SP"]["score"], by_uf["AC"]["score"])
        # Taxa por 100 mil com a populacao UF do ano (CSV de referencia versionado).
        self.assertIsInstance(by_uf["SP"]["taxa100k"], float)
        self.assertEqual(by_uf["SP"]["unidade"], "vitimas")
        self.assertEqual(by_uf["SP"]["periodo"], "2015")

    def test_build_uf_data_from_items_separa_periodos(self):
        # O mesmo estado em anos diferentes gera registos independentes.
        items = [self._item("SP", "2015", 10), self._item("SP", "2016", 20)]
        records = build_uf_data_from_items(items)
        totals = {r["periodo"]: r["total"] for r in records}
        self.assertEqual(totals, {"2015": 10, "2016": 20})


if __name__ == "__main__":
    unittest.main()
