create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.fontes (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  nome text not null,
  tipo text not null check (tipo in ('nacional', 'estadual', 'ibge', 'manual', 'osint')),
  uf char(2),
  url text not null,
  licenca text,
  frequencia_esperada text,
  ultima_coleta_em timestamptz,
  ultimo_periodo_disponivel date,
  status text not null default 'pendente',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.etl_execucoes (
  id bigint generated always as identity primary key,
  fonte_id bigint not null references public.fontes(id),
  iniciou_em timestamptz not null default now(),
  terminou_em timestamptz,
  status text not null check (status in ('rodando', 'sucesso', 'falha', 'parcial')),
  linhas_lidas integer not null default 0,
  linhas_inseridas integer not null default 0,
  linhas_atualizadas integer not null default 0,
  erro text,
  checksum_arquivo text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.arquivos_brutos (
  id bigint generated always as identity primary key,
  fonte_id bigint not null references public.fontes(id),
  url_origem text not null,
  caminho_storage text not null,
  formato text not null,
  checksum text not null,
  data_download timestamptz not null default now(),
  periodo_referencia_inicio date,
  periodo_referencia_fim date,
  unique (fonte_id, checksum)
);

create table if not exists public.municipios (
  id_ibge char(7) primary key,
  nome text not null,
  uf char(2) not null,
  nome_uf text not null,
  regiao text,
  populacao_atual integer,
  centroid_lat double precision,
  centroid_lng double precision,
  bbox jsonb,
  geom extensions.geometry(MultiPolygon, 4326),
  updated_at timestamptz not null default now()
);

create table if not exists public.populacao_municipal (
  id_ibge char(7) not null references public.municipios(id_ibge),
  ano integer not null check (ano between 1900 and 2200),
  populacao integer not null check (populacao > 0),
  fonte_id bigint not null references public.fontes(id),
  created_at timestamptz not null default now(),
  primary key (id_ibge, ano)
);

create table if not exists public.indicadores_crime (
  codigo text primary key,
  nome text not null,
  categoria text not null,
  descricao text,
  peso_indice_geral numeric(6, 2) not null default 1,
  ativo boolean not null default true,
  unidade_padrao text not null check (unidade_padrao in ('ocorrencias', 'vitimas', 'indice'))
);

create table if not exists public.ocorrencias_crime (
  id bigint generated always as identity primary key,
  id_ibge char(7) references public.municipios(id_ibge),
  id_ibge_key text generated always as (coalesce(id_ibge::text, '')) stored,
  uf char(2) not null,
  ano integer not null check (ano between 1900 and 2200),
  mes integer not null check (mes between 1 and 12),
  indicador_codigo text not null references public.indicadores_crime(codigo),
  valor integer not null check (valor >= 0),
  unidade_medida text not null check (unidade_medida in ('ocorrencias', 'vitimas')),
  ocorrencias integer check (ocorrencias >= 0),
  vitimas integer check (vitimas >= 0),
  fonte_id bigint not null references public.fontes(id),
  nivel_geografico text not null check (nivel_geografico in ('municipio', 'uf', 'brasil')),
  data_publicacao date,
  data_ingestao timestamptz not null default now(),
  qualidade_status text not null default 'nao_validado',
  raw_payload jsonb not null default '{}'::jsonb,
  unique (fonte_id, nivel_geografico, id_ibge_key, uf, ano, mes, indicador_codigo)
);

create table if not exists public.metricas_municipais_mensais (
  id_ibge char(7) not null references public.municipios(id_ibge),
  ano integer not null check (ano between 1900 and 2200),
  mes integer not null check (mes between 1 and 12),
  indicador_codigo text not null references public.indicadores_crime(codigo),
  valor integer,
  unidade_medida text check (unidade_medida in ('ocorrencias', 'vitimas')),
  populacao_usada integer,
  taxa_100k numeric(12, 4),
  variacao_mes_pct numeric(12, 4),
  variacao_ano_pct numeric(12, 4),
  percentil_nacional numeric(8, 4),
  percentil_estadual numeric(8, 4),
  score_0_100 numeric(6, 2),
  nivel_risco text check (nivel_risco in ('baixo', 'moderado', 'atencao', 'alto', 'critico')),
  data_status text not null check (
    data_status in (
      'oficial',
      'amostra_oficial',
      'sem_dados',
      'zero_registrado',
      'populacao_indisponivel',
      'nao_aplicavel'
    )
  ),
  fonte_prioritaria_id bigint references public.fontes(id),
  updated_at timestamptz not null default now(),
  primary key (id_ibge, ano, mes, indicador_codigo)
);

create index if not exists municipios_geom_gist_idx on public.municipios using gist (geom);
create index if not exists municipios_uf_idx on public.municipios (uf, id_ibge);
create index if not exists municipios_nome_trgm_idx on public.municipios using gin (lower(nome) gin_trgm_ops);
create index if not exists ocorrencias_periodo_indicador_idx
  on public.ocorrencias_crime (ano, mes, indicador_codigo);
create index if not exists ocorrencias_uf_periodo_idx on public.ocorrencias_crime (uf, ano, mes);
create index if not exists metricas_periodo_indicador_idx
  on public.metricas_municipais_mensais (ano, mes, indicador_codigo);
create index if not exists metricas_score_idx
  on public.metricas_municipais_mensais (ano, mes, indicador_codigo, score_0_100 desc);

create or replace view public.v_public_sources_status
with (security_invoker = true) as
select
  codigo,
  nome,
  tipo,
  uf,
  status,
  ultima_coleta_em,
  ultimo_periodo_disponivel,
  observacoes
from public.fontes;

create or replace view public.v_public_mapa_municipios_periodo
with (security_invoker = true) as
select
  m.id_ibge,
  m.nome as municipio,
  m.uf,
  m.nome_uf,
  m.centroid_lat,
  m.centroid_lng,
  m.bbox,
  mm.ano,
  mm.mes,
  mm.indicador_codigo,
  mm.valor,
  mm.unidade_medida,
  mm.populacao_usada,
  mm.taxa_100k,
  mm.score_0_100,
  mm.nivel_risco,
  mm.data_status,
  f.nome as fonte_prioritaria
from public.municipios m
left join public.metricas_municipais_mensais mm on mm.id_ibge = m.id_ibge
left join public.fontes f on f.id = mm.fonte_prioritaria_id;

alter table public.fontes enable row level security;
alter table public.etl_execucoes enable row level security;
alter table public.arquivos_brutos enable row level security;
alter table public.municipios enable row level security;
alter table public.populacao_municipal enable row level security;
alter table public.indicadores_crime enable row level security;
alter table public.ocorrencias_crime enable row level security;
alter table public.metricas_municipais_mensais enable row level security;

create policy "public read fontes" on public.fontes for select using (true);
create policy "public read municipios" on public.municipios for select using (true);
create policy "public read populacao" on public.populacao_municipal for select using (true);
create policy "public read indicadores" on public.indicadores_crime for select using (ativo);
create policy "public read ocorrencias agregadas" on public.ocorrencias_crime for select using (true);
create policy "public read metricas agregadas" on public.metricas_municipais_mensais for select using (true);

grant usage on schema public to anon, authenticated;
grant select on public.v_public_sources_status to anon, authenticated;
grant select on public.v_public_mapa_municipios_periodo to anon, authenticated;

insert into public.indicadores_crime (codigo, nome, categoria, descricao, peso_indice_geral, unidade_padrao)
values
  (
    'homicidio_doloso',
    'Homicidio doloso',
    'mortes_violentas',
    'Vitimas de homicidio doloso conforme dicionario municipal SINESP/MJSP.',
    5,
    'vitimas'
  )
on conflict (codigo) do update set
  nome = excluded.nome,
  categoria = excluded.categoria,
  descricao = excluded.descricao,
  peso_indice_geral = excluded.peso_indice_geral,
  unidade_padrao = excluded.unidade_padrao,
  ativo = true;
