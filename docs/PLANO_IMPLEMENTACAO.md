# Plano de Implementacao - Radar da Violencia Brasil

Data do plano: 2026-05-25

## 1. Diagnostico do repositorio atual

- Caminho local: `/Users/lucaspassos/Documents/Mapa do crime`
- Branch atual: `main`
- Target branch/PR: nao informado
- Remote Git: nao configurado, portanto nao ha `git fetch` remoto aplicavel
- Status inicial: worktree limpo antes da criacao destes documentos
- Estrutura encontrada: repositorio Git vazio, sem app, sem `package.json`, sem backend, sem banco, sem ETL e sem testes
- Classificacao da tarefa: planejamento tecnico/documentacao
- Escopo desta entrega: criar apenas documentos de planejamento em `/docs`
- Fora de escopo nesta entrega: implementacao Next.js, migrations Supabase, ETL, download de dados, jobs, deploy, branch nova e PR

Como o repositorio esta vazio, a recomendacao e iniciar do zero com uma arquitetura modular, mas sem transformar o MVP em uma plataforma grande demais na primeira entrega.

## 2. Menor MVP funcional

O menor MVP que ainda prova o produto:

1. App web em Next.js com a tela principal do mapa.
2. Mapa do Brasil com municipios coloridos por um indicador.
3. GeoJSON/TopoJSON municipal simplificado como asset estatico no MVP.
4. Dados agregados por municipio, mes, indicador e fonte.
5. Filtro por indicador, periodo, UF e modo de calculo.
6. Ranking nacional/estadual.
7. Clique em estado para zoom.
8. Clique em municipio para painel lateral.
9. Busca por municipio/UF.
10. Pagina `/metodologia`.
11. API interna para mapa, ranking, busca, resumo municipal e status das fontes.
12. Pipeline documentado e pronto para automatizacao, mesmo que a primeira carga seja executada manualmente.

Pergunta que o MVP deve responder:

> Quais municipios apresentam maior incidencia registrada para determinado indicador e periodo?

## 3. Arquitetura proposta

```txt
Fontes oficiais
  -> ETL Python
  -> arquivos brutos versionados por checksum
  -> Supabase Postgres + PostGIS
  -> tabelas normalizadas e materialized views
  -> Next.js route handlers
  -> MapLibre GL no frontend
  -> dashboard publico na Vercel
```

### Stack recomendada

| Parte | Escolha | Justificativa |
| --- | --- | --- |
| Frontend | Next.js + TypeScript | App Router, API integrada, deploy simples na Vercel |
| Estilo | Tailwind CSS | Velocidade de composicao e consistencia visual |
| Mapa | MapLibre GL JS | Open source, sem dependencia obrigatoria de token comercial |
| Banco | Supabase Postgres | Postgres gerenciado com APIs, extensoes e boa ergonomia |
| Geoespacial | PostGIS | Consultas espaciais, geometrias, indices GIST e bbox |
| ETL | Python + pandas/geopandas | Melhor ecossistema para CSV/XLSX/SHP/GeoJSON |
| Agendamento | GitHub Actions inicialmente | Simples para jobs de coleta; Supabase/Vercel Cron depois |
| Tiles | GeoJSON simplificado no MVP; PMTiles/vector tiles depois | Comeca simples e deixa caminho de escala |
| Deploy | Vercel | Natural para Next.js e cache HTTP |

## 4. Estrutura inicial de pastas

```txt
/apps/web
  /src
    /app
      /page.tsx
      /metodologia/page.tsx
      /api
    /components
      /map
      /filters
      /panels
      /charts
      /layout
    /lib
      /api
      /db
      /map
      /scoring
      /formatters
    /types
    /styles

/packages/shared
  /types
  /schemas
  /constants

/etl
  /sources
    mjsp_sinesp.py
    ibge_malha.py
    ibge_populacao.py
    rj_ispdados.py
    sp_ssp.py
    mg_seguranca.py
  /transforms
  /loaders
  /validators
  /jobs
  /tests
  requirements.txt

/supabase
  /migrations
  /seed.sql

/data
  /raw
  /processed
  /geo

/docs
  PLANO_IMPLEMENTACAO.md
  ARQUITETURA.md
  FONTES_DADOS.md
  METODOLOGIA.md
  BACKLOG.md
  DECISOES_TECNICAS.md
```

Notas:

- `/data/raw`, `/data/processed` e downloads grandes devem ficar no `.gitignore`.
- Assets geograficos pequenos e simplificados podem ser versionados se ficarem abaixo de um limite acordado.
- Se o projeto continuar pequeno no MVP, um monorepo pode ser adiado. A estrutura acima ja prepara a evolucao sem exigir todos os pacotes no primeiro commit.

## 5. Fases de implementacao

### Fase 0 - Descoberta tecnica

Tarefas:

- Confirmar arquivos publicos atuais do MJSP/SINESP.
- Baixar uma amostra do ZIP VDE e inspecionar colunas.
- Baixar uma amostra da malha municipal IBGE.
- Confirmar formato da populacao municipal IBGE.
- Verificar se o SINESP VDE tem granularidade municipal suficiente para o MVP nacional.
- Definir indicador padrao: `indice_geral` se houver base suficiente, senao `homicidio_doloso` por taxa.

Critérios de aceite:

