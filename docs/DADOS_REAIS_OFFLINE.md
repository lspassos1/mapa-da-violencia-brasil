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

Status: metadados oficiais descobertos. Nesta execucao, o download direto do recurso municipal XLSX do MJSP/SINESP retornou timeout a partir deste ambiente. A pipeline agora registra essas falhas em `data/processed/download_manifest.json`, tenta novamente com `curl`, usa arquivo `.part` para permitir retomada local e oferece fallback manual auditavel.

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
python3 -m etl.official_data download --source sinesp_municipios --timeout 120 --retries 3
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
etl/samples/normalization_metadata.sample.json
```

## Regra de chave municipal

A chave canonica municipal e `id_ibge` com 7 digitos.

Para a planilha de populacao IBGE:

```txt
id_ibge = cod_uf(2 digitos) + cod_municipio(5 digitos)
```

A validacao compara essa chave contra a API oficial de municipios do IBGE.

## Normalizacao inicial SINESP/MJSP

A normalizacao SINESP procura um schema tabular com colunas equivalentes a:

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

## Limitacoes

- O MVP visual continua usando dados demonstrativos.
- O dataset de criminalidade SINESP ainda nao foi normalizado para substituir mocks.
- A normalizacao SINESP e inicial e depende de arquivo bruto local baixado ou registrado manualmente.
- Populacao IBGE 2025 foi preparada para calculo futuro de taxa por 100 mil habitantes.
- Download de recursos MJSP pode exigir reexecucao quando o host estiver disponivel.
- Os arquivos processados desta etapa nao devem ser apresentados como base oficial do app ate a metodologia de integracao criminal estar validada.
