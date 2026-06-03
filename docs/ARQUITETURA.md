# Arquitetura - Mapa da Violencia Brasil

Data do plano: 2026-05-25

## 1. Visao geral

O sistema deve separar claramente quatro responsabilidades:

1. Coleta e normalizacao de dados oficiais.
2. Persistencia geoespacial e temporal.
3. APIs otimizadas para mapa/dashboard.
4. Interface interativa centrada no mapa.

```txt
SINESP / IBGE / fontes estaduais
  -> ETL Python
  -> Supabase Storage ou filesystem para arquivos brutos
  -> Supabase Postgres + PostGIS
  -> materialized views e endpoints Next.js
  -> MapLibre + paineis React
```

## 2. Componentes frontend

### `MapCanvas`

Responsavel por:

- Inicializar MapLibre.
- Carregar camada base.
- Carregar municipios simplificados.
- Aplicar cor por `score_0_100`, `taxa_100k` ou `ocorrencias`.
- Controlar hover, clique e destaque persistente.
- Executar `fitBounds` para Brasil, UF e municipio.

### `FiltersPanel`

Controles:

- Indicador.
- Periodo.
- UF.
- Modo: `total`, `taxa_100k`, `indice_geral`.
- Visualizacao: score, valor absoluto, variacao mensal/anual.

### `Legend`

Mostra:

- Escala cromatica.
- Limites numericos do periodo atual.
- Explicacao curta: "incidencia registrada", nao "perigo absoluto".

### `RankingPanel`

Mostra:

- Top 20 nacional ou estadual.
- Municipio, UF, valor, taxa, score, variacao.
- Clique no item faz zoom e abre painel.

### `CityDetailsDrawer`

Mostra:

- Municipio e UF.
- Populacao usada.
- Ocorrencias e vitimas.
- Taxa por 100 mil.
- Score 0-100.
- Nivel do indicador.
- Variacao mensal e anual.
- Ranking estadual e nacional.
- Fonte prioritaria.
- Ultima atualizacao.
- Serie temporal.

### `StateSummaryPanel`

Mostra:

- Media estadual.
- Quantidade de municipios com dados.
- Top municipios.
- Ultimo periodo disponivel para a UF.

### `Breadcrumb`

Estados:

- `Brasil`
- `Brasil > PE`
- `Brasil > PE > Recife`

### `SearchBox`

Autocomplete:

- Municipio.
- UF.
- Codigo IBGE, opcional para usuario avancado.

### `TimelineSlider`

Controles:

- Mes/ano.
- Opcionalmente trimestre/ano na evolucao futura.

### `DataStatusBadge`

Mostra:

- Fonte ativa.
- Ultima coleta.
- Ultimo periodo disponivel.
- Status: `oficial`, `revisado`, `parcial`, `sem_dados`.

### `MethodologyLink`

Link fixo para `/metodologia`, visivel no dashboard.

## 3. Modelo de dados

Nomes em portugues para tabelas de dominio. Tipos aproximados para Postgres/Supabase.

