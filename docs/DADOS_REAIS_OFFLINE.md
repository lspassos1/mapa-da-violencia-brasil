# Dados reais em modo offline/local

Data: 2026-05-26

Esta etapa prepara dados oficiais tabulares sem alterar o MVP visual e sem conectar Supabase, PostGIS, vector tiles ou geometrias municipais completas.

## Objetivo

- Descobrir fontes oficiais por metadados.
- Baixar arquivos brutos apenas em `data/raw/`.
- Gerar arquivos intermediarios locais em `data/processed/`.
- Versionar somente amostras leves em `etl/samples/`.
- Validar chaves municipais antes de qualquer uso no app.

## Fontes usadas nesta etapa

### MJSP/SINESP

- Catalogo CKAN: https://dados.mj.gov.br/api/3/action/package_show?id=sistema-nacional-de-estatisticas-de-seguranca-publica
- Dataset publico: https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica
- Licenca indicada pelo catalogo: Creative Commons Atribuicao.

Recursos descobertos:

- Dados Nacionais de Seguranca Publica - Municipios, XLSX.
- Dados Nacionais de Seguranca Publica - UF, XLSX.
- Base de Dados VDE, ZIP.
- Dicionarios de dados, PDF.

Status: metadados oficiais descobertos e arquivo municipal XLSX baixado automaticamente.
O endpoint direto do MJSP respondeu `200 OK`, `Content-Type:
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
`Accept-Ranges: bytes` e tamanho total de 9.690.152 bytes. O download foi feito
por `curl` com retomada em `.part` e registrado em
`data/processed/download_manifest.json`.

Arquivo local bruto:

```txt
data/raw/sinesp_municipios.xlsx
bytes: 9690152
sha256: 9fbb5582e4857eb05c5bf52ce24abe38412ce311524b43da6c5a8d873b323fe8
```

### IBGE populacao

- Diretorio oficial: https://ftp.ibge.gov.br/Estimativas_de_Populacao/Estimativas_2025/
- Arquivo tabular preferido: `POP2025_*.ods`, selecionando a versao mais recente disponivel no diretorio.

Status: ODS 2025 baixado e normalizado localmente.

### IBGE municipios

- API de localidades: https://servicodados.ibge.gov.br/api/v1/localidades/municipios

Status: usada para validar `id_ibge` de 7 digitos.

## Como rodar

```bash
python3 -m etl.official_data discover --write-samples
python3 -m etl.official_data download --source ibge_population
python3 -m etl.official_data inspect --write-samples
python3 -m etl.official_data normalize --write-samples
```

Para tentar baixar recursos SINESP/MJSP:

```bash
python3 -m etl.official_data download --source sinesp_municipios --timeout 600 --retries 3
python3 -m etl.official_data download --source sinesp_uf --timeout 120 --retries 3
python3 -m etl.official_data download --source sinesp_vde --timeout 120 --retries 3
```

Fallback manual quando o download direto der timeout:

```bash
python3 -m etl.official_data register-manual \
  --source sinesp_municipios \
  --file ~/Downloads/indicadoressegurancapublicamunic.xlsx \
  --note "Baixado manualmente do portal oficial MJSP"
