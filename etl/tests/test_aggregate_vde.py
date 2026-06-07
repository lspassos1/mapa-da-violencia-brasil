import unittest

from etl.aggregate_vde import (
    APP_KEY_TO_CODE,
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


if __name__ == "__main__":
    unittest.main()
