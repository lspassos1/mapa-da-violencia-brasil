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

Observacao: algumas fontes estaduais publicam codigo municipal com 6 digitos. O conector preserva o codigo original normalizado, sem inventar o digito final do IBGE. A conversao para `id_ibge` de 7 digitos deve acontecer em uma etapa posterior, usando a tabela oficial de municipios do IBGE e, quando necessario, nome + UF como apoio auditavel.
