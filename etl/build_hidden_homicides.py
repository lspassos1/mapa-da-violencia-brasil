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
import socket
import tempfile
import time
import urllib.request

# O FTP do DATASUS estagna em conexões de dados (download fica em 0 byte para
# sempre). urlretrieve não tem timeout próprio -> impomos um global no socket,
# senão um único arquivo trava o run inteiro. Cada download tem retry.
DOWNLOAD_TIMEOUT = 90  # segundos sem dados -> aborta a tentativa
DOWNLOAD_RETRIES = 3
socket.setdefaulttimeout(DOWNLOAD_TIMEOUT)

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
        # (download parcial) sendo reusado numa reexecução. Retry: o FTP estagna
        # com frequência; uma tentativa que trava aborta no timeout do socket.
        part = dbc + ".part"
        url = FTP.format(uf=uf, ano=ano)
        ok = False
        for tentativa in range(1, DOWNLOAD_RETRIES + 1):
            try:
                urllib.request.urlretrieve(url, part)
                os.replace(part, dbc)
                ok = True
                break
            except Exception as e:  # ano/UF inexistente, timeout, rede etc.
                if os.path.exists(part):
                    os.remove(part)
                # 550 (arquivo inexistente) não adianta repetir -> desiste já.
                if "550" in str(e):
                    print(f"  ! {uf} {ano}: inexistente no FTP ({e})")
                    return None
                if tentativa < DOWNLOAD_RETRIES:
                    print(f"  . {uf} {ano}: tentativa {tentativa} falhou, repetindo ({e})")
                    time.sleep(3 * tentativa)
                else:
                    print(f"  ! {uf} {ano}: download falhou após {DOWNLOAD_RETRIES} tentativas ({e})")
        if not ok:
            return None
    dbf = dbc[:-4] + ".dbf"
    out = {"homicidios": 0, "mvci": 0, "total": 0}
    try:
        # DBC vazio/corrompido (FTP instável p/ arquivos grandes) não pode
        # derrubar o run inteiro — descarta o arquivo ruim e segue (re-baixa depois).
        datasus_dbc.decompress(dbc, dbf)
        for r in DBF(dbf, encoding="latin-1", load=False):
            out["total"] += 1
            k = classifica(r.get("CAUSABAS"))
            if k:
                out[k] += 1
    except Exception as e:
        for p in (dbc, dbf):
            if os.path.exists(p):
                os.remove(p)
        print(f"  ! {uf} {ano}: dbc inválido, pulado ({e})")
        return None
    finally:
        if os.path.exists(dbf):
            os.remove(dbf)  # DBF descomprimido é grande; descarta
    den = out["homicidios"] + out["mvci"]
    out["razaoMvci"] = round(out["mvci"] / den, 4) if den else None
    return out


EMPTY = {"fonte": "SIM/DATASUS (DO)", "cids": {"homicidio": "X85-Y09", "mvci": "Y10-Y34"}, "series": {}}


def load_payload(fresh: bool) -> dict:
    """Carrega o JSON existente p/ RESUMIR (pular UF/ano já contados). --fresh recomeça."""
    if fresh or not os.path.exists(OUT):
        return dict(EMPTY, series={})
    try:
        with open(OUT, encoding="utf-8") as f:
            p = json.load(f)
        p.setdefault("series", {})
        return p
    except Exception:
        return dict(EMPTY, series={})


def write_payload(payload: dict) -> None:
    """Escrita ATÔMICA (tmp + replace) p/ o JSON nunca ficar truncado se cair no meio."""
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    os.replace(tmp, OUT)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--anos", default="2015-2024", help="intervalo, ex.: 2015-2024")
    ap.add_argument("--ufs", default=",".join(UFS), help="lista de UFs separada por vírgula")
    ap.add_argument("--cache", default=tempfile.gettempdir())
    ap.add_argument("--fresh", action="store_true", help="ignora o JSON existente e recomeça do zero")
    args = ap.parse_args()
    parts = args.anos.split("-")
    a, b = int(parts[0]), int(parts[-1])  # aceita "2022" (único) ou "2015-2024"
    anos = list(range(a, b + 1))
    ufs = [u.strip().upper() for u in args.ufs.split(",") if u.strip()]

    # Estado por estado, com gravação incremental e RESUME: o JSON é durável após
    # cada UF e re-execuções pulam o que já foi contado (combina com o cache de
    # download). Imprime progresso [k/N] + percentagem.
    payload = load_payload(args.fresh)
    asset = payload["series"]
    nUf = len(ufs)
    print(f">> {nUf} UFs × {len(anos)} anos ({a}-{b}). Saída: {OUT}", flush=True)
    for i, uf in enumerate(ufs, 1):
        asset.setdefault(uf, {})
        novos = 0
        for ano in anos:
            if str(ano) in asset[uf]:
                continue  # já contado numa execução anterior -> resume
            r = conta_uf_ano(uf, ano, args.cache)
            if r is not None:
                asset[uf][str(ano)] = r
                novos += 1
                print(f"    {uf} {ano}: hom={r['homicidios']} mvci={r['mvci']} razão={r['razaoMvci']}", flush=True)
        write_payload(payload)  # durável após CADA estado
        pct = round(i / nUf * 100)
        bar = "#" * (pct // 5) + "-" * (20 - pct // 5)
        print(f"[{i}/{nUf}] {uf} ok ({len(asset[uf])}/{len(anos)} anos, +{novos}) [{bar}] {pct}%", flush=True)
    print(f"OK -> {OUT} ({nUf} UFs, anos {a}-{b})", flush=True)


if __name__ == "__main__":
    main()
