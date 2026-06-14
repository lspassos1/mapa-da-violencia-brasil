# Vercel Official Sample Preview Validation

Data da validacao: 2026-06-04

## Escopo

Esta validacao acompanha o PR de Preview:

- PR: https://github.com/lspassos1/mapa-da-violencia-brasil/pull/23
- Branch: `preview/official-sample-mode`
- Objetivo: validar `NEXT_PUBLIC_CRIME_DATA_MODE=official_sample`
- Variavel observada no painel Vercel: `Production and Preview`

Observacao critica: a meta inicial era validar somente Preview, mas a variavel
foi configurada tambem para Production. Como resultado, Production passou a
responder em `official_sample`.

## Deployments avaliados

Preview:

- Branch alias: https://mapa-da-violencia-brasil-git-preview-a92468-lspassos1s-projects.vercel.app
- Deployment inicial: `dpl_5K98dTs4Ew1JDUjBYNBNupVPsQt5`
- Commit inicial: `199a544 chore(preview): trigger official sample Vercel preview`
- Redeploy apos ajuste esperado de env: `dpl_Ap8pRcDjpRGFj2SqyduWSuJoTJCA`
- Commit do redeploy validado: `1caf9a0 chore(preview): redeploy after official sample env fix`
- URL direta validada: https://mapa-da-violencia-brasil-lnmf37hls-lspassos1s-projects.vercel.app

Production:

- URL: https://mapa-da-violencia-brasil.vercel.app

## Variavel

```txt
NEXT_PUBLIC_CRIME_DATA_MODE=official_sample
```

Escopo observado:

- Preview
- Production

Escopo recomendado se a intencao for validar somente Preview:

- Ambiente: Preview
- Branch, se configuravel na Vercel: `preview/official-sample-mode`
- Production: sem essa variavel, ou com fallback `demo`

## Checks do PR

No PR #23, apos o redeploy `1caf9a0`:

- Validate: passou
- Vercel: passou
- Vercel Preview Comments: passou
- Snyk: passou
- Greptile Review: passou

## Resultado detectado

Preview:

```json
{
  "modoDados": "official_sample"
}
```

Production:

```json
{
  "modoDados": "official_sample"
}
```

Isso confirma que o Preview entrou corretamente em `official_sample`, mas tambem
confirma que Production foi afetada pela configuracao atual da variavel.

## Endpoints validados no Preview

Validacao feita via Vercel MCP porque o Preview publico direto esta protegido
por Vercel Authentication.

- `/api/metadata`: 200, `modoDados: "official_sample"`
- `/api/sources/status`: 200, fonte `MJSP/SINESP - amostra oficial local`, status `official_sample`, unidade `vitimas`
- `/api/crime-map`: 200, `demo: false`, `metadata.dataMode: "official_sample"`, indicador unico `homicidioDoloso`
- `/api/municipalities/1200401?periodo=2018-03`: 200, Rio Branco/AC, fonte MJSP/SINESP, unidade `vitimas`

Limite: `/` e `/api/health` do Preview direto responderam 401 por Vercel
Authentication na validacao publica sem bypass.

## Smokes

Preview direto:

```bash
BASE_URL=https://mapa-da-violencia-brasil-git-preview-a92468-lspassos1s-projects.vercel.app \
SMOKE_EXPECT_DATA_MODE=official_sample \
node scripts/smoke-public-routes.mjs
```

Resultado: falhou em `/` com HTTP 401 porque o Preview esta protegido por
Vercel Authentication.

Production esperada como `demo`:

```bash
BASE_URL=https://mapa-da-violencia-brasil.vercel.app \
SMOKE_EXPECT_DATA_MODE=demo \
node scripts/smoke-public-routes.mjs
```

Resultado: falhou porque `/api/metadata` retornou `official_sample`, nao
`demo`.

Production real em `official_sample`:

```bash
BASE_URL=https://mapa-da-violencia-brasil.vercel.app \
SMOKE_EXPECT_DATA_MODE=official_sample \
node scripts/smoke-public-routes.mjs
```

Resultado: passou.

Rotas confirmadas em Production:

- `/`
- `/metodologia`
- `/api/health`
- `/api/metadata`
- `/api/crime-map`
- `/api/sources/status`
- `/api/municipalities/1200401?periodo=2018-03`

## Checklist

- [x] PR de Preview criado.
- [x] Preview Vercel criado.
- [x] Preview Vercel redeployado apos ajuste de env.
- [x] `/api/metadata` do Preview indicou `official_sample`.
- [x] `/api/sources/status` do Preview indicou SINESP/MJSP.
- [x] `/api/crime-map` do Preview retornou dados oficiais agregados.
- [x] `/api/municipalities/1200401` do Preview retornou municipio da amostra oficial.
- [x] Production smoke passou em `official_sample`.
- [ ] Preview publico direto validado por smoke sem protecao.
- [ ] UI do Preview validada visualmente como "amostra oficial parcial".
- [ ] Production preservada em `demo`.

## Limitacoes

- O Vercel CLI nao esta disponivel no ambiente local (`vercel: command not found`).
- O repositorio local nao possui `.vercel/project.json`.
- O Preview publico direto responde 401 por Vercel Authentication.
- A validacao de Preview foi feita por endpoints via Vercel MCP.
- A variavel observada esta configurada em `Production and Preview`, nao apenas
  em Preview.

## Recomendacao

Escolher explicitamente um dos caminhos:

1. Se Production deve continuar em `demo`, remover o escopo Production da
   variavel `NEXT_PUBLIC_CRIME_DATA_MODE`, manter apenas Preview/branch
   `preview/official-sample-mode`, e validar novamente Production com
   `SMOKE_EXPECT_DATA_MODE=demo`.
2. Se a promocao para Production foi intencional, manter `official_sample` em
   Production somente depois de validar visualmente que a UI comunica claramente:
   amostra oficial parcial, homicidio doloso, unidade vitimas, fonte MJSP/SINESP
   e escopo limitado ao Acre/amostra.

Enquanto essa decisao nao for tomada, nao mergear o PR #23.
