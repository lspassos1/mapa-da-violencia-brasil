# Caminho para a carga nacional (issues #9 / #10 / #11)

Estado de cada peça do caminho de dados reais e o que falta para a publicação
nacional.

## Centroides municipais — VERSIONADO (este PR)

`etl/reference/municipal_centroids.csv` traz `id_ibge, lat, lng` para os **5.570
municipios** brasileiros, derivados da malha municipal do IBGE (centroide do
maior poligono de cada municipio). `load_app_ready_centroids()` usa este ficheiro
como base nacional por omissao.

Antes, o ETL so conhecia ~25 centroides de amostra e descartava qualquer
municipio sem centroide ("Linhas sem centroide ficam fora do JSON do mapa"). Com
a base versionada, a geracao app-ready deixa de perder municipios:

```text
# amostra de 25 linhas, antes:  app_rows: 22, skipped_without_centroid: 3
# amostra de 25 linhas, agora:  app_rows: 25, skipped_without_centroid: 0
```

Regenerar o CSV (caso o IBGE atualize a malha) e reproduzivel por
`scripts/build_municipal_centroids.py`:

```bash
# baixa a malha do IBGE e reescreve etl/reference/municipal_centroids.csv
python3 scripts/build_municipal_centroids.py

# ou, a partir de uma malha ja baixada
python3 scripts/build_municipal_centroids.py --input /tmp/ibge_mun.geojson
```

Se a referencia estiver ausente, `generate-app-ready` emite um aviso em stderr e
a saida fica limitada aos centroides de amostra (em vez de falhar em silencio).

## #9 — Base VDE SINESP/MJSP (download manual)

A Base VDE e um recurso `.zip` do pacote MJSP em `dados.mj.gov.br`
(`Ocorrências Criminais - Sinesp`). O download e a normalizacao correm pelo ETL,
mas o ficheiro bruto **nao e versionado** (fica em `data/raw/`, no `.gitignore`):

```bash
python3 -m etl.official_data fetch-sinesp-vde
python3 -m etl.official_data inspect-vde --write-samples
python3 -m etl.official_data normalize-vde --write-samples
```

Os artefactos de inspecao versionados ficam em `etl/samples/sinesp_vde_*`.

## #10 — Gerar a carga app-ready nacional

Com a base de centroides versionada, o passo nacional precisa apenas das fontes
oficiais (XLSX municipal + populacao IBGE) e do join:

```bash
python3 -m etl.official_data download --source ibge_population --source sinesp_municipios
python3 -m etl.official_data normalize          # gera o CSV combinado SINESP+populacao
python3 -m etl.official_data generate-app-ready # usa os centroides nacionais por omissao
# saida: data/processed/app-ready/crime-map.json  (gitignored; servido no deploy)
```

A saida nacional fica em `data/processed/app-ready/` (gitignored) e e publicada no
deploy — nao e committada (ver README).

## #11 — Supabase (requer credenciais)

Aplicar a migration e carregar as views exige um projeto Supabase e credenciais
do utilizador (nao versionaveis). Sequencia local:

```bash
supabase start
supabase db reset            # aplica supabase/migrations/*.sql
# carregar data/processed/app-ready/* nas tabelas/views
```

Depois, apontar o app para as views reais (trocar os mocks por leitura Supabase)
e, na CSP (`next.config.ts`), adicionar a origem do projeto Supabase
(`https://<project-ref>.supabase.co`, sem wildcard).
