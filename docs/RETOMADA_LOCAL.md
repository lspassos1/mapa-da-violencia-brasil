# Retomada local

## Estado reconstruído

- Data da reconstrução: 2026-06-01.
- Caminho local: `/Users/lucaspassos/Documents/Mapa do crime`.
- Repositório remoto: `https://github.com/lspassos1/mapa-da-violencia-brasil.git`.
- Branch: `main`.
- Último commit validado no clone: `09cd505 feat(etl): resolve SINESP municipal indicator`.
- Status pós-clone: worktree limpo antes da criação deste documento.
- Ajuste local feito na retomada: `.gitignore` passou a ignorar `data/manual/` e `*.part`, além dos diretórios de dados já ignorados.

## Resultado das validações

| Validação | Resultado |
| --- | --- |
| `git status --short --branch` | `## main...origin/main` no clone inicial |
| `git remote -v` | `origin` apontando para o GitHub oficial |
| `git log --oneline -20` | histórico recente presente até `09cd505` |
| `npm ci` | passou com npm local 11.16.0 |
| `npm run lint` | passou |
| `npm run typecheck` | passou |
| `npm run test` | passou com Python 3.12.13 |
| `npm run build` | passou com Node 24.14.0 e npm local |
| `python3 -m unittest discover -s etl/tests` | passou com Python 3.12.13 |
| `python3 -m etl.official_data inspect --write-samples` | passou; retornou `file_count: 0` porque `data/raw/` foi apagado no reset |
| `python3 -m etl.official_data normalize --write-samples` | bloqueado por falta de `data/raw/ibge_population.ods`; é necessário baixar novamente pelo pipeline |
| `git check-ignore -v data/raw/example.csv data/manual/example.csv download.part` | confirmou ignore de `data/raw/`, `data/manual/` e `*.part` |
| `npm run dev -- --hostname 127.0.0.1 --port 3000` | servidor abriu em `http://127.0.0.1:3000` |
| `/`, `/metodologia`, `/api/crime-map`, `/api/municipalities/3550308` | todos retornaram HTTP 200 localmente |

Observações de ambiente:

- O `python3` do sistema era Python 3.9.6 e falhou nos testes por não ter `datetime.UTC`.
- As validações Python foram feitas com Python 3.12.13 do runtime local do Codex.
- O sistema não tinha `npm` global no `PATH`; foi usado npm 11.16.0 local para instalar dependências e rodar scripts.

## O que já está feito

- Repositório público GitHub.
- Demo pública Vercel: `https://mapa-da-violencia-brasil.vercel.app`.
- MVP visual Next.js + TypeScript + Tailwind + MapLibre.
- Mapa com centroides e estados.
- Filtros, ranking, breadcrumb e painel de município.
- Dados mockados no app.
- README, roadmap, contributing e deploy docs.
- CI GitHub Actions.
- Pipeline ETL offline/local.
- IBGE população 2025 validado.
- 5.571 municípios IBGE validados.
- Download automatizado SINESP municipal.
- XLSX municipal SINESP inspecionado.
- SINESP municipal normalizado.
- Dataset combinado com população.
- Dicionário oficial resolveu que `Vítimas` no XLSX municipal representa `homicidio_doloso` medido em `vitimas`.

## Decisão técnica já tomada

O XLSX municipal SINESP/MJSP deve ser tratado como homicídio doloso por município/mês, medido em vítimas.

O app ainda mantem dados demonstrativos/mockados como fallback.

## Próxima etapa recomendada

Retomar automaticamente o download da Base VDE do SINESP/MJSP para verificar se ela traz múltiplos indicadores/crimes por município.

Objetivo da próxima etapa:

- Baixar ou retomar a VDE.
- Inspecionar o schema real.
- Verificar se tem município.
- Verificar se tem código IBGE.
- Verificar se tem mês/ano.
- Verificar se tem indicador/crime explícito.
- Verificar se tem múltiplos crimes.
- Se viável, criar normalizador VDE.
- Se não viável, avançar apenas com homicídio doloso real em modo controlado.

## Comando planejado para próxima etapa

```bash
python3 -m etl.official_data fetch-sinesp-vde --timeout 900 --retries 5 --backoff-seconds 5 --write-samples
python3 -m etl.official_data inspect-vde --write-samples
```

Se VDE for viável:

```bash
python3 -m etl.official_data normalize-vde --write-samples
```

Para gerar a camada offline consumivel pelo app a partir do CSV SINESP municipal
com populacao:

```bash
python3 -m etl.official_data generate-app-ready --write-samples
```

Para validar o repositório local com fallback para o runtime Node empacotado do
Codex quando `npm` nao estiver no `PATH`:

```bash
bash scripts/validate-local.sh
```

Observacao: `fetch-sinesp-vde`, `inspect-vde`, `normalize-vde` e
`generate-app-ready` sao comandos do modulo `etl.official_data`. O download VDE
tambem pode ser retomado pelo comando generico:

```bash
python3 -m etl.official_data download --source sinesp_vde --timeout 900 --retries 5 --backoff-seconds 5
```

## Bloqueios conhecidos

- Arquivos brutos foram apagados no reset local.
- `data/raw/` precisa ser baixado novamente pelo pipeline.
- VDE ainda não foi completamente baixado/inspecionado.
- App ainda não consome uma carga nacional real completa.
- Supabase/PostGIS ja tem migration inicial, mas ainda nao foi aplicado nem integrado ao app.
- Polígonos municipais reais ainda não foram integrados.
- MVP ainda usa centroides, não malha municipal real.

## Atualizacao de fechamento - 2026-06-03

- Branch atual desta sessao: `codex/osint-news-layer`.
- Worktree inicial da etapa de fechamento: limpo.
- Ultimo commit local no inicio da etapa: `2abe4b1 chore: stabilize official data handoff`.
- Node esperado pelo projeto: Node.js 22.x, registrado em `.nvmrc`.
- npm esperado: `>=10`, registrado em `package.json`.
- Node disponivel nesta sessao Codex: `/Applications/Codex.app/Contents/Resources/node` (`v24.14.0`).
- `npm` nao estava disponivel no `PATH` desta sessao; use `nvm use && npm ci` em ambiente local normal, ou `bash scripts/validate-local.sh` para validar com fallback por `node`.
- A migration Supabase/PostGIS inicial existe em `supabase/migrations/20260602120000_initial_public_safety_schema.sql`, mas segue nao aplicada/testada localmente porque a Supabase CLI nao esta instalada nesta maquina.
- A amostra oficial versionada ja esta em `src/data/officialCrimeData.sample.json`; ela valida contratos de `homicidio_doloso` em `vitimas`, mas nao substitui a necessidade de gerar a carga nacional completa.
- O modo mock/demo permanece disponivel por `NEXT_PUBLIC_CRIME_DATA_MODE=demo`.
- Documentos especificos criados para retomada futura: `docs/SUPABASE_SCHEMA.md` e `docs/ISSUES_PLANEJADAS.md`.