```sql
create table fontes (
  id bigint generated always as identity primary key,
  nome text not null,
  tipo text not null check (tipo in ('nacional','estadual','ibge','manual')),
  uf char(2),
  url text not null,
  frequencia_esperada text,
  ultima_coleta_em timestamptz,
  ultimo_periodo_disponivel date,
  status text not null default 'pendente',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table etl_execucoes (
  id bigint generated always as identity primary key,
  fonte_id bigint not null references fontes(id),
  iniciou_em timestamptz not null default now(),
  terminou_em timestamptz,
  status text not null check (status in ('rodando','sucesso','falha','parcial')),
  linhas_lidas integer default 0,
  linhas_inseridas integer default 0,
  linhas_atualizadas integer default 0,
  erro text,
  checksum_arquivo text,
  metadata jsonb not null default '{}'::jsonb
);

create table arquivos_brutos (
  id bigint generated always as identity primary key,
  fonte_id bigint not null references fontes(id),
  url_origem text not null,
  caminho_storage text not null,
  formato text not null,
  checksum text not null,
  data_download timestamptz not null default now(),
  periodo_referencia_inicio date,
  periodo_referencia_fim date,
  unique (fonte_id, checksum)
);

create table municipios (
  id_ibge char(7) primary key,
  nome text not null,
  uf char(2) not null,
  nome_uf text not null,
  regiao text,
  populacao_atual integer,
  centroid_lat double precision,
  centroid_lng double precision,
  bbox jsonb,
  geom geometry(MultiPolygon, 4326),
  updated_at timestamptz not null default now()
);

create table populacao_municipal (
  id_ibge char(7) not null references municipios(id_ibge),
  ano integer not null,
  populacao integer not null check (populacao > 0),
  fonte_id bigint not null references fontes(id),
  created_at timestamptz not null default now(),
  primary key (id_ibge, ano)
);

create table indicadores_crime (
  codigo text primary key,
  nome text not null,
  categoria text not null,
  descricao text,
  peso_indice_geral numeric(6,2) not null default 1,
  ativo boolean not null default true,
  unidade_padrao text not null default 'ocorrencias'
);

create table ocorrencias_crime (
  id bigint generated always as identity primary key,
  id_ibge char(7) references municipios(id_ibge),
  uf char(2) not null,
  ano integer not null,
  mes integer not null check (mes between 1 and 12),
  indicador_codigo text not null references indicadores_crime(codigo),
  ocorrencias integer not null check (ocorrencias >= 0),
  vitimas integer check (vitimas >= 0),
  fonte_id bigint not null references fontes(id),
  nivel_geografico text not null check (nivel_geografico in ('municipio','uf','brasil')),
  data_publicacao date,
  data_ingestao timestamptz not null default now(),
  qualidade_status text not null default 'nao_validado',
  raw_payload jsonb not null default '{}'::jsonb,
  unique (
    fonte_id,
    nivel_geografico,
    coalesce(id_ibge, ''),
    uf,
    ano,
    mes,
    indicador_codigo
  )
);

create table metricas_municipais_mensais (
  id_ibge char(7) not null references municipios(id_ibge),
  ano integer not null,
  mes integer not null check (mes between 1 and 12),
  indicador_codigo text not null references indicadores_crime(codigo),
  ocorrencias integer not null default 0,
  vitimas integer,
  populacao_usada integer,
  taxa_100k numeric(12,4),
  variacao_mes_pct numeric(12,4),
  variacao_ano_pct numeric(12,4),
  percentil_nacional numeric(8,4),
  percentil_estadual numeric(8,4),
  score_0_100 numeric(6,2),
  nivel_risco text,
  fonte_prioritaria_id bigint references fontes(id),
  updated_at timestamptz not null default now(),
  primary key (id_ibge, ano, mes, indicador_codigo)
);

create table indice_violencia_municipal (
  id_ibge char(7) not null references municipios(id_ibge),
  ano integer not null,
  mes integer not null check (mes between 1 and 12),
  indice_geral_0_100 numeric(6,2) not null,
  nivel_risco text not null,
  componentes jsonb not null,
  metodologia_versao text not null,
  updated_at timestamptz not null default now(),
  primary key (id_ibge, ano, mes, metodologia_versao)
);
```

Observacao: Postgres nao permite `coalesce` diretamente em `unique` de tabela como constraint simples em todos os formatos. Na implementacao, usar indice unico por expressao ou coluna gerada para a chave logica de `ocorrencias_crime`.

## 4. Indices

Migration inicial versionada:

```txt
supabase/migrations/20260602120000_initial_public_safety_schema.sql
```

Ela cria as tabelas principais, habilita PostGIS, RLS e views publicas de leitura agregada. A migration ainda precisa ser aplicada e validada com Supabase CLI/MCP em um projeto real antes de producao.

### Geoespaciais

```sql
create index municipios_geom_gist_idx on municipios using gist (geom);
```

Usar para:

- bbox de estado/municipio;
- consultas espaciais futuras;
- simplificacao/tiles gerados a partir do banco.

### Filtros temporais e de indicador

```sql
create index ocorrencias_periodo_indicador_idx
  on ocorrencias_crime (ano, mes, indicador_codigo);

create index ocorrencias_uf_periodo_idx
  on ocorrencias_crime (uf, ano, mes);

create index metricas_periodo_indicador_idx
  on metricas_municipais_mensais (ano, mes, indicador_codigo);

create index metricas_uf_join_idx
  on municipios (uf, id_ibge);

create index metricas_score_idx
  on metricas_municipais_mensais (ano, mes, indicador_codigo, score_0_100 desc);
```

