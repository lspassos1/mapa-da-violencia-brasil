-- Persistencia da camada OSINT (#89). APLICADO no projeto Supabase via MCP
-- (apply_migration). Versionado aqui para reprodutibilidade/auditoria.
--
-- news_incidents: incidentes extraidos de noticias por IA (NAO oficial),
-- acumulados/deduplicados entre execucoes do job de ingestao. Chave SEMANTICA
-- (incident_key) p/ upsert idempotente; reviewStatus pendente ate aprovacao humana.

create table if not exists public.news_incidents (
  incident_key   text primary key,            -- tipo|uf|municipio|dia (ou ungeo|tipo|titulo)
  tipo           text not null,
  municipio      text not null,
  uf             text not null,
  id_ibge        text,
  lat            double precision,
  lng            double precision,
  vitimas        integer,
  data_ocorrencia date,
  resumo         text not null default '',
  confianca      numeric not null default 0,   -- agregada (com boost de corroboracao)
  corroboracao   integer not null default 1,   -- veiculos distintos
  fontes         jsonb  not null default '[]'::jsonb,
  veiculo        text not null default '',
  fonte_url      text not null default '',
  provedor       text not null default '',
  review_status  text not null default 'pendente'
                 check (review_status in ('pendente','confirmado','rejeitado')),
  reviewed_by    text,
  reviewed_at    timestamptz,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists news_incidents_uf_idx        on public.news_incidents (uf);
create index if not exists news_incidents_review_idx     on public.news_incidents (review_status);
create index if not exists news_incidents_data_idx       on public.news_incidents (data_ocorrencia);
create index if not exists news_incidents_last_seen_idx  on public.news_incidents (last_seen_at desc);

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists news_incidents_set_updated_at on public.news_incidents;
create trigger news_incidents_set_updated_at
  before update on public.news_incidents
  for each row execute function public.set_updated_at();

-- RLS: leitura publica do que NAO foi rejeitado; escrita so via service-role.
alter table public.news_incidents enable row level security;
drop policy if exists news_incidents_public_read on public.news_incidents;
create policy news_incidents_public_read
  on public.news_incidents for select to anon, authenticated
  using (review_status <> 'rejeitado');

-- Upsert idempotente (chamado pelo job com service-role). Preserva a decisao
-- humana (reviewed_by) e first_seen_at; atualiza last_seen_at e o resto.
create or replace function public.upsert_news_incidents(items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer := 0; item jsonb;
begin
  for item in select * from jsonb_array_elements(items) loop
    insert into public.news_incidents as ni (
      incident_key, tipo, municipio, uf, id_ibge, lat, lng, vitimas,
      data_ocorrencia, resumo, confianca, corroboracao, fontes,
      veiculo, fonte_url, provedor, review_status, last_seen_at
    ) values (
      item->>'incident_key', item->>'tipo', item->>'municipio', item->>'uf',
      nullif(item->>'id_ibge',''),
      nullif(item->>'lat','')::double precision, nullif(item->>'lng','')::double precision,
      nullif(item->>'vitimas','')::integer, nullif(item->>'data_ocorrencia','')::date,
      coalesce(item->>'resumo',''), coalesce((item->>'confianca')::numeric, 0),
      coalesce((item->>'corroboracao')::integer, 1), coalesce(item->'fontes', '[]'::jsonb),
      coalesce(item->>'veiculo',''), coalesce(item->>'fonte_url',''), coalesce(item->>'provedor',''),
      coalesce(item->>'review_status','pendente'), now()
    )
    on conflict (incident_key) do update set
      tipo = excluded.tipo, municipio = excluded.municipio, uf = excluded.uf,
      id_ibge = excluded.id_ibge, lat = excluded.lat, lng = excluded.lng,
      vitimas = excluded.vitimas, data_ocorrencia = excluded.data_ocorrencia,
      resumo = excluded.resumo, confianca = excluded.confianca,
      corroboracao = excluded.corroboracao, fontes = excluded.fontes,
      veiculo = excluded.veiculo, fonte_url = excluded.fonte_url, provedor = excluded.provedor,
      last_seen_at = now(),
      review_status = case when ni.reviewed_by is null then excluded.review_status else ni.review_status end;
    n := n + 1;
  end loop;
  return n; -- linhas PROCESSADAS (inserts + updates), nao so novas
end;
$$;

revoke all on function public.upsert_news_incidents(jsonb) from public, anon, authenticated;
-- REVOKE FROM PUBLIC tira o EXECUTE de TODOS os papeis, inclusive service_role.
-- PostgREST chama a RPC como service_role (nao superuser), entao sem este grant
-- explicito a chamada retorna 403 e o cron de ingestao falha. Concede so a ele.
grant execute on function public.upsert_news_incidents(jsonb) to service_role;
