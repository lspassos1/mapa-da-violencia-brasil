# Fechamento Tecnico - 2026-06-02

Este documento registra o estado estabilizado apos a primeira transicao do app
para contratos oficiais em modo offline/local.

## Escopo fechado

- A camada oficial inicial usa uma amostra versionada do SINESP/MJSP municipal
  para `homicidio_doloso`, com unidade `vitimas`.
- O modo demonstrativo continua disponivel e nao foi removido.
- A migration Supabase/PostGIS inicial foi criada, mas nao foi aplicada em
  ambiente remoto ou de producao.
- A Base VDE nao foi avancada alem da inspecao segura do `.part` incompleto.

## Comandos canonicos

Em ambiente normal com Node.js 22.x e npm >= 10:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
python3 -m unittest discover -s etl/tests
git diff --check
```

Para executar a mesma validacao local com fallback para o runtime Node empacotado
do Codex:

```bash
bash scripts/validate-local.sh
```

Se `npm` nao estiver no `PATH`, tambem e possivel apontar manualmente para um
runtime Node 22.x:

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

Smoke test de rotas publicas, com o servidor ja iniciado:

```bash
npm run smoke
```

Rotas cobertas pelo smoke atual:

- `/`
- `/metodologia`
- `/api/health`
- `/api/metadata`
- `/api/crime-map`
- `/api/sources/status`
- `/api/municipalities/1200401`

## Limitacoes restantes

- O download VDE ainda esta incompleto em `data/raw/sinesp_vde.zip.part`; nenhum
  schema do VDE deve ser assumido antes de existir ZIP completo e inspecionado.
- A migration em `supabase/migrations/` ainda nao foi aplicada, pois a Supabase
  CLI nao esta instalada neste ambiente.
- O app nao depende exclusivamente de dados reais; a amostra oficial valida
  contratos, e o modo mock/demo permanece como fallback explicito.
- A carga nacional app-ready completa permanece fora do Git em
  `data/processed/app-ready/`.
- O visual check pelo Browser do Codex falhou/bloqueou nesta maquina; a validacao
  funcional ficou coberta por build e smoke HTTP.
- O `node` padrao desta sessao aponta para o binario do app Codex e pode acionar
  o erro de assinatura do SWC Darwin ARM64. Usar Node.js 22.x via `.nvmrc`, CI
  ou runtime empacotado do Codex evita esse problema.

## Validacao complementar - 2026-06-03

- `npm` continuou ausente do `PATH`.
- `node_modules/.bin/tsc --noEmit` passou.
- `node_modules/.bin/eslint .` passou.
- `python3 -m unittest discover -s etl/tests` passou.
- `node --test tests/*.test.mjs` passou.
- `git diff --check` passou.
- `node node_modules/next/dist/bin/next build --webpack` falhou com erro local
  de assinatura do `@next/swc-darwin-arm64`.
- `/Users/lucaspassos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next build --webpack` passou.
- `bash scripts/validate-local.sh` passou usando o runtime Node de fallback.
- `scripts/smoke-public-routes.mjs` passou em `official_sample` e tambem em
  `demo` com `SMOKE_MUNICIPALITY_ID=3550308`.
- Supabase CLI nao estava instalada; a migration segue sem aplicacao local.

Documentos novos desta rodada:

- `docs/SUPABASE_SCHEMA.md`
- `docs/ISSUES_PLANEJADAS.md`

## Politica de versionamento de dados

- Versionar apenas amostras pequenas e auditaveis.
- Nao commitar ZIPs, shapefiles, tiles, `.part`, CSVs processados grandes ou
  bases brutas.
- Preservar fonte, unidade, periodo, checksum/status e limitacoes metodologicas
  nos artefatos gerados.
