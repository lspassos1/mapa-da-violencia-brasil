# Contribuindo / Desenvolvimento

Fluxos de desenvolvimento, testes e deploy. (O [README](../README.md) cobre o produto e a stack; aqui ficam os detalhes operacionais.)

## Pré-requisitos

- **Node.js 22.x** e **npm ≥ 10** (a major fica em [`.nvmrc`](../.nvmrc)).
- Para os ETLs de dados: **Python 3** (`datasus-dbc`, `dbfread`, etc. — só quando for gerar assets).

```bash
nvm use
npm install
cp .env.example .env.local   # preencha as credenciais — nenhum segredo é versionado
npm run dev                  # http://localhost:3000
```

## Comandos

```bash
npm run validate        # lint + typecheck + test:contracts + test:api + build (o que o CI roda)

npm run lint
npm run typecheck
npm run test            # node:test
npm run test:contracts  # contratos (libs server-only, com server-only stubado)
npm run test:api        # rotas de API
npm run test:etl        # ETLs
npm run build
```

Se `npm` não estiver no `PATH` desta máquina, há um fallback:

```bash
bash scripts/validate-local.sh
```

### Smoke test de APIs

Espera um servidor local já rodando em `http://127.0.0.1:3000`:

```bash
npm run dev   # em outro terminal
npm run smoke
```

### Verificação visual (Playwright)

Checa que o app renderiza de fato (mapa, radar, páginas) em desktop e mobile, falhando em erro de JS, console error crítico ou mapa vazio. A aba `/noticias` roda com a API mockada (sem custo de IA). Na primeira vez, instale o browser; depois é só buildar e rodar (o Playwright sobe o `next start` sozinho):

```bash
npx playwright install chromium      # uma vez
npm run build && npm run test:visual
```

Para testar um deploy já publicado em vez do servidor local, passe `BASE_URL`:

```bash
BASE_URL=https://mapa-da-violencia-brasil.vercel.app npm run test:visual
```

Relatório em `playwright-report/` e capturas/trace em `test-results/` (ambos ignorados pelo git).

## Geração de assets (offline)

Os dados pesados são **assets JSON versionados**, gerados por scripts e commitados (o runtime não depende deles em rede):

```bash
# mapa oficial (CSV SINESP + população)
python3 -m etl.official_data generate-app-ready --write-samples

# lente 3 — homicídios ocultos (SIM/DATASUS; FTP pesado, fora do CI)
python3 etl/build_hidden_homicides.py --anos 2015-2024
```

Outros assets têm scripts em [`scripts/`](../scripts) (séries mensais, tiroteios/ISP do RJ, etc.).

## Deploy

Publicado na **Vercel** (Next.js). As variáveis de ambiente ficam **só** no painel da Vercel / `.env.local` — **nada de segredo é versionado**. A única flag pública que troca o modo de dados do mapa oficial:

```txt
NEXT_PUBLIC_CRIME_DATA_MODE=official_sample   # ou "demo" (qualquer outro valor cai em demo)
```

Detalhes: [docs/DEPLOY.md](DEPLOY.md) e [docs/VERCEL_OFFICIAL_SAMPLE_CHECKLIST.md](VERCEL_OFFICIAL_SAMPLE_CHECKLIST.md).

### Atualização dos dados (crons)

- **Vercel cron** (diário, rede de segurança): `vercel.json`.
- **GitHub Actions** (mais frequente): `.github/workflows/ingest-tiroteios.yml` (de hora em hora) e `ingest-osint.yml` (a cada 4h) — chamam os endpoints de ingestão autenticados por `CRON_SECRET` (secret do repo).

## Estrutura do projeto

```txt
src/app          Rotas Next.js: / (radar/home), /mapa, /radar, /noticias,
                 /comparar, /tendencias, /metodologia e /api/*
src/components   Dashboards e UI (radar, mapa, news, compare, trends, layout, painéis)
src/server       Lógica server-only: anomaly (3 lentes), osint (pipeline/IA), shootings (Fogo Cruzado)
src/data         Assets JSON versionados (séries, tiroteios, ISP-RJ, homicídios ocultos, municípios)
src/lib          Utilitários (formatação, cores, score, config do mapa)
src/services     Camada de leitura
src/types        Tipos compartilhados
etl              ETLs em Python (SINESP, SIM/DATASUS)
scripts          Geradores de assets e utilitários
supabase         Migrations (tabelas + RPCs)
docs             Documentação técnica e checklists
.github/workflows  CI + crons de ingestão
```

## Licença

GNU AGPL-3.0 — veja [LICENSE](../LICENSE). Detalhes de uso no [README](../README.md#-licença-e-direitos-de-uso).
