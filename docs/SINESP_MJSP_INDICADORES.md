# Investigacao SINESP/MJSP - indicador municipal

Data: 2026-05-26

Esta nota registra a resolucao tecnica do campo `Vítimas` no arquivo municipal
do MJSP/SINESP e avalia se existe fonte oficial alternativa mais adequada para
varios indicadores por municipio.

## Fonte municipal baixada

Recurso oficial:

```txt
MJSP/SINESP - Dados Nacionais de Segurança Pública - Municípios
URL: https://dados.mj.gov.br/dataset/210b9ae2-21fc-4986-89c6-2006eb4db247/resource/03af7ce2-174e-4ebd-b085-384503cfb40f/download/indicadoressegurancapublicamunic.xlsx
Arquivo local: data/raw/sinesp_municipios.xlsx
bytes: 9690152
sha256: 9fbb5582e4857eb05c5bf52ce24abe38412ce311524b43da6c5a8d873b323fe8
```

Schema real inspecionado:

```txt
Cód_IBGE
Município
Sigla UF
Região
Mês/Ano
Vítimas
```

O arquivo tem 27 abas, uma por UF. O campo `Mês/Ano` vem como serial de data do
Excel; por exemplo, `43101` corresponde a janeiro de 2018.

## Evidencia oficial do indicador

Recurso oficial:

```txt
MJSP/SINESP - Dicionário de Dados - Município
URL: https://dados.mj.gov.br/dataset/210b9ae2-21fc-4986-89c6-2006eb4db247/resource/f29f6034-8dfc-4270-974e-ceedd18d7244/download/dicionario-de-dadosmunicipios.pdf
Arquivo local: data/raw/sinesp_dictionary_municipios.pdf
bytes: 268402
sha256: a080078fe464380d76e555df5bbe788b588028d64dcf68f5411da6437d5db3bc
```

O dicionario municipal informa:

- Unidade de medida `Vítimas`: numero de pessoas registradas como vitimas em um
  boletim de ocorrencia.
- Indicador: `Homicídio doloso`, conforme Portaria MJSP nº 229/2018.
- Unidade geografica de analise: `Município`.
- Periodicidade: coleta mensal.

Conclusao tecnica:

```txt
indicador_codigo = homicidio_doloso
indicador_nome = Homicídio doloso
unidade_medida = vitimas
valor = coluna Vítimas
```

O valor nao deve ser tratado como ocorrencias. Ele representa vitimas de
homicidio doloso no municipio e periodo.

## Fonte alternativa

O catalogo oficial tambem publica a `Base de Dados VDE`, recurso:

```txt
URL: https://dados.mj.gov.br/dataset/210b9ae2-21fc-4986-89c6-2006eb4db247/resource/e9d6cc2b-33f1-468d-ab09-9aa8303c2eba/download/basededadosvde.zip
```

Esta e a candidata mais forte para substituir o XLSX municipal quando o objetivo
for trabalhar com varios indicadores, porque o catalogo SINESP descreve o VDE
como base nacional de dados. A pipeline tentou baixar esse ZIP automaticamente
com `curl`, timeout alto e retomada `.part`.

Status nesta etapa:

- O download automatizado iniciou e recebeu dados do endpoint oficial.
- A primeira tentativa recebeu 14.457.964 bytes antes de timeout.
- O downloader foi ajustado para preservar `.part` entre tentativas futuras.
- A segunda tentativa recebeu 29.070.962 bytes antes de novo timeout:
  `curl: (28) Operation timed out after 900004 milliseconds with 29070962 bytes received`.
- Uma tentativa imediata de retomada falhou na conexao inicial:
  `curl: (28) Failed to connect to dados.mj.gov.br port 443 after 20006 ms`.
- Enquanto o ZIP VDE nao for obtido integralmente, o schema interno nao deve ser
  assumido.

Proximo caminho tecnico:

1. Reexecutar `python3 -m etl.official_data download --source sinesp_vde --timeout 900 --retries 1`; o `.part` sera preservado.
2. Rodar `python3 -m etl.official_data inspect --write-samples`.
3. Se o VDE trouxer municipio, codigo IBGE, periodo, indicador e valor, criar
   normalizador especifico para ele.
4. Usar o XLSX municipal de homicidio doloso como fonte municipal validada ate o
   VDE ser confirmado.

## Impacto no pipeline

A partir desta etapa, o XLSX municipal deixa de ser marcado como
`vitimas_indicador_nao_informado` e passa a ser normalizado como:

```txt
indicador_codigo = homicidio_doloso
unidade_medida = vitimas
```

O dataset combinado com populacao IBGE continua calculando:

```txt
taxa_100k = (valor / populacao) * 100000
```

Como `valor` representa vitimas, a taxa atual e uma taxa de vitimas de homicidio
doloso por 100 mil habitantes.
