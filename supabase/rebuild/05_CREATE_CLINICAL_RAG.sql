-- Clinical knowledge store for multilingual-e5-small (384 dimensions).
-- Import writes use the service-role key; authenticated professionals may search.
begin;

create schema if not exists extensions;
create extension if not exists vector with schema extensions;
alter extension vector set schema extensions;

create table if not exists public.clinical_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  authors text,
  publication_year integer check (publication_year is null or publication_year between 1800 and 2200),
  journal text,
  source_url text,
  file_name text not null,
  file_path text,
  file_hash text not null unique,
  document_type text not null default 'research_article',
  category text,
  game_key text,
  ability text,
  population text not null default 'GENERAL',
  age_min numeric check (age_min is null or age_min >= 0),
  age_max numeric check (age_max is null or age_max >= 0),
  evidence_level text not null default 'unknown',
  is_core boolean not null default false,
  is_active boolean not null default true,
  requires_review boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (age_min is null or age_max is null or age_max >= age_min)
);

create table if not exists public.clinical_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.clinical_knowledge_documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (length(btrim(content)) > 0),
  page_number integer check (page_number is null or page_number > 0),
  section_title text,
  category text,
  game_key text,
  ability text,
  population text not null default 'GENERAL',
  token_count integer check (token_count is null or token_count >= 0),
  embedding extensions.vector(384) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists clinical_chunks_document_idx
  on public.clinical_knowledge_chunks(document_id);
create index if not exists clinical_chunks_game_key_idx
  on public.clinical_knowledge_chunks(game_key);
create index if not exists clinical_chunks_ability_idx
  on public.clinical_knowledge_chunks(ability);
create index if not exists clinical_chunks_population_idx
  on public.clinical_knowledge_chunks(population);
create index if not exists clinical_chunks_embedding_hnsw_idx
  on public.clinical_knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.clinical_knowledge_documents enable row level security;
alter table public.clinical_knowledge_chunks enable row level security;

drop policy if exists clinical_documents_read_professional on public.clinical_knowledge_documents;
drop policy if exists clinical_chunks_read_professional on public.clinical_knowledge_chunks;
create policy clinical_documents_read_professional
on public.clinical_knowledge_documents for select to authenticated
using (is_active and public.is_professional());
create policy clinical_chunks_read_professional
on public.clinical_knowledge_chunks for select to authenticated
using (
  public.is_professional()
  and exists (
    select 1 from public.clinical_knowledge_documents d
    where d.id = document_id and d.is_active
  )
);

grant select on public.clinical_knowledge_documents to authenticated;
grant select on public.clinical_knowledge_chunks to authenticated;
grant select, insert, update, delete on public.clinical_knowledge_documents to service_role;
grant select, insert, update, delete on public.clinical_knowledge_chunks to service_role;

-- Canonical overload used by src/api/clinical-assistant.mjs.
create or replace function public.match_clinical_knowledge(
  query_embedding extensions.vector(384),
  match_count integer default 8,
  filter_game_key text default null,
  filter_ability text default null,
  similarity_threshold double precision default 0.55
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  authors text,
  publication_year integer,
  journal text,
  source_url text,
  file_name text,
  content text,
  page_number integer,
  section_title text,
  game_key text,
  ability text,
  population text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select
    c.id,
    d.id,
    d.title,
    d.authors,
    d.publication_year,
    d.journal,
    d.source_url,
    d.file_name,
    c.content,
    c.page_number,
    c.section_title,
    c.game_key,
    c.ability,
    c.population,
    (1 - (c.embedding <=> query_embedding))::double precision
  from public.clinical_knowledge_chunks c
  join public.clinical_knowledge_documents d on d.id = c.document_id
  where (coalesce(auth.jwt() ->> 'role', '') = 'service_role' or public.is_professional())
    and d.is_active
    and (filter_game_key is null or c.game_key = filter_game_key)
    and (filter_ability is null or c.ability = filter_ability)
    and 1 - (c.embedding <=> query_embedding) >= similarity_threshold
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

-- Backward-compatible overload used by scripts/test-rag-search.mjs.
create or replace function public.match_clinical_knowledge(
  query_embedding extensions.vector(384),
  match_threshold double precision,
  match_count integer,
  filter_game_key text,
  filter_population text
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  authors text,
  publication_year integer,
  journal text,
  source_url text,
  file_name text,
  content text,
  page_number integer,
  section_title text,
  game_key text,
  ability text,
  population text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select
    c.id,
    d.id,
    d.title,
    d.authors,
    d.publication_year,
    d.journal,
    d.source_url,
    d.file_name,
    c.content,
    c.page_number,
    c.section_title,
    c.game_key,
    c.ability,
    c.population,
    (1 - (c.embedding <=> query_embedding))::double precision
  from public.clinical_knowledge_chunks c
  join public.clinical_knowledge_documents d on d.id = c.document_id
  where (coalesce(auth.jwt() ->> 'role', '') = 'service_role' or public.is_professional())
    and d.is_active
    and (filter_game_key is null or c.game_key = filter_game_key)
    and (filter_population is null or c.population = filter_population)
    and 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.match_clinical_knowledge(
  extensions.vector, integer, text, text, double precision
) from public;
revoke all on function public.match_clinical_knowledge(
  extensions.vector, double precision, integer, text, text
) from public;
grant execute on function public.match_clinical_knowledge(
  extensions.vector, integer, text, text, double precision
) to authenticated;
grant execute on function public.match_clinical_knowledge(
  extensions.vector, double precision, integer, text, text
) to authenticated;
grant execute on function public.match_clinical_knowledge(
  extensions.vector, integer, text, text, double precision
) to service_role;
grant execute on function public.match_clinical_knowledge(
  extensions.vector, double precision, integer, text, text
) to service_role;

commit;

-- Verification: expect two rows with RLS enabled.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('clinical_knowledge_documents', 'clinical_knowledge_chunks')
order by c.relname;
