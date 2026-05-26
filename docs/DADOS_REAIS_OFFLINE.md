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

Status: metadados oficiais descobertos. Nesta execucao, o download direto do recurso municipal XLSX do MJSP/SINESP retornou timeout a partir deste ambiente. A pipeline registra essas falhas em `data/processed/download_manifest.json` e permite reexecucao quando o host estiver disponivel.

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
python3 -m etl.official_data download --source sinesp_municipios
python3 -m etl.official_data download --source sinesp_uf
python3 -m etl.official_data download --source sinesp_vde
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
data/processed/normalization_metadata.json
```

Amostras leves versionaveis:

```txt
etl/samples/official_source_catalog.sample.json
etl/samples/inspection_summary.sample.json
etl/samples/ibge_population_2025.sample.csv
etl/samples/municipality_key_validation.sample.json
etl/samples/normalization_metadata.sample.json
```

## Regra de chave municipal

A chave canonica municipal e `id_ibge` com 7 digitos.

Para a planilha de populacao IBGE:

```txt
id_ibge = cod_uf(2 digitos) + cod_municipio(5 digitos)
```

A validacao compara essa chave contra a API oficial de municipios do IBGE.

## Limitacoes

- O MVP visual continua usando dados demonstrativos.
- O dataset de criminalidade SINESP ainda nao foi normalizado para substituir mocks.
- Populacao IBGE 2025 foi preparada para calculo futuro de taxa por 100 mil habitantes.
- Download de recursos MJSP pode exigir reexecucao quando o host estiver disponivel.
- Os arquivos processados desta etapa nao devem ser apresentados como base oficial do app ate a metodologia de integracao criminal estar validada.