- Fontes iniciais confirmadas.
- Documento de arquitetura aprovado.
- Riscos de granularidade mapeados.

### Fase 1 - Base do app

Tarefas:

- Criar app Next.js + TypeScript + Tailwind.
- Criar layout principal de dashboard.
- Criar `MapCanvas`, `FiltersPanel`, `RankingPanel`, `Legend`, `DataStatusBadge`.
- Criar rota `/metodologia`.
- Criar dados mockados para validar fluxo visual sem depender do ETL.

Critérios de aceite:

- `npm run build` passa.
- `npm run lint` passa.
- Tela abre localmente com layout base e estados vazios tratados.

### Fase 2 - Banco e geografia

Tarefas:

- Criar migrations Supabase.
- Ativar PostGIS.
- Criar tabelas principais.
- Importar municipios IBGE.
- Calcular centroide e bbox.
- Gerar GeoJSON/TopoJSON simplificado para frontend.

Critérios de aceite:

- Banco contem municipios com `id_ibge`, UF, nome, geometria, centroide e bbox.
- Mapa desenha municipios ou camada simplificada.

### Fase 3 - Dados criminais MVP

Tarefas:

- Criar conector SINESP/MJSP.
- Salvar arquivo bruto com checksum.
- Validar schema.
- Normalizar indicadores.
- Associar municipio por `id_ibge` quando disponivel; usar nome+UF apenas como fallback auditavel.
- Calcular taxa por 100 mil.
- Calcular score.

Critérios de aceite:

- Tabelas normalizadas contem ocorrencias por periodo/indicador.
- Endpoint de mapa retorna `score_0_100` e `nivel_risco`.

### Fase 4 - Mapa dinamico

Tarefas:

- Integrar MapLibre.
- Centralizar Brasil no load.
- Aplicar cores por score.
- Implementar hover, tooltip e selecao.
- Implementar clique estado -> `fitBounds`.
- Implementar clique municipio -> drawer.
- Implementar breadcrumb.

Critérios de aceite:

- Usuario faz o fluxo Brasil -> Estado -> Municipio.
- Cores mudam ao trocar indicador/periodo.
- Tooltip e painel nao sobrepoem controles em desktop/mobile.

### Fase 5 - Paineis e ranking

Tarefas:

- Painel lateral de municipio.
- Ranking nacional/estadual.
- Serie temporal.
- Comparacao com media estadual.
- Status da fonte e ultimo periodo disponivel.

Critérios de aceite:

- Ranking atualiza conforme filtros.
- Painel mostra fonte, periodo, taxa, score, variacao mensal/anual e aviso metodologico.

### Fase 6 - Automacao

Tarefas:

- Job diario para verificar novas fontes.
- Carga idempotente.
- Log em `etl_execucoes`.
- Alertas para mudanca de schema.
- Atualizacao de materialized views/cache.

Critérios de aceite:

- Rodar o job duas vezes nao duplica dados.
- Falha fica registrada.
- App mostra ultima coleta e ultimo periodo realmente disponivel.

### Fase 7 - Producao do MVP

Tarefas:

- Responsividade mobile.
- Acessibilidade da legenda.
- Cache HTTP.
- Observabilidade basica.
- Deploy na Vercel.
- Revisao de licencas das fontes.

Critérios de aceite:

- MVP demonstravel publicamente.
- Pagina de metodologia publicada.
- Build, lint, testes e fluxo E2E passam.

### Fase 8 - Evolucao

Tarefas:

- Conectores RJ, SP, MG e BA.
- Vector tiles/PMTiles.
- Comparacao entre municipios.
- Alertas de aumento incomum.
- Exportacao CSV.
- API publica.
- Autenticacao e planos privados, se o produto evoluir nessa direcao.

## 6. Tarefas que devem vir primeiro

1. Validar se o arquivo SINESP VDE atual traz municipio, UF, mes, ano e indicador suficientes.
2. Criar o app base com dados mockados e componentes principais.
3. Processar malha municipal simplificada.
4. Criar schema Supabase/PostGIS.
5. Implementar endpoint de mapa com mock ou seed.
6. Integrar MapLibre.
7. Implementar ETL SINESP.
8. Substituir mock por dados reais.
9. Adicionar metodologia e status de fontes.
10. Rodar validacao completa antes de qualquer release.

## 7. Critérios finais de aceite do MVP

- Site abre e mostra o mapa do Brasil.
- Municipios aparecem coloridos por degrade.
- Legenda explica a escala.
- Usuario troca indicador e periodo.
- Usuario clica em estado e recebe zoom automatico.
- Usuario clica em municipio e ve painel detalhado.
- Busca por cidade funciona.
- Ranking funciona.
- Fonte, ultima coleta e ultimo periodo disponivel aparecem.
- Taxa por 100 mil habitantes funciona.
- Pagina de metodologia existe.
- Pipeline inicial esta documentado e tem ao menos execucao manual reprodutivel.
- Deploy funcional.

## 8. Validacao antes de pronto/merge

Quando houver codigo, a validacao padrao deve ser:

```bash
npm ci
git diff --check
npm run lint
npm run test
npm run build
```

Validacoes adicionais:

- Testes unitarios de scoring e taxa.
- Testes de schema dos CSV/XLSX.
- Teste E2E do fluxo Brasil -> Estado -> Municipio.
- Inspecao visual em desktop e mobile.
