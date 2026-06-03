# Vercel Official Sample Preview Validation

Data da validacao: 2026-06-03

## Escopo

Esta validacao acompanha o PR de Preview:

- PR: https://github.com/lspassos1/mapa-da-violencia-brasil/pull/23
- Branch: `preview/official-sample-mode`
- Objetivo: validar `NEXT_PUBLIC_CRIME_DATA_MODE=official_sample` em Vercel Preview
- Production: nao alterada

## Deployments avaliados

Preview:

- Branch alias: https://mapa-da-violencia-brasil-git-preview-a92468-lspassos1s-projects.vercel.app
- Deployment inicial: `dpl_5K98dTs4Ew1JDUjBYNBNupVPsQt5`
- Commit inicial: `199a544 chore(preview): trigger official sample Vercel preview`
- Deployment de redeploy: `dpl_8TUFTSXfEniyQV1oNz9iq97HidNp`
- Commit de redeploy: `47f645f chore(preview): redeploy official sample with env`
- URL direta do redeploy: https://mapa-da-violencia-brasil-jz1sem4au-lspassos1s-projects.vercel.app
- Deployment adicional avaliado apos documentacao: `dpl_8RJZwZj8Xq89e4eyZMQpitKCNBE9`
- Commit adicional avaliado: `45ad2d7 docs(deploy): record official sample preview validation`
- URL direta adicional: https://mapa-da-violencia-brasil-r40lwjasn-lspassos1s-projects.vercel.app

Production:

- URL: https://mapa-da-violencia-brasil.vercel.app

## Variavel esperada

```txt
NEXT_PUBLIC_CRIME_DATA_MODE=official_sample
```

Escopo esperado:

- Ambiente: Preview
- Branch, se configuravel na Vercel: `preview/official-sample-mode`

## Resultado dos checks

No PR #23, apos o redeploy:

- Validate: passou
- Vercel: passou
- Vercel Preview Comments: passou

## Resultado detectado

O Preview foi criado e redeployado com sucesso. Um deployment adicional do PR
tambem foi validado via Vercel MCP. Em ambos os casos, o endpoint
`/api/metadata` ainda reporta:

```json
{
  "modoDados": "demo"
}
```

Isso indica que a variavel `NEXT_PUBLIC_CRIME_DATA_MODE=official_sample` ainda
nao esta aplicada ao Preview desta branch, ou foi aplicada em outro escopo.

Production continua no fallback esperado:

```json
{
  "modoDados": "demo"
}
```

## Smokes

Preview direto:

```bash
BASE_URL=https://mapa-da-violencia-brasil-git-preview-a92468-lspassos1s-projects.vercel.app \
SMOKE_EXPECT_DATA_MODE=official_sample \
node scripts/smoke-public-routes.mjs
```

Resultado: falhou em `/` com HTTP 401 porque o Preview esta protegido por
Vercel Authentication.

Production:

```bash
BASE_URL=https://mapa-da-violencia-brasil.vercel.app \
SMOKE_EXPECT_DATA_MODE=demo \
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
- `/api/municipalities/3550308?periodo=2026-04`

## Checklist

- [x] PR de Preview criado.
- [x] Preview Vercel criado.
- [x] Preview Vercel redeployado.
- [x] Checks do PR passaram.
- [x] Production continuou em `demo`.
- [x] Production smoke passou.
- [ ] Preview publico direto validado por smoke.
- [ ] `/api/metadata` do Preview indicou `official_sample`.
- [ ] `/api/sources/status` do Preview indicou SINESP/MJSP e IBGE como fonte ativa.
- [ ] `/api/crime-map` do Preview retornou dados oficiais agregados.
- [ ] `/api/municipalities/1200401` do Preview retornou municipio da amostra oficial.
- [ ] UI do Preview foi validada como "amostra oficial parcial".

## Limitacoes

- O Vercel CLI nao esta disponivel no ambiente local (`vercel: command not found`).
- O repositorio local nao possui `.vercel/project.json`.
- O Preview publico direto responde 401 por Vercel Authentication.
- O Vercel MCP conseguiu ler a URL direta do redeploy, mas o modo detectado foi
  `demo`, nao `official_sample`.
- Commits posteriores de documentacao podem gerar novos Previews, mas nao devem
  mudar o modo detectado enquanto a variavel Preview/branch nao estiver aplicada.

## Recomendacao

Manter Production em `demo` por enquanto.

Antes de promover `official_sample`, corrigir a configuracao do Preview na
Vercel:

1. Confirmar que `NEXT_PUBLIC_CRIME_DATA_MODE=official_sample` existe no
   ambiente Preview.
2. Se a Vercel permitir escopo por branch, restringir a
   `preview/official-sample-mode`.
3. Redeployar a branch.
4. Confirmar que `/api/metadata` retorna `modoDados: "official_sample"`.
5. Rodar o checklist publico completo.
