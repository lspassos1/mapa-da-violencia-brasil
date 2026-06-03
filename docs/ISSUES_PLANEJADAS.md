# Issues Planejadas

Este documento registra pendencias reais apos a estabilizacao da amostra oficial.
Cada item deve virar issue executavel antes de nova rodada de implementacao.

## Issue - Padronizar Node/npm local, CI e Vercel

Contexto: o projeto espera Node.js 22.x e npm >= 10, mas esta sessao Codex tinha
`node` embutido em `/Applications/Codex.app/Contents/Resources/node` e nao tinha
`npm` no `PATH`.

Objetivo: alinhar versao local, CI e Vercel para reduzir falhas de SWC e build.

Escopo:

- Validar `.nvmrc`.
- Confirmar `engines` em `package.json`.
- Confirmar Node do GitHub Actions.
- Confirmar Node configurado na Vercel.
- Documentar instalacao local com `nvm use` e `npm ci`.

Fora de escopo: trocar framework, trocar package manager ou mexer em features.

Arquivos provaveis: `.nvmrc`, `package.json`, `.github/workflows/ci.yml`,
`README.md`, `docs/RETOMADA_LOCAL.md`, `docs/DEPLOY.md`.

Criterios de aceite:

- `node -v` local mostra Node 22.x.
- `npm -v` local mostra npm >= 10.
- CI usa `.nvmrc`.
- Vercel esta alinhada com a mesma major.
- README explica fallback quando `npm` nao existe no `PATH`.

Validacao: `npm ci`, `npm run validate`, `bash scripts/validate-local.sh`.

Dependencias: acesso ao ambiente local e painel/configuracao da Vercel.

## Issue - Retomar download e inspecao completa da Base VDE

Contexto: o VDE foi visto apenas como `.part` incompleto. Nenhum schema deve ser
assumido a partir desse arquivo parcial.

Objetivo: baixar o ZIP completo e descobrir se a base traz multiplos indicadores
municipais.

Escopo:

- Retomar download com timeout/retries.
- Conferir checksum/tamanho.
- Inspecionar arquivos internos.
- Registrar colunas reais.
- Confirmar municipio, codigo IBGE, periodo, indicador e valor.

Fora de escopo: integrar VDE ao app antes da inspecao completa.

Arquivos provaveis: `etl/official_data.py`, `etl/tests/test_official_data.py`,
`docs/FONTES_DADOS.md`, `docs/DADOS_REAIS_OFFLINE.md`,
`etl/samples/sinesp_vde_inspection_status.sample.json`.

Criterios de aceite:

- ZIP completo disponivel apenas em `data/raw/`.
- `.part` nao versionado.
- Documento registra schema real.
- Decisao explicita: VDE serve ou nao para MVP municipal multi-indicador.

Validacao:

```bash
python3 -m etl.official_data fetch-sinesp-vde --timeout 900 --retries 5 --backoff-seconds 5 --write-samples
python3 -m etl.official_data inspect-vde --write-samples
git diff --check
```

Dependencias: internet estavel e disponibilidade do portal SINESP/MJSP.

## Issue - Integrar `official_sample` no app por feature flag

Contexto: a amostra oficial ja existe e o app seleciona camada via
`NEXT_PUBLIC_CRIME_DATA_MODE`, mas a troca de produto precisa ser tratada como
decisao controlada.

Objetivo: expor a camada oficial inicial sem remover o fallback demo.

Escopo:

- Revisar default da feature flag.
- Garantir copy clara de `official_sample`.
- Garantir fallback `demo`.
- Validar filtros disponiveis quando ha apenas `homicidio_doloso`.

Fora de escopo: depender exclusivamente de dado real, Supabase ou VDE.

Arquivos provaveis: `src/services/crimeDataService.ts`,
`src/components/CrimeDashboard.tsx`, `src/components/panels/*`,
`src/app/api/*`, `README.md`, `docs/METODOLOGIA.md`.

Criterios de aceite:

- `official_sample` aparece claramente na UI e APIs.
- `NEXT_PUBLIC_CRIME_DATA_MODE=demo` ainda funciona.
- Nao aparecem indicadores sem fonte oficial na camada oficial.
- Nao ha confusao entre amostra oficial e carga nacional completa.

Validacao: lint, typecheck, testes de contrato, smoke HTTP e validacao visual.

Dependencias: decisao de produto sobre default da flag.

## Issue - Validar visualmente o app depois do official sample

Contexto: o Browser visual check falhou/bloqueou nesta maquina na etapa
anterior.

Objetivo: confirmar que UI, mapa, filtros, ranking e paineis continuam coerentes
com a amostra oficial.

Escopo:

- Abrir o app local em desktop e mobile.
- Conferir que o mapa nao fica vazio.
- Conferir aviso de amostra oficial.
- Conferir filtros com apenas um indicador.
- Conferir municipio e ranking.
- Conferir metodologia.

Fora de escopo: redesenhar UI ou integrar novas fontes.

Arquivos provaveis: `src/components/CrimeDashboard.tsx`,
`src/components/map/*`, `src/components/panels/*`, `src/app/page.tsx`,
`src/app/metodologia/page.tsx`.

Criterios de aceite:

- Primeira tela renderiza sem sobreposicao.
- Mapa mostra pontos da camada ativa.
- Ranking bate com API.
- Painel de municipio abre.
- Badges de fonte e periodo sao compreensiveis.

Validacao: screenshot desktop/mobile e smoke HTTP.

Dependencias: dev server local funcionando.

## Issue - Aplicar/testar migration Supabase localmente