### Busca

Adicionar `unaccent` e `pg_trgm` quando implementar busca textual:

```sql
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
```

Indice recomendado:

```sql
create index municipios_nome_trgm_idx
  on municipios using gin (lower(nome) gin_trgm_ops);
```

## 5. Materialized views

Criar materialized views quando a carga real existir:

```sql
create materialized view mv_mapa_municipios_periodo as
select
  m.id_ibge,
  m.nome,
  m.uf,
  mm.ano,
  mm.mes,
  mm.indicador_codigo,
  mm.ocorrencias,
  mm.taxa_100k,
  mm.score_0_100,
  mm.nivel_risco,
  mm.fonte_prioritaria_id
from municipios m
left join metricas_municipais_mensais mm on mm.id_ibge = m.id_ibge;
```

Atualizar apos cada ETL bem-sucedido:

```sql
refresh materialized view concurrently mv_mapa_municipios_periodo;
```

Requisito: criar indice unico compativel antes de usar `concurrently`.

## 6. Regras para duplicidade e precedencia

- Arquivos brutos: unicidade por `fonte_id + checksum`.
- Ocorrencias normalizadas: unicidade logica por fonte, nivel geografico, municipio/UF, periodo e indicador.
- Metricas: chave primaria por municipio, periodo e indicador.
- Se fonte estadual e nacional cobrirem o mesmo indicador/periodo/municipio, gravar ambas em `ocorrencias_crime` e escolher a fonte prioritaria em `metricas_municipais_mensais`.
- Mostrar a fonte prioritaria no app e manter auditoria das demais fontes.

Precedencia inicial:

1. Fonte estadual oficial com municipio e metodologia documentada.
2. SINESP/MJSP com municipio.
3. SINESP/MJSP por UF, usado apenas para paineis agregados, nao para pintar municipio individual.
4. Dado manual apenas para seed/demo, sempre marcado como `manual`.

## 7. Municipios sem dados

Tratar como categoria visual separada, nao como zero.

- `sem_dados`: sem registro da fonte para aquele municipio/periodo.
- `zero_registrado`: fonte informa explicitamente 0.
- `nao_aplicavel`: indicador nao existe para a fonte/periodo.

No mapa:

- Sem dados: cinza neutro com hachura ou opacidade reduzida.
- Zero registrado: cor mais baixa da escala.
- Tooltip deve diferenciar os dois casos.

## 8. Mudancas territoriais e codigos IBGE

Plano:

- Usar `id_ibge` de 7 digitos como chave principal.
- Armazenar ano da malha usada.
- Criar tabela futura `municipios_historico_codigos` se houver mudanca territorial relevante.
- Nunca juntar fonte por nome sem registrar confianca da associacao.

Tabela futura:

```sql
create table municipios_historico_codigos (
  id bigserial primary key,
  id_ibge_atual char(7),
  id_ibge_anterior char(7),
  nome_anterior text,
  uf char(2),
  valido_de date,
  valido_ate date,
  observacao text
);
```

## 9. Endpoints

### `GET /api/health`

Resposta:

```json
{ "status": "ok", "version": "0.1.0" }
```

Cache: `no-store`.

Erros: `500` se banco/API critica indisponivel.

Aceite: retorna `200` em ambiente local e deploy.

### `GET /api/metadata`

Query params: nenhum.

Resposta:

```json
{
  "indicadores": [{ "codigo": "homicidio_doloso", "nome": "Homicidio doloso" }],
  "periodos": [{ "ano": 2026, "mes": 4 }],
  "ufs": [{ "uf": "PE", "nome": "Pernambuco" }],
  "modos": ["total", "taxa_100k", "indice_geral"]
}
```

Cache: 1 hora, revalidar apos ETL.

Aceite: frontend consegue montar filtros sem valores hardcoded.

### `GET /api/sources/status`

Resposta:

```json
{
  "fontes": [
    {
      "nome": "SINESP/MJSP",
      "status": "oficial",
      "ultimaColeta": "2026-05-25T10:00:00Z",
      "ultimoPeriodoDisponivel": "2026-04"
    }
  ]
}
```

