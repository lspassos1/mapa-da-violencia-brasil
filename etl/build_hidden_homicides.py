"""Gera src/data/hiddenHomicides.json — base da LENTE 3 do radar (#85): homicídios
potencialmente OCULTOS, contando óbitos por causa básica no SIM/DATASUS.

Assinatura de ouro (literatura): manipulação/subnotificação aparece como homicídio
(CID X85–Y09) caindo ENQUANTO morte por intenção indeterminada (Y10–Y34, "MVCI")
sobe. ~43,6% das MVCI no Brasil eram de fato homicídios (SciELO 2025).

⚠️ PESADO: baixa os DBC do SIM por UF/ano do FTP do DATASUS (~250 MB/ano × 28 UFs).
Rode num job dedicado / máquina local, NÃO no CI. Requer:
    python3 -m pip install datasus-dbc dbfread
    python3 etl/build_hidden_homicides.py --anos 2015-2024
Verificado: Acre 2022 -> 238 homicídios, 5 MVCI (razão 2,1%).

Saída: { "AC": { "2022": {"homicidios": 238, "mvci": 5, "total": 4159, "razaoMvci": 0.021}, ... }, ... }
"""
from __future__ import annotations

import argparse
import json
import os
import tempfile
import urllib.request

UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
       "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]
FTP = "ftp://ftp.datasus.gov.br/dissemin/publicos/SIM/CID10/DORES/DO{uf}{ano}.dbc"
# Path absoluto a partir da raiz do repo (etl/ -> ..), não depende do CWD.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "data", "hiddenHomicides.json")


def classifica(causabas: str) -> str | None:
    c = (causabas or "").strip().upper()
    if len(c) < 3 or not c[1:3].isdigit():
        return None
    g, n = c[0], int(c[1:3])
    if (g == "X" and 85 <= n <= 99) or (g == "Y" and 0 <= n <= 9):
        return "homicidios"  # agressões (homicídio)
    if g == "Y" and 10 <= n <= 34:
        return "mvci"        # evento de intenção indeterminada
    return None


def conta_uf_ano(uf: str, ano: int, cache: str) -> dict | None:
    import datasus_dbc
    from dbfread import DBF

    dbc = os.path.join(cache, f"DO{uf}{ano}.dbc")
    if not os.path.exists(dbc):
        # baixa p/ .part e só renomeia se completar — evita cache corrompido
        # (download parcial) sendo reusado numa reexecução.
        part = dbc + ".part"
        try:
            urllib.request.urlretrieve(FTP.format(uf=uf, ano=ano), part)
            os.replace(part, dbc)
        except Exception as e:  # ano/UF inexistente, rede etc.
            if os.path.exists(part):
                os.remove(part)
            print(f"  ! {uf} {ano}: download falhou ({e})")
            return None
    dbf = dbc[:-4] + ".dbf"
    datasus_dbc.decompress(dbc, dbf)
    out = {"homicidios": 0, "mvci": 0, "total": 0}
    for r in DBF(dbf, encoding="latin-1", load=False):
        out["total"] += 1
        k = classifica(r.get("CAUSABAS"))
        if k:
            out[k] += 1
    os.remove(dbf)  # DBF descomprimido é grande; descarta
    den = out["homicidios"] + out["mvci"]
    out["razaoMvci"] = round(out["mvci"] / den, 4) if den else None
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--anos", default="2015-2024", help="intervalo, ex.: 2015-2024")
    ap.add_argument("--ufs", default=",".join(UFS), help="lista de UFs separada por vírgula")
    ap.add_argument("--cache", default=tempfile.gettempdir())
    args = ap.parse_args()
    parts = args.anos.split("-")
    a, b = int(parts[0]), int(parts[-1]) # aceita "2022" (único) ou "2015-2024"
    anos = range(a, b + 1)
    ufs = [u.strip().upper() for u in args.ufs.split(",") if u.strip()]

    asset: dict[str, dict] = {}
    for uf in ufs:
        asset[uf] = {}
        for ano in anos:
            r = conta_uf_ano(uf, ano, args.cache)
            if r is not None:
                asset[uf][str(ano)] = r
                print(f"  {uf} {ano}: hom={r['homicidios']} mvci={r['mvci']} razão={r['razaoMvci']}")
    payload = {"fonte": "SIM/DATASUS (DO)", "cids": {"homicidio": "X85-Y09", "mvci": "Y10-Y34"}, "series": asset}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    print(f"OK -> {OUT} ({len(ufs)} UFs, anos {a}-{b})")


if __name__ == "__main__":
    main()
