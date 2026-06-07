-- Tabela flat (denormalizada) com os indicadores municipais do VDE, otimizada
-- para leitura direta pela aplicacao e por ferramentas de BI (ex.: Power BI).
-- Uma linha por (municipio, ano, indicador). Leitura publica via RLS; a escrita
-- e feita pelo ETL com a service_role (que ignora RLS).

create table if not exists public.crime_municipal (
  id_ibge char(7) not null,
  municipio text not null,
  uf char(2) not null,
  estado text,
  lat double precision,
  lng double precision,
  populacao integer,
  ano integer not null,
  indicador text not null,
  unidade text,
  valor integer not null,
  taxa_100k numeric(12, 4),
  score smallint,
  nivel text,
  data_status text,
  primary key (id_ibge, ano, indicador)
);

alter table public.crime_municipal enable row level security;

drop policy if exists "public read crime_municipal" on public.crime_municipal;
create policy "public read crime_municipal"
  on public.crime_municipal for select using (true);

create index if not exists crime_municipal_ano_ind_idx
  on public.crime_municipal (ano, indicador);
