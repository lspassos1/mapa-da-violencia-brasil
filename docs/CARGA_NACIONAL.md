# Caminho para a carga nacional (issues #9 / #10 / #11)

Estado de cada peça do caminho de dados reais e o que falta para a publicação
nacional.

## Carga real a partir da Base VDE (implementada)

Os ficheiros anuais da Base VDE do SINESP/MJSP (XLSX, ~28 MB cada) vivem em
`data/raw/vde/` (gitignored). `etl/aggregate_vde.py` le-os por **streaming**
(`iterparse`, memoria limitada) e agrega por `(id_ibge, periodo, indicador)`:

```bash
# diagnostico (eventos, colunas, match de municipio)
python3 -m etl.aggregate_vde diagnose --year 2025

# pipeline completo e reproduzivel:
#   agrega -> app-ready -> funde por municipio -> gzip para public/
python3 -m etl.aggregate_vde finalize --year 2025 --granularity anual
# -> public/officialCrimeData.json.gz

# carga MULTI-ANO (todos os anos com ficheiro em data/raw/vde/):
#   um item por (municipio, ano); periods = anos completos (desc) + parciais no fim
python3 -m etl.aggregate_vde finalize-multi --partial 2026
#   ou um intervalo explicito:
python3 -m etl.aggregate_vde finalize-multi --years 2015-2026 --partial 2026
# -> public/officialCrimeData.json.gz (multi-periodo)
```

**Multi-ano e taxa por 100 mil:** so existe populacao IBGE de 2025, por isso a
**taxa/100k** so e calculada para o periodo **2025** (que abre por omissao, sendo
`periods[0]`); nos restantes anos mostra-se o **total absoluto** (a app suprime a
taxa cruzada de populacao). Anos parciais (ex.: 2026, ano corrente incompleto)
ficam rotulados `(parcial)` e no fim da lista de periodos.

**Granularidade do VDE:** so os crimes de **vitima** (homicidio doloso,
feminicidio, latrocinio, lesao corporal seguida de morte, tentativa de
homicidio) vem por municipio; os patrimoniais (roubo/furto/trafico/estupro)
vem so a nivel UF e nao entram no mapa municipal.

**Servico gzipped:** a carga e fundida por municipio (um item com todos os
indicadores), depois **gzipped** para `public/officialCrimeData.json.gz`
(~0,3 MB; o JSON cru ~8,8 MB excederia o limite de 5 MB do CI e seria pesado de
descarregar). O cliente descomprime com `DecompressionStream`; o servidor (rotas
de API) com `node:zlib`. Publicar com `NEXT_PUBLIC_CRIME_DATA_MODE=official`.

**Limite desta abordagem (ficheiro):** o ficheiro committado em `public/` serve
bem 1 ano. Para mais anos sem inflar o repo, usa o **modo `supabase`** (abaixo).

## Modo `supabase` (carga servida do Supabase Storage)

Com `NEXT_PUBLIC_CRIME_DATA_MODE=supabase`, a app carrega a carga nacional do
**Supabase Storage** (bucket publico `crime-data`, objeto `current.json.gz`) em
vez do ficheiro local — cliente via `fetch`+`DecompressionStream`, servidor (rotas
de API) via `fetch`+`zlib`. Assim os dados saem do repo e nao ha limite de 5 MB.

Publicar (le as credenciais do ambiente; nunca committar segredos):

```bash
python3 -m etl.aggregate_vde finalize --year 2025         # gera public/officialCrimeData.json.gz
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service_role>           # secreto
scripts/upload_to_supabase.sh                             # envia para crime-data/current.json.gz
```

Env da app (Vercel / `.env.local`):

```
NEXT_PUBLIC_CRIME_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>   # opcional: o bucket de Storage e
#   publico (nao precisa de auth). Reservado para o futuro acesso autenticado
#   as views Postgres (#11).
```

## Postgres (`crime_municipal`) — para BI e SQL

Os mesmos dados estao tambem numa tabela Postgres **`public.crime_municipal`**
(migration `supabase/migrations/20260607130000_crime_municipal_flat.sql`): uma
linha por `(id_ibge, ano, indicador)` com `valor`, `taxa_100k`, `score`, etc.
Tem **RLS de leitura publica**, pelo que e consultavel:

- por **SQL / Power BI** (connection string do Postgres);
- por **PostgREST** com a anon key:
  `GET /rest/v1/crime_municipal?ano=eq.2025&indicador=eq.homicidioDoloso&order=valor.desc`.

Carregar (credenciais sempre do ambiente):

```bash
npm i pg --no-save
export SUPABASE_DB_URL='postgresql://postgres.<ref>:<DB_PASSWORD>@aws-1-<region>.pooler.supabase.com:5432/postgres'
python3 -m etl.aggregate_vde finalize --year 2025   # gera public/officialCrimeData.json.gz
node scripts/load_postgres.mjs                        # carrega para crime_municipal
```

Para a **historia completa (12 anos) com todas as dimensoes (sexo, faixa etaria,
mes)** e os crimes patrimoniais a nivel UF, o passo seguinte e estender o ETL
para varios anos (precisa de populacao IBGE por ano para a taxa) e, se quiser
filtragem por periodo direto da BD, ligar as rotas de API a esta tabela — ver #11.

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
