# Supabase/PostGIS Schema

Status: migration criada, nao aplicada.

Migration atual:

```txt
supabase/migrations/20260602120000_initial_public_safety_schema.sql
```

## Objetivo

Esta migration prepara o primeiro schema relacional para dados publicos e
agregados de seguranca publica, com suporte futuro a geometrias municipais via
PostGIS.

Ela existe para receber cargas auditaveis depois que os arquivos oficiais forem
normalizados localmente. Nesta fase, o app ainda nao depende de Supabase em
producao.

## Escopo da migration

- Schema `extensions` para extensoes Postgres.
- Extensoes `postgis`, `unaccent` e `pg_trgm`.
- Tabelas de fontes, execucoes ETL e arquivos brutos.
- Tabelas de municipios, populacao municipal, indicadores, ocorrencias e
  metricas mensais.
- Indices para geometria, UF, periodo, indicador, nome municipal e ranking por
  score.
- Views publicas para status de fontes e mapa municipal por periodo.
- RLS habilitado nas tabelas publicas.
- Politicas publicas de leitura para dados agregados.
- Seed inicial do indicador `homicidio_doloso`, medido em `vitimas`.

## Revisao estatica

O arquivo foi revisado sem aplicar a migration:

- As chaves principais preservam `id_ibge` como chave geografica.
- `ocorrencias_crime` diferencia `valor`, `ocorrencias`, `vitimas` e
  `unidade_medida`.
- `metricas_municipais_mensais` diferencia `sem_dados`,
  `zero_registrado`, `populacao_indisponivel` e `nao_aplicavel`.
- As views usam `security_invoker = true`.
- RLS esta habilitado nas tabelas em `public`.
- A geometria municipal esta modelada como `MultiPolygon, 4326`.

## Como aplicar futuramente

Pre-requisitos:

- Instalar Supabase CLI.
- Confirmar a versao com `supabase --version`.
- Consultar `supabase --help` e os subcomandos relevantes antes de executar,
  porque a CLI muda com frequencia.
- Ter Docker disponivel para validacao local, se for usar o stack local.
- Nunca apontar esta etapa diretamente para producao.

Fluxo local sugerido:

```bash
supabase --version
supabase --help
supabase start
supabase migration list --local
supabase db reset
supabase migration list --local
```

Depois da aplicacao local:

```bash
supabase db diff --local
supabase db lint --local
```

Se a CLI instalada nao oferecer algum comando acima, consultar o `--help` da
propria versao e registrar a alternativa usada.

## Riscos

- Tabelas no schema `public` podem ser expostas pela Data API dependendo da
  configuracao do projeto Supabase.
- Politicas RLS publicas devem permanecer limitadas a dados agregados e sem
  dados pessoais.
- Views devem preservar `security_invoker = true`.
- Seeds e imports precisam ser idempotentes.
- Geometrias municipais completas podem ser grandes demais para consumo direto
  no navegador.
- A migration ainda nao foi validada por `supabase db reset`, advisors ou lint.

## Proximos passos

1. Instalar Supabase CLI localmente.
2. Aplicar a migration em stack local.
3. Rodar advisors/lint da CLI disponivel.
4. Criar seed SQL ou importador para `homicidio_doloso`.
5. Validar contagens, chaves e constraints com fixtures pequenas.
6. Planejar grants/RLS finais antes de qualquer ambiente remoto.
7. Integrar o app ao Supabase somente por feature flag e com fallback local.