Cache: 5 minutos.

Aceite: dashboard mostra status real das fontes.

### `GET /api/map/municipios`

Query params:

- `ano`: inteiro obrigatorio.
- `mes`: inteiro 1-12 obrigatorio.
- `indicador`: codigo obrigatorio.
- `modo`: `total`, `taxa_100k`, `score`, `indice_geral`.
- `uf`: opcional.

Resposta:

```json
{
  "periodo": { "ano": 2026, "mes": 4 },
  "indicador": "indice_geral",
  "modo": "score",
  "fonteResumo": {
    "nome": "SINESP/MJSP",
    "ultimaAtualizacao": "2026-05-25",
    "ultimoPeriodoDisponivel": "2026-04"
  },
  "items": [
    {
      "id_ibge": "2611606",
      "municipio": "Recife",
      "uf": "PE",
      "valor": 82.4,
      "taxa_100k": 31.2,
      "score_0_100": 82,
      "nivel_risco": "critico"
    }
  ]
}
```

Validacao: rejeitar indicador inexistente, mes fora de faixa e ano fora da janela disponivel.

Cache: 15 minutos com tag por periodo/indicador.

Erros: `400` parametros invalidos, `404` periodo sem dados, `500` erro de banco.

Aceite: retorna ate 5.570 itens nacionais em payload compacto.

### `GET /api/ranking`

Query params:

- `ano`, `mes`, `indicador`, `modo`
- `uf`: opcional
- `limit`: padrao 20, maximo 100

Aceite: ordena por valor do modo selecionado e exclui `sem_dados`.

### `GET /api/municipios/search`

Query params:

- `q`: texto obrigatorio, minimo 2 caracteres

Resposta:

```json
{
  "items": [
    {
      "id_ibge": "2611606",
      "municipio": "Recife",
      "uf": "PE",
      "centroid": [-34.877, -8.047],
      "bbox": [-35.05, -8.20, -34.80, -7.90]
    }
  ]
}
```

Cache: 24 horas.

Aceite: busca sem acento encontra municipio com acento.

### `GET /api/municipios/:id_ibge/summary`

Query params:

- `ano`, `mes`

Aceite: retorna dados do painel lateral para todos os indicadores ativos.

### `GET /api/municipios/:id_ibge/timeseries`

Query params:

- `indicador`
- `from`: `YYYY-MM`
- `to`: `YYYY-MM`

Aceite: retorna serie mensal ordenada ascendente.

### `GET /api/estados/:uf/summary`

Query params:

- `ano`, `mes`
- `indicador`

Aceite: retorna resumo estadual e ranking estadual.

### `GET /api/methodology`

Resposta: JSON com versao da metodologia, pesos e fonte textual. A pagina `/metodologia` pode usar conteudo estatico ou esse endpoint.

## 10. Estrategia de mapa

### MVP

- Usar GeoJSON ou TopoJSON simplificado.
- Geometria como asset estatico.
- Metricas carregadas separadamente por API.
- Join client-side por `id_ibge`.
- Usar `feature-state` ou propriedade promovida (`promoteId`) para atualizar cores sem recarregar geometria.

### Producao

- Gerar vector tiles com Tippecanoe.
- Empacotar em PMTiles ou MBTiles.
- Servir via CDN/storage.
- Usar MapLibre com source vetorial.
- Manter metricas em API compacta.

## 11. Performance

- 5.570 municipios e viavel no MVP se a geometria for simplificada.
- Alvo de asset geografico inicial: idealmente abaixo de 5 MB gzip.
- Simplificar geometrias por zoom.
- Evitar recalculo de score no navegador.
- Cachear `/api/map/municipios` por periodo/indicador/modo/UF.
- Precalcular rankings e scores no banco.
- Usar suspense/loading states no frontend.
- Em mobile, colapsar filtros e ranking em drawers/tabs.

## 12. Seguranca

- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- Apenas chaves publicas com escopo correto no browser.
- Route handlers fazem consultas server-side quando exigirem permissao elevada.
- RLS habilitado em tabelas expostas.
- Views publicas com `security_invoker = true` quando aplicavel.
- Rate limit em endpoints publicos.
- Logs sem dados pessoais.
- Dados agregados por municipio/mes/indicador.
