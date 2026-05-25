# Backlog Priorizado - Radar da Violencia Brasil

Data do plano: 2026-05-25

## P0 - Descoberta e fundacao

### Tarefa 1 - Confirmar granularidade do SINESP VDE

Escopo:

- Baixar ZIP VDE atual.
- Inspecionar arquivos internos.
- Confirmar colunas para UF, municipio, codigo IBGE, ano, mes, indicador e valor.

Aceite:

- Documento curto em `/docs/FONTES_DADOS.md` atualizado com colunas reais.
- Decisao registrada: SINESP serve ou nao serve para mapa municipal nacional no MVP.

### Tarefa 2 - Criar app base

Escopo:

- Next.js + TypeScript + Tailwind.
- Layout de dashboard.
- Dados mockados.

Aceite:

- App abre localmente.
- `npm run build` e `npm run lint` passam.

### Tarefa 3 - Criar contrato de tipos compartilhados

Escopo:

- Tipos para municipio, indicador, metrica, fonte, ranking e periodo.

Aceite:

- Frontend e API usam os mesmos tipos.

## P1 - Geografia e banco

### Tarefa 4 - Criar schema Supabase/PostGIS

Escopo:

- Migrations para tabelas em `ARQUITETURA.md`.
- Indices principais.
- Extensoes PostGIS, unaccent e pg_trgm quando necessario.

Aceite:

- Migration aplica localmente.
- RLS revisado para tabelas expostas.

### Tarefa 5 - Importar malha municipal IBGE

Escopo:

- Download controlado.
- Conversao para EPSG:4326.
- Validacao de geometrias.
- Insercao em `municipios`.

Aceite:

- 5.570 municipios esperados, salvo mudanca oficial documentada.
- Todo municipio tem `id_ibge`, nome, UF, centroide e bbox.

### Tarefa 6 - Gerar camada web simplificada

Escopo:

- TopoJSON/GeoJSON simplificado.
- Preservar `id_ibge`.
- Comprimir asset.

Aceite:

- Mapa renderiza em desktop e mobile.
- Asset fica dentro do limite definido pelo time.

## P1 - Dados e metricas

### Tarefa 7 - ETL populacao IBGE

Escopo:

- Baixar populacao municipal.
- Normalizar codigo IBGE.
- Inserir em `populacao_municipal`.

Aceite:

- Taxa por 100 mil pode ser calculada para municipios com populacao.

### Tarefa 8 - ETL SINESP MVP

Escopo:

- Baixar ZIP.
- Registrar arquivo bruto.
- Normalizar indicadores.
- Inserir ocorrencias.

Aceite:

- Carga idempotente.
- Erros de schema geram falha explicita.

### Tarefa 9 - Calculo de metricas

Escopo:

- `taxa_100k`.
- `score_0_100`.
- `nivel_risco`.
- variacoes mensal/anual.

Aceite:

- Testes unitarios cobrem formulas e edge cases.

## P1 - Mapa e interacao

### Tarefa 10 - MapCanvas com MapLibre

Escopo:

- Basemap.
- Camada de municipios.
- Cores por score.

Aceite:

- Brasil aparece inteiro no carregamento.
- Municipios recebem cor via `id_ibge`.

### Tarefa 11 - Zoom por estado

Escopo:

- Clique/selecionar UF.
- `fitBounds`.
- Breadcrumb.

Aceite:

- Fluxo Brasil -> UF funciona sem reload.

### Tarefa 12 - Selecao de municipio

Escopo:

- Clique no poligono.
- Highlight persistente.
- Drawer com dados.

Aceite:

- Fluxo UF -> Municipio funciona e carrega resumo.

### Tarefa 13 - Busca por municipio

Escopo:

- API de busca.
- Autocomplete.
- Zoom e abrir painel.

Aceite:

- Busca sem acento encontra municipio com acento.

## P2 - Painel analitico

### Tarefa 14 - Ranking

Escopo:

- Ranking nacional.
- Ranking estadual quando UF selecionada.

Aceite:

- Ordenacao correta por modo selecionado.

### Tarefa 15 - Serie temporal

Escopo:

- Endpoint de serie.
- Grafico simples no drawer.

Aceite:

- Serie aparece ordenada e com valores nulos tratados.

### Tarefa 16 - Status de fontes

Escopo:

- Badge no dashboard.
- Endpoint `/api/sources/status`.

Aceite:

- Usuario ve fonte, ultima coleta e ultimo periodo disponivel.

## P2 - Metodologia e confianca

### Tarefa 17 - Pagina `/metodologia`

Escopo:

- Texto responsavel.
- Formulas.
- Fontes.
- Limitações.

Aceite:

- Link visivel no dashboard.
- Conteudo corresponde a metodologia implementada.

### Tarefa 18 - Avisos contextuais

Escopo:

- Sem dados.
- Fonte parcial.
- Dados revisaveis.

Aceite:

- App nao confunde ausencia de dado com valor zero.

## P3 - Automacao e producao

### Tarefa 19 - Job de atualizacao

Escopo:

- GitHub Actions diario.
- Execucao manual permitida.
- Logs em `etl_execucoes`.

Aceite:

- Falhas ficam visiveis.
- Reexecucao nao duplica dados.

### Tarefa 20 - Cache e performance

Escopo:

- Cache API.
- Materialized views.
- Compressao de assets.

Aceite:

- Mapa carrega dentro do alvo de performance definido.

### Tarefa 21 - Deploy

Escopo:

- Vercel para app.
- Supabase para banco.
- Variaveis de ambiente.

Aceite:

- URL publica funcional.
- Nenhum segredo exposto.

## P3 - Conectores estaduais

### Tarefa 22 - Conector MG

Motivo:

- Fonte declara dados dos 853 municipios e CSVs por periodo.

Aceite:

- Descoberta CKAN lista CSVs anuais.
- Normalizacao inicial transforma `natureza` em indicadores canonicos.
- Dados de MG entram como fonte estadual prioritaria quando compativeis.

### Tarefa 23 - Conector RJ

Motivo:

- ISPDados tem historico e notas metodologicas.

Aceite:

- Conector aponta para `BaseMunicipioMensal.csv`.
- Normalizacao inicial transforma colunas largas em registros canonicos.
- Dados de RJ entram com metodologia documentada.

### Tarefa 24 - Conector SP

Motivo:

- Dados Abertos SP lista recursos da SSP e API CKAN.

Aceite:

- Conector usa CKAN para descobrir recursos oficiais.
- Normalizacao fica bloqueada ate escolher endpoint direto de download das consultas/paineis da SSP-SP.

### Tarefa 25 - Conector BA

Motivo:

- Dados Abertos BA publica dataset mensal de mortes violentas intencionais da SSP-BA.

Aceite:

- Descoberta CKAN encontra o CSV de mortes violentas.
- Normalizacao inicial transforma `GR_NATUREZA` em indicadores canonicos.
- `QT_VITIMAS` e tratado como vitimas, nao como ocorrencias genericas.

## Fora do MVP

- Microdados individuais.
- Login e area paga.
- Alertas em tempo real.
- Previsao de crime.
- Nivel bairro/endereco.
- Scraping de PDF como fonte principal.
- Fechar ou abrir PRs automaticamente.
- Criar branches sem pedido explicito.
