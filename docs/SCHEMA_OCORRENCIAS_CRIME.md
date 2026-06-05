# Fonte de verdade em `ocorrencias_crime`

A tabela `public.ocorrencias_crime` (ver
`supabase/migrations/20260602120000_initial_public_safety_schema.sql`) tem quatro
colunas numericas com semantica que se sobrepoe a primeira vista:
`valor`, `unidade_medida`, `ocorrencias` e `vitimas`. Este documento define qual
e a fonte de verdade e quando cada coluna e usada.

## Regra

| Coluna | Obrigatoria | Papel |
|---|---|---|
| `valor` | sim (`not null`, `>= 0`) | **Valor canonico** consumido pelo app e pelas views. |
| `unidade_medida` | sim (`ocorrencias` \| `vitimas`) | **Unidade de `valor`** — define se `valor` conta ocorrencias ou vitimas. |
| `ocorrencias` | nao (nullable) | Contagem bruta de ocorrencias na fonte, preservada para auditoria/proveniencia. |
| `vitimas` | nao (nullable) | Contagem bruta de vitimas na fonte, preservada para auditoria/proveniencia. |

**`valor` + `unidade_medida` e o par canonico.** Tudo o que o app exibe (totais,
ranking, taxa por 100 mil) deriva de `valor`, interpretado segundo
`unidade_medida`. As colunas `ocorrencias` e `vitimas` guardam os numeros brutos
tal como vieram da fonte e existem por dois motivos:

1. **Proveniencia/auditoria** — permitem reconstruir como `valor` foi escolhido
   (ex.: o XLSX municipal SINESP/MJSP de homicidio doloso so traz a coluna
   *Vitimas*, logo `unidade_medida = 'vitimas'`, `valor = vitimas` e
   `ocorrencias` fica `null`).
2. **Indicadores futuros** — fontes que tragam ambos os numeros podem preencher
   `ocorrencias` e `vitimas` em simultaneo, mantendo `valor` ligado a um deles
   conforme a unidade canonica do indicador.

### Consequencias

- Para um indicador em **vitimas** (ex.: `homicidio_doloso`): `valor == vitimas`,
  `unidade_medida = 'vitimas'`, `ocorrencias` normalmente `null`.
- Para um indicador em **ocorrencias** (ex.: `roubo_veiculos`): `valor == ocorrencias`,
  `unidade_medida = 'ocorrencias'`, `vitimas` normalmente `null`.
- A view `metricas_municipais_mensais` propaga apenas `valor` e `unidade_medida`
  (nao as colunas brutas), confirmando que o par canonico e o contrato de leitura.

Isto e consistente com o ETL (`etl/official_data.py`): `normalize_sinesp_table_rows`
define `valor` a partir da coluna de ocorrencias ou de vitimas, regista a
`unidade_medida` correspondente e mantem `ocorrencias`/`vitimas` separadas.

## Auditoria

Para confirmar a regra num ambiente com dados carregados, executar:

```sql
select
  indicador_codigo,
  unidade_medida,
  count(*)                                            as linhas,
  count(*) filter (where ocorrencias is not null)     as com_ocorrencias,
  count(*) filter (where vitimas is not null)         as com_vitimas,
  count(*) filter (where unidade_medida = 'vitimas'   and valor is distinct from vitimas)     as valor_diverge_vitimas,
  count(*) filter (where unidade_medida = 'ocorrencias' and valor is distinct from ocorrencias) as valor_diverge_ocorrencias
from public.ocorrencias_crime
group by indicador_codigo, unidade_medida
order by indicador_codigo;
```

As colunas `valor_diverge_*` devem ser `0`: quando `unidade_medida = 'vitimas'`, a
coluna `vitimas` deve estar preenchida e igual a `valor` (a query usa
`is distinct from`, logo um `vitimas` nulo tambem conta como divergencia); o mesmo
vale para `ocorrencias` quando `unidade_medida = 'ocorrencias'`. Qualquer
divergencia indica inconsistencia de ingestao a investigar.