Contexto: a migration inicial foi criada, mas nao aplicada porque a Supabase CLI
nao estava instalada.

Objetivo: validar o schema em stack local antes de qualquer ambiente remoto.

Escopo:

- Instalar Supabase CLI.
- Rodar `supabase --help` e confirmar comandos da versao.
- Subir stack local.
- Aplicar migration.
- Rodar advisors/lint disponiveis.
- Registrar resultado.

Fora de escopo: aplicar migration em projeto remoto ou producao.

Arquivos provaveis: `supabase/migrations/20260602120000_initial_public_safety_schema.sql`,
`docs/SUPABASE_SCHEMA.md`, `docs/RETOMADA_LOCAL.md`.

Criterios de aceite:

- Migration aplica localmente.
- RLS permanece habilitado.
- Views funcionam.
- Indices e constraints sao criados.
- Falhas ficam documentadas.

Validacao: `supabase db reset`, `supabase migration list --local`, queries
simples em tabelas/views e advisors/lint disponiveis na CLI instalada.

Dependencias: Supabase CLI, Docker e ambiente local com recursos suficientes.

## Issue - Criar seed SQL ou importador Supabase para homicidio doloso

Contexto: existe amostra JSON app-ready, mas ainda nao ha caminho de carga para
popular o schema Supabase.

Objetivo: criar um seed ou importador idempotente para `homicidio_doloso`.

Escopo:

- Inserir fonte SINESP/MJSP.
- Inserir indicador canonico.
- Inserir municipios/populacao necessarios para fixture.
- Inserir ocorrencias e metricas.
- Registrar execucao ETL.

Fora de escopo: carga nacional completa sem validacao local previa.

Arquivos provaveis: `etl/official_data.py`, `etl/tests/test_official_data.py`,
`supabase/seed.sql`, `supabase/migrations/*`, `docs/SUPABASE_SCHEMA.md`.

Criterios de aceite:

- Seed/importador pode rodar mais de uma vez sem duplicar dados.
- Contagens esperadas batem com fixture.
- `zero_registrado` e `sem_dados` continuam distintos.
- Nenhum microdado ou dado pessoal e inserido.

Validacao: testes ETL, queries locais e diff limpo apos reexecucao.

Dependencias: migration Supabase aplicada localmente.

## Issue - Adicionar GeoJSON real de UFs

Contexto: o app usa bounds simplificados para UFs. Uma camada real de UFs melhora
navegacao sem o custo dos municipios completos.

Objetivo: adicionar geometria real e leve de UFs para a experiencia Brasil ->
Estado.

Escopo:

- Obter fonte oficial ou confiavel.
- Simplificar geometria para web.
- Preservar sigla UF.
- Documentar fonte/licenca.
- Validar tamanho do asset.

Fora de escopo: poligonos municipais completos.

Arquivos provaveis: `src/data/geo/*`, `src/data/stateGeometries.ts`,
`src/services/geoService.ts`, `docs/FONTES_DADOS.md`.

Criterios de aceite:

- UFs renderizam corretamente.
- Asset permanece pequeno.
- `fitBounds` funciona por UF.
- Fonte e licenca documentadas.

Validacao: build, smoke, validacao visual desktop/mobile e checagem de tamanho.

Dependencias: escolha de fonte geografica e politica de versionamento de assets.

## Issue - Planejar poligonos municipais simplificados/PMTiles

Contexto: centroides servem para MVP, mas a leitura territorial exige malha
municipal simplificada ou tiles.

Objetivo: escolher abordagem tecnica para municipios em escala nacional.

Escopo:

- Comparar GeoJSON simplificado, TopoJSON, vector tiles e PMTiles.
- Definir limites de tamanho/performance.
- Preservar `id_ibge`.
- Planejar pipeline de simplificacao.

Fora de escopo: implementar a malha completa sem decisao de arquitetura.

Arquivos provaveis: `docs/ARQUITETURA.md`, `docs/PROXIMAS_ETAPAS.md`,
`src/data/geo/README.md`, scripts futuros de geoprocessamento.

Criterios de aceite:

- Decisao registrada.
- Tradeoffs documentados.
- Pipeline futuro tem entradas/saidas claras.
- Plano contempla desktop e mobile.

Validacao: prototipo pequeno, medicao de tamanho e teste visual.

Dependencias: fonte de malha municipal e ferramentas de simplificacao.

## Issue - Reforcar metodologia publica para dados oficiais parciais

Contexto: a primeira camada oficial e uma amostra estreita; o produto precisa
evitar leituras indevidas.

Objetivo: explicar de forma publica o que a amostra cobre, o que nao cobre e
como interpretar ausencia de dados.

Escopo:

- Atualizar `/metodologia`.
- Explicar `official_sample`.
- Explicar `sem_dados` vs `zero_registrado`.
- Explicar unidade `vitimas`.
- Explicar uso temporario de populacao IBGE 2025 para taxas.

Fora de escopo: prometer cobertura nacional completa antes da carga real.

Arquivos provaveis: `src/app/metodologia/page.tsx`, `docs/METODOLOGIA.md`,
`README.md`, `docs/DADOS_REAIS_OFFLINE.md`.

Criterios de aceite:

- Usuario entende que e amostra oficial.
- Usuario entende limitacoes de periodo/cobertura.
- Metodologia nao mistura dados demonstrativos com dado oficial.
- Linguagem evita ranking definitivo em cima de amostra parcial.

Validacao: revisao textual, smoke da pagina `/metodologia` e checagem visual.

Dependencias: decisao de produto sobre copy final.
