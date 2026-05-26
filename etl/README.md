# ETL Connectors

Conectores iniciais para fontes estaduais oficiais:

- RJ: ISPdados `BaseMunicipioMensal.csv`, com normalizacao inicial.
- MG: SEJUSP-MG `crimes-violentos`, via CKAN, com normalizacao inicial.
- BA: SSP-BA `morte_violenta_estado`, via CKAN, com normalizacao inicial.
- SP: SSP-SP `numeros-sem-misterio`, via CKAN, com descoberta inicial. A normalizacao fica bloqueada ate escolher o endpoint de download especifico das consultas/paineis oficiais.

## Inspecionar recursos

```bash
python3 -m etl.sources rj --discover
python3 -m etl.sources mg --discover
python3 -m etl.sources ba --discover
python3 -m etl.sources sp --discover
```

## Rodar testes

```bash
python3 -m unittest discover -s etl/tests
```

## Pipeline nacional offline/local

Esta pipeline prepara fontes oficiais tabulares sem alterar o MVP visual e sem versionar arquivos brutos.

```bash
python3 -m etl.official_data discover --write-samples
python3 -m etl.official_data download --source ibge_population
python3 -m etl.official_data inspect --write-samples
python3 -m etl.official_data normalize --write-samples
```

Saidas locais ignoradas pelo Git:

- `data/raw/`
- `data/processed/`

Amostras leves versionaveis:

- `etl/samples/official_source_catalog.sample.json`
- `etl/samples/inspection_summary.sample.json`
- `etl/samples/ibge_population_2025.sample.csv`
- `etl/samples/municipality_key_validation.sample.json`
- `etl/samples/normalization_metadata.sample.json`
- `etl/samples/sinesp_normalization_status.sample.json`
- `etl/samples/sinesp_indicators_normalized.sample.csv` quando houver arquivo SINESP bruto reconhecido localmente

O download dos recursos SINESP/MJSP tambem e suportado pelos ids `sinesp_municipios`,
`sinesp_uf`, `sinesp_vde`, `sinesp_dictionary_municipios` e
`sinesp_dictionary_uf`. A normalizacao criminal so deve ser considerada pronta
depois de baixar os arquivos brutos localmente, inspecionar o schema real e
validar as chaves municipais.

Exemplo para baixar o XLSX municipal oficial. O portal pode ser lento; use
timeout alto para permitir a retomada do `.part` local.

```bash
python3 -m etl.official_data download --source sinesp_municipios --timeout 600 --retries 3
```

Fallback manual continua disponivel para contingencia, mas nao e necessario
quando o download automatizado acima conclui:

```bash
python3 -m etl.official_data register-manual \
  --source sinesp_municipios \
  --file ~/Downloads/indicadoressegurancapublicamunic.xlsx \
  --note "Baixado manualmente do portal oficial MJSP"
python3 -m etl.official_data inspect --write-samples
python3 -m etl.official_data normalize --write-samples
```

## Formato canonico

Os conectores retornam `CrimeRecord` com:

- `source_id`
- `uf`
- `year`
- `month`
- `indicator_code`
- `value`
- `municipality`
- `municipality_code`
- `victims`
- `raw_indicator`

O carregamento em banco, deduplicacao, precedencia entre fontes e calculo de taxa/score devem ficar em etapas posteriores do ETL.

## SINESP municipal XLSX

O arquivo municipal real baixado do MJSP/SINESP tem 27 abas por UF e schema:

- `Cód_IBGE`
- `Município`
- `Sigla UF`
- `Região`
- `Mês/Ano`
- `Vítimas`

Como o XLSX municipal nao traz uma coluna explicita de tipo de crime/indicador,
o normalizador usa:

- `indicador_codigo`: `vitimas_indicador_nao_informado`
- `unidade_medida`: `vitimas`
- `valor`: valor da coluna `Vítimas`

A pipeline tambem gera um dataset combinado com populacao IBGE 2025 quando a
linha traz `id_ibge` municipal valido:

- `data/processed/sinesp_indicators_normalized.csv`
- `data/processed/sinesp_municipal_indicators_with_population.csv`

Esses arquivos continuam ignorados pelo Git.

Observacao: algumas fontes estaduais publicam codigo municipal com 6 digitos. O conector preserva o codigo original normalizado, sem inventar o digito final do IBGE. A conversao para `id_ibge` de 7 digitos deve acontecer em uma etapa posterior, usando a tabela oficial de municipios do IBGE e, quando necessario, nome + UF como apoio auditavel.
