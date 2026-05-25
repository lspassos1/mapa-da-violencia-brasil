# Metodologia - Radar da Violencia Brasil

Data do plano: 2026-05-25

## 1. Linguagem responsavel

O produto deve falar em:

- "incidencia registrada";
- "nivel do indicador";
- "ocorrencias registradas";
- "dados oficiais agregados";
- "periodo disponivel".

Evitar:

- "cidade perigosa";
- "risco real em tempo real";
- "crime real total";
- rankings que estigmatizem sem contexto.

Texto base para a pagina:

> Os dados representam registros oficiais agregados por municipio, periodo e indicador. Eles podem sofrer revisoes, subnotificacao e diferencas metodologicas entre fontes. O mapa nao mede risco individual em tempo real.

## 2. Modos de visualizacao

### Total de ocorrencias

Uso:

- Mostrar volume absoluto.
- Bom para planejamento operacional.

Risco:

- Favorece municipios populosos.

### Taxa por 100 mil habitantes

Uso:

- Comparar municipios de portes diferentes.
- Deve ser o modo padrao quando o indicador individual estiver selecionado.

Formula:

```txt
taxa_100k = (ocorrencias / populacao_usada) * 100000
```

Regras:

- Se populacao estiver ausente, taxa fica `null`.
- Municipio sem populacao nao entra em ranking por taxa.
- Tooltip deve exibir "populacao indisponivel" quando aplicavel.

### Indice geral de violencia

Uso:

- Visao sintetica para explorar o mapa.
- Deve ser configuravel e documentado.

Formula inicial:

```txt
indice_geral = soma(score_indicador * peso_indicador) / soma(pesos_validos)
```

Regras:

- Usar apenas indicadores com dados validos no periodo.
- Exibir componentes no painel do municipio.
- Guardar `metodologia_versao`.
- Pesos em tabela/configuracao, nao hardcoded no componente.

## 3. Pesos iniciais do indice geral

| Indicador | Peso inicial |
| --- | ---: |
| homicidio_doloso | 5 |
| feminicidio | 5 |
| latrocinio / roubo seguido de morte | 5 |
| lesao_corporal_seguida_de_morte | 4 |
| estupro | 4 |
| roubo_veiculos | 3 |
| roubo_carga | 3 |
| trafico_drogas | 2 |
| furto_veiculos | 1 |

Esses pesos sao ponto de partida de produto, nao verdade cientifica definitiva. A metodologia deve permitir ajuste e versionamento.

## 4. Score por indicador

Entrada:

- `taxa_100k` preferencialmente.
- `ocorrencias` apenas no modo absoluto.

Saida:

- `score_0_100`.
- `percentil_nacional`.
- `percentil_estadual`.
- `nivel_risco`.

### Alternativas avaliadas

| Metodo | Vantagens | Desvantagens | Uso recomendado |
| --- | --- | --- | --- |
| Escala fixa | Facil de explicar | Pode ficar ruim para indicadores raros | Apenas quando houver serie historica madura |
| Quantis | Distribui cores no mapa | Pode exagerar pequenas diferencas | Bom para exploracao visual |
| Percentil | Simples para ranking relativo | Nao mostra distancia absoluta | Recomendado no MVP |
| Jenks natural breaks | Boa leitura cartografica | Mais complexo e variavel | Avaliar depois |
| Z-score robusto | Reduz efeito de outliers | Menos intuitivo | Bom para alertas/anomalias |
| Winsorizacao | Controla extremos | Pode esconder casos extremos | Usar antes de percentil se houver outliers fortes |

Recomendacao MVP:

1. Calcular taxa por 100 mil.
2. Aplicar winsorizacao opcional nos percentis 1 e 99 para reduzir distorcao.
3. Calcular percentil nacional.
4. Converter percentil para `score_0_100`.
5. Guardar percentil estadual para comparacao local.

## 5. Niveis de risco/indicador

| Score | Nivel exibido |
| ---: | --- |
| 0-20 | Baixo |
| 21-40 | Moderado |
| 41-60 | Atencao |
| 61-80 | Alto |
| 81-100 | Critico |

No texto do produto, preferir "nivel do indicador" em vez de "nivel de perigo".

## 6. Paleta e acessibilidade

Requisitos:

- Paleta sequencial perceptivel tambem para usuarios daltonicos.
- Nao depender apenas de vermelho/verde.
- Incluir legenda numerica.
- Incluir estado visual para `sem_dados`.

Paleta sugerida:

| Nivel | Cor |
| --- | --- |
| Baixo | `#2c7bb6` |
| Moderado | `#abd9e9` |
| Atencao | `#ffffbf` |
| Alto | `#fdae61` |
| Critico | `#d7191c` |
| Sem dados | `#8a8f98` |

Alternativa mais sobria para tema escuro:

| Nivel | Cor |
| --- | --- |
| Baixo | `#3b82f6` |
| Moderado | `#22c55e` |
| Atencao | `#eab308` |
| Alto | `#f97316` |
| Critico | `#ef4444` |
| Sem dados | `#64748b` |

Validar contraste com o basemap escolhido.

## 7. Variacoes temporais

### Variacao mensal

```txt
variacao_mes_pct = ((valor_mes_atual - valor_mes_anterior) / valor_mes_anterior) * 100
```

Regras:

- Se valor anterior for 0 e atual > 0, exibir "novo registro" ou `null`, nao infinito.
- Se ambos forem 0, variacao = 0.

### Variacao anual

```txt
variacao_ano_pct = ((valor_mes_atual - valor_mes_mesmo_mes_ano_anterior) / valor_mes_mesmo_mes_ano_anterior) * 100
```

Usar o mesmo mes do ano anterior para reduzir sazonalidade.

## 8. Cidades sem dados

Classificacao:

- `sem_dados`: fonte nao informa municipio/periodo.
- `zero_registrado`: fonte informa valor zero.
- `populacao_indisponivel`: nao da para calcular taxa.
- `fonte_incompativel`: dado existe apenas em UF/Brasil.

No mapa, `sem_dados` nunca deve ser pintado como risco baixo.

## 9. Conteudo da pagina `/metodologia`

A pagina deve explicar:

- O que o mapa mostra.
- O que o mapa nao mostra.
- Fontes usadas.
- Data da ultima atualizacao.
- Diferenca entre ocorrencias e vitimas.
- Diferenca entre total e taxa por 100 mil.
- Como o indice geral e calculado.
- Como as cores sao calculadas.
- Como municipios sem dados aparecem.
- Limitações: subnotificacao, revisoes, diferencas estaduais, defasagem temporal e indisponibilidade municipal.
- Links para fontes oficiais.
- Versao da metodologia.

## 10. Testes da metodologia

Casos obrigatorios:

- Taxa com populacao valida.
- Taxa com populacao ausente.
- Taxa com ocorrencias zero.
- Percentil com valores repetidos.
- Score com outlier extremo.
- Indice geral com indicador ausente.
- Variacao mensal com denominador zero.
- Classificacao de nivel nos limites 20, 40, 60, 80 e 100.

