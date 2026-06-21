-- Persistencia do radar de tiroteios (#97). APLICADO no projeto Supabase via MCP
-- (apply_migration). Versionado aqui para reprodutibilidade/auditoria.
--
-- shooting_occurrences: ocorrencias de tiroteio/disparo da Fogo Cruzado (API v2),
-- acumuladas entre execucoes do job de ingestao. A Fogo Cruzado so serve uma
-- JANELA movel; persistir aqui da HISTORICO (tendencia ao longo do tempo) e um
-- cache compartilhado entre instancias serverless (cada cold start zera a memoria).
-- Chave = id da ocorrencia na FC (estavel) -> upsert idempotente.

create table if not exists public.shooting_occurrences (
  id             text primary key,            -- id da ocorrencia na Fogo Cruzado
  data           timestamptz,                 -- data/hora da ocorrencia
  estado         text not null default '',
  municipio      text not null default '',
  bairro         text,
  lat            double precision,
  lng            double precision,
  main_reason    text not null default '',
  contexto       text not null default 'outro'
                 check (contexto in ('disputa','policia','outro')),
  police_action  boolean not null default false,
  mortos         integer not null default 0,
  feridos        integer not null default 0,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists shooting_occ_data_idx       on public.shooting_occurrences (data desc);
create index if not exists shooting_occ_municipio_idx  on public.shooting_occurrences (municipio);
create index if not exists shooting_occ_estado_idx     on public.shooting_occurrences (estado);
create index if not exists shooting_occ_last_seen_idx  on public.shooting_occurrences (last_seen_at desc);

-- Reusa set_updated_at() (definida em 0001_news_incidents.sql).
drop trigger if exists shooting_occ_set_updated_at on public.shooting_occurrences;
create trigger shooting_occ_set_updated_at
  before update on public.shooting_occurrences
  for each row execute function public.set_updated_at();

-- RLS: leitura publica (registros factuais, sem fila de revisao); escrita so via
-- service-role (a RPC abaixo).
alter table public.shooting_occurrences enable row level security;
drop policy if exists shooting_occ_public_read on public.shooting_occurrences;
create policy shooting_occ_public_read
  on public.shooting_occurrences for select to anon, authenticated
  using (true);

-- Upsert idempotente (chamado pelo job com service-role). Preserva first_seen_at;
-- atualiza last_seen_at e o restante a cada reingestao da janela.
create or replace function public.upsert_shooting_occurrences(items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer := 0; item jsonb;
begin
  for item in select * from jsonb_array_elements(items) loop
    if coalesce(item->>'id','') = '' then continue; end if; -- sem id estavel, ignora
    insert into public.shooting_occurrences as so (
      id, data, estado, municipio, bairro, lat, lng, main_reason,
      contexto, police_action, mortos, feridos, last_seen_at
    ) values (
      item->>'id',
      nullif(item->>'data','')::timestamptz,
      coalesce(item->>'estado',''), coalesce(item->>'municipio',''), nullif(item->>'bairro',''),
      nullif(item->>'lat','')::double precision, nullif(item->>'lng','')::double precision,
      coalesce(item->>'main_reason',''), coalesce(item->>'contexto','outro'),
      coalesce((item->>'police_action')::boolean, false),
      coalesce((item->>'mortos')::integer, 0), coalesce((item->>'feridos')::integer, 0),
      now()
    )
    on conflict (id) do update set
      data = excluded.data, estado = excluded.estado, municipio = excluded.municipio,
      bairro = excluded.bairro, lat = excluded.lat, lng = excluded.lng,
      main_reason = excluded.main_reason, contexto = excluded.contexto,
      police_action = excluded.police_action, mortos = excluded.mortos, feridos = excluded.feridos,
      last_seen_at = now();
    n := n + 1;
  end loop;
  return n; -- linhas PROCESSADAS (inserts + updates)
end;
$$;

revoke all on function public.upsert_shooting_occurrences(jsonb) from public, anon, authenticated;
-- REVOKE FROM PUBLIC tira o EXECUTE de TODOS os papeis, inclusive service_role.
-- PostgREST chama a RPC como service_role (nao superuser), entao sem este grant
-- explicito a chamada retorna 403 e o cron de ingestao falha. Concede so a ele.
grant execute on function public.upsert_shooting_occurrences(jsonb) to service_role;