python3 -m etl.official_data inspect --write-samples
python3 -m etl.official_data normalize --write-samples
```

## Saidas locais

Arquivos brutos, ignorados pelo Git:

```txt
data/raw/
```

Arquivos processados locais, ignorados pelo Git:

```txt
data/processed/official_source_catalog.json
data/processed/download_manifest.json
data/processed/inspection_summary.json
data/processed/ibge_population_2025.csv
data/processed/ibge_municipalities.csv
data/processed/municipality_key_validation.json
data/processed/sinesp_indicators_normalized.csv
data/processed/sinesp_normalization_status.json
data/processed/sinesp_municipal_indicators_with_population.csv
data/processed/sinesp_population_join_status.json
data/processed/normalization_metadata.json
```

Amostras leves versionaveis:

```txt
etl/samples/official_source_catalog.sample.json
etl/samples/inspection_summary.sample.json
etl/samples/ibge_population_2025.sample.csv
etl/samples/municipality_key_validation.sample.json
etl/samples/sinesp_normalization_status.sample.json
etl/samples/sinesp_indicators_normalized.sample.csv
etl/samples/sinesp_population_join_status.sample.json
etl/samples/sinesp_municipal_indicators_with_population.sample.csv
etl/samples/normalization_metadata.sample.json
```

## Regra de chave municipal

A chave canonica municipal e `id_ibge` com 7 digitos.

Para a planilha de populacao IBGE:

```txt
id_ibge = cod_uf(2 digitos) + cod_municipio(5 digitos)
```

A validacao compara essa chave contra a API oficial de municipios do IBGE.

## Resolucao do indicador municipal SINESP/MJSP

O XLSX municipal real foi inspecionado. Ele tem 27 abas, uma por UF, com schema:

```txt
Cód_IBGE
Município
Sigla UF
Região
Mês/Ano
Vítimas
```

O campo `Mês/Ano` vem como serial de data do Excel. Exemplo: `43101` equivale
a janeiro de 2018.

Este arquivo municipal nao traz coluna explicita de tipo de crime/indicador.
O dicionario oficial do recurso municipal resolve essa ambiguidade:

```txt
Recurso: Dicionário de Dados - Município
Unidade de medida: Vítimas
Descrição: número de pessoas registradas como vítimas em um boletim de ocorrência
Indicador: Homicídio doloso
Unidade geográfica: Município
```

Por isso a pipeline normaliza o valor com:

```txt
indicador_codigo = homicidio_doloso
unidade_medida = vitimas
valor = Vítimas
```

O arquivo municipal pode ser usado como fonte de vitimas de homicidio doloso por
municipio e periodo. Ele nao serve para varios tipos de crime, porque nao traz
coluna de indicador por linha.

Para arquivos SINESP com schema mais completo, a normalizacao tambem procura
colunas equivalentes a:

```txt
UF
codigo IBGE / id_ibge
municipio
ano
mes
indicador
ocorrencias
vitimas
```

Quando o arquivo bruto local contem esse schema, a saida canonica e:

```txt
source_id
source_file
nivel_geografico
id_ibge
uf
municipio
ano
mes
indicador_codigo
indicador_nome
valor
unidade_medida
ocorrencias
vitimas
fonte
data_coleta
limitacoes
```

Indicadores conhecidos sao mapeados para codigos estaveis como
`homicidio_doloso`, `feminicidio`, `roubo_veiculos`, `furto_veiculos`,
`roubo_carga`, `estupro`, `trafico_drogas` e `latrocinio`.

Se o schema real vier diferente, a pipeline nao inventa dados: registra
`no_rows`, `skipped` ou `failed` em `data/processed/sinesp_normalization_status.json`
para orientar a proxima correcao.

## Resultado da normalizacao municipal SINESP

Resultado local desta etapa:

```txt
data/processed/sinesp_indicators_normalized.csv
linhas normalizadas: 294.706

data/processed/sinesp_municipal_indicators_with_population.csv
linhas combinadas com populacao IBGE: 292.791
```

Observacoes de chave:

- 292.798 linhas SINESP trazem `id_ibge`.
- 5.560 IDs unicos bateram com a API oficial de municipios do IBGE.
- 1 ID nao existe na base municipal atual: `2899999`, municipio `N/I`, UF `SE`.
- 1.908 linhas nao trazem `id_ibge`, principalmente regioes administrativas do DF; elas ficam fora do dataset combinado por municipio para nao forcar join indevido.
- A taxa inicial usa `taxa_100k = (valor / populacao_2025) * 100000`.

Documentacao detalhada da investigacao:

```txt
docs/SINESP_MJSP_INDICADORES.md
```

## Base VDE como alternativa

A Base de Dados VDE e a candidata oficial para uma proxima etapa com varios
indicadores por crime. A pipeline tentou baixar automaticamente:

```txt
python3 -m etl.official_data download --source sinesp_vde --timeout 900 --retries 2
```

Resultado desta execucao:

- endpoint oficial testado:
  `https://dados.mj.gov.br/dataset/210b9ae2-21fc-4986-89c6-2006eb4db247/resource/e9d6cc2b-33f1-468d-ab09-9aa8303c2eba/download/basededadosvde.zip`;
- o servidor iniciou transferencia;
- a tentativa chegou a 29.070.962 bytes recebidos;
- a transferencia terminou com `curl: (28) Operation timed out after 900004 milliseconds`;
- o `.part` foi preservado em `data/raw/` para retomada automatizada futura;
- o schema interno do VDE ainda nao foi assumido, porque o ZIP nao foi completado.

## Limitacoes

- O MVP visual continua usando dados demonstrativos.
- O dataset SINESP municipal foi normalizado como vitimas de homicidio doloso com base no dicionario oficial municipal.
- A normalizacao SINESP municipal ainda nao cobre outros tipos de crime.
- Populacao IBGE 2025 foi preparada para calculo futuro de taxa por 100 mil habitantes.
- Download de recursos MJSP pode ser lento e exigir timeout alto.
- Os arquivos processados desta etapa nao devem ser apresentados como base oficial do app ate a metodologia de integracao criminal estar validada.
