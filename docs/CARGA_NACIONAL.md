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

## #10 — Gerar a carga app-ready nacional e servi-la (modo `official`)

Existe um script que faz todo o caminho de uma vez (download -> normalize ->
generate-app-ready -> publicar para o app):

```bash
scripts/build_national_dataset.sh
```

Ou, passo a passo:

```bash
python3 -m etl.official_data download --source ibge_population --source sinesp_municipios
python3 -m etl.official_data normalize          # gera o CSV combinado SINESP+populacao
python3 -m etl.official_data generate-app-ready # usa os centroides nacionais por omissao
cp data/processed/app-ready/crime-map.json public/officialCrimeData.json
```

### Apontar o app para a carga

O app tem um terceiro modo, **`official`**, que carrega a carga nacional do asset
estatico `public/officialCrimeData.json` (o ficheiro versionado existe como
*placeholder* vazio ate ser gerado). A carga e servida de `public/` e lida via
**fetch** no cliente (e via filesystem nas rotas de API, no servidor), por isso
**nao entra no bundle JavaScript** — nem no modo `official`, nem em
demo/official_sample:

```bash
# local
NEXT_PUBLIC_CRIME_DATA_MODE=official npm run build && npm start

# na Vercel: definir a env var de Production
NEXT_PUBLIC_CRIME_DATA_MODE=official
```

Sequencia tipica:

1. `scripts/build_national_dataset.sh` (publica em `public/officialCrimeData.json`)
2. `git add public/officialCrimeData.json && git commit`
3. publicar com `NEXT_PUBLIC_CRIME_DATA_MODE=official`

Enquanto o placeholder nao for substituido, o modo `official` mostra um mapa
vazio e emite um aviso no console (em vez de dados falsos).

A saida intermedia em `data/processed/app-ready/` continua gitignored.

> [!IMPORTANT]
> A carga nacional e servida como **asset estatico** em
> `public/officialCrimeData.json` e carregada **via fetch** no cliente (e via
> filesystem nas rotas de API, no servidor) apenas no modo `official`. Por isso
> **nao entra no bundle JavaScript** de nenhum modo — incluindo demo/official_sample.
> Como o ficheiro deixa de ir para o bundle, uma carga nacional grande (varios MB)
> nao infla os deploys; e descarregada sob demanda apenas quando o modo `official`
> esta ativo. NAO importe `public/officialCrimeData.json` estaticamente em codigo
> de cliente: isso voltaria a colocar o JSON no bundle.

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
