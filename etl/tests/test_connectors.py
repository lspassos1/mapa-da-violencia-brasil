import unittest

from etl.sources.ba_ssp import BahiaSSPConnector
from etl.sources.mg_seguranca import MinasGeraisSegurancaConnector
from etl.sources.rj_ispdados import RioDeJaneiroISPConnector
from etl.sources.sp_ssp import SaoPauloSSPConnector
from etl.sources.base import ConnectorError, normalize_city_code, parse_csv_text


class ConnectorNormalizationTests(unittest.TestCase):
    def test_rj_wide_row_becomes_canonical_records(self):
        rows = parse_csv_text(
            '"fmun_cod";"fmun";"ano";"mes";"hom_doloso";"roubo_veiculo";"furto_veiculos"\n'
            '3300100;"Angra dos Reis";2014;1;11;8;23',
            delimiter=";",
        )

        records = list(RioDeJaneiroISPConnector().normalize_rows(rows))

        by_indicator = {record.indicator_code: record for record in records}
        self.assertEqual(by_indicator["homicidio_doloso"].value, 11)
        self.assertEqual(by_indicator["roubo_veiculos"].value, 8)
        self.assertEqual(by_indicator["furto_veiculos"].municipality_code, "3300100")

    def test_mg_long_row_maps_natureza(self):
        rows = parse_csv_text(
            "registros;natureza;municipio;cod_municipio;mes;ano;risp;rmbh\n"
            "2;HOMICÍDIO CONSUMADO;ABADIA DOS DOURADOS;310010;1;2026;RISP 10;NÃO",
            delimiter=";",
        )

        records = list(MinasGeraisSegurancaConnector().normalize_rows(rows))

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].indicator_code, "homicidio_doloso")
        self.assertEqual(records[0].municipality_code, "310010")
        self.assertEqual(records[0].value, 2)

    def test_ba_long_row_uses_victims_as_value(self):
        rows = parse_csv_text(
            "ANO_1,ID_REGIAO,REGIAO,ID_MUNICIPIO,MUNICIPIO,ANO,MES,GR_NATUREZA,QT_VITIMAS\n"
            "2024,3,Interior,290030,Acajutiba,2024,1,HOMICIDIO DOLOSO,2",
        )

        records = list(BahiaSSPConnector().normalize_rows(rows))

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].indicator_code, "homicidio_doloso")
        self.assertEqual(records[0].municipality_code, "290030")
        self.assertEqual(records[0].victims, 2)

    def test_sp_normalization_is_blocked_until_download_endpoint_is_selected(self):
        with self.assertRaises(ConnectorError):
            list(SaoPauloSSPConnector().normalize_rows([]))

    def test_city_code_padding(self):
        self.assertEqual(normalize_city_code("3300100"), "3300100")
        self.assertEqual(normalize_city_code("310010"), "310010")


if __name__ == "__main__":
    unittest.main()
