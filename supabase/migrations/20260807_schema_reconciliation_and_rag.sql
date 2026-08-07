-- Reconcile the production schema with the application and add the RAG store.
-- Apply after supabase_schema.sql and the 20260730 migrations.
begin;

create schema if not exists extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "vector" with schema extensions;
alter extension vector set schema extensions;

-- Columns already used by the React application.
alter table public.profiles add column if not exists full_name text;
alter table public.patients add column if not exists full_name text;
alter table public.parent_reminders add column if not exists title text;
alter table public.parent_reminders add column if not exists read_at timestamptz;

alter table public.parent_reminders drop constraint if exists parent_reminders_status_check;
alter table public.parent_reminders
  add constraint parent_reminders_status_check
  check (status in ('unread', 'read', 'done')) not valid;
update public.parent_reminders set status = 'unread' where status = 'pending';
alter table public.parent_reminders validate constraint parent_reminders_status_check;

create index if not exists idx_clinician_access_patient
  on public.clinician_patient_access(patient_id, clinician_id);
create index if not exists idx_clinician_notes_patient_time
  on public.clinician_notes(patient_id, created_at desc);
create index if not exists idx_parent_reminders_patient_status_time
  on public.parent_reminders(patient_id, status, created_at desc);

-- Centralized authorization helpers prevent policy drift and recursive RLS checks.
create or replace function public.is_professional(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = target_user_id
      and lower(role) in ('clinician', 'medical', 'doctor')
  );
$$;

create or replace function public.can_access_patient(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.patients p
    where p.id = target_patient_id
      and (
        p.guardian_id = auth.uid()
        or exists (
          select 1 from public.clinician_patient_access a
          where a.patient_id = p.id and a.clinician_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.is_professional(uuid) from public;
revoke all on function public.can_access_patient(uuid) from public;
grant execute on function public.is_professional(uuid) to authenticated;
grant execute on function public.can_access_patient(uuid) to authenticated;

-- Replace the broad legacy policies with assignment-based access.
drop policy if exists "profiles_select_own_or_clinician" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
  using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check (id = auth.uid() and lower(role) in ('guardian', 'parent'));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Public sign-up can create guardian accounts only. Professional roles must be
-- provisioned by an administrator using the service role / SQL Editor.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    'guardian'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'Profile role changes require an administrator';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
before update of role on public.profiles
for each row execute function public.prevent_profile_role_escalation();

drop policy if exists "patients_select_owner_or_clinician" on public.patients;
drop policy if exists "patients_select_related" on public.patients;
drop policy if exists "patients_insert_owner" on public.patients;
drop policy if exists "patients_update_owner" on public.patients;
drop policy if exists "patients_delete_owner" on public.patients;
create policy "patients_select_related" on public.patients for select to authenticated
  using (public.can_access_patient(id));
create policy "patients_insert_owner" on public.patients for insert to authenticated
  with check (guardian_id = auth.uid());
create policy "patients_update_owner" on public.patients for update to authenticated
  using (guardian_id = auth.uid()) with check (guardian_id = auth.uid());
create policy "patients_delete_owner" on public.patients for delete to authenticated
  using (guardian_id = auth.uid());

drop policy if exists "game_results_select_owner_or_clinician" on public.game_results;
drop policy if exists "game_results_select_related" on public.game_results;
drop policy if exists "game_results_insert_owner" on public.game_results;
drop policy if exists "game_results_update_owner" on public.game_results;
drop policy if exists "game_results_delete_owner" on public.game_results;
create policy "game_results_select_related" on public.game_results for select to authenticated
  using (public.can_access_patient(patient_id));
create policy "game_results_insert_owner" on public.game_results for insert to authenticated
  with check (guardian_id = auth.uid() and public.can_access_patient(patient_id));
create policy "game_results_update_owner" on public.game_results for update to authenticated
  using (guardian_id = auth.uid())
  with check (guardian_id = auth.uid() and public.can_access_patient(patient_id));
create policy "game_results_delete_owner" on public.game_results for delete to authenticated
  using (guardian_id = auth.uid());

drop policy if exists "clinician_access_select_related" on public.clinician_patient_access;
drop policy if exists "clinician_access_insert_clinician" on public.clinician_patient_access;
drop policy if exists "clinician_access_delete_clinician" on public.clinician_patient_access;
drop policy if exists "clinician_access_insert_professional" on public.clinician_patient_access;
drop policy if exists "clinician_access_delete_professional" on public.clinician_patient_access;
create policy "clinician_access_select_related" on public.clinician_patient_access for select to authenticated
  using (clinician_id = auth.uid() or public.can_access_patient(patient_id));
create policy "clinician_access_insert_professional" on public.clinician_patient_access for insert to authenticated
  with check (clinician_id = auth.uid() and public.is_professional());
create policy "clinician_access_delete_professional" on public.clinician_patient_access for delete to authenticated
  using (clinician_id = auth.uid() and public.is_professional());

drop policy if exists "clinician_notes_select_related" on public.clinician_notes;
drop policy if exists "clinician_notes_insert_clinician" on public.clinician_notes;
drop policy if exists "clinician_notes_insert_assigned" on public.clinician_notes;
create policy "clinician_notes_select_related" on public.clinician_notes for select to authenticated
  using (public.can_access_patient(patient_id));
create policy "clinician_notes_insert_assigned" on public.clinician_notes for insert to authenticated
  with check (clinician_id = auth.uid() and public.is_professional() and public.can_access_patient(patient_id));

drop policy if exists "parent_reminders_select_related" on public.parent_reminders;
drop policy if exists "parent_reminders_insert_clinician" on public.parent_reminders;
drop policy if exists "parent_reminders_insert_assigned" on public.parent_reminders;
drop policy if exists "parent_reminders_update_related" on public.parent_reminders;
create policy "parent_reminders_select_related" on public.parent_reminders for select to authenticated
  using (public.can_access_patient(patient_id));
create policy "parent_reminders_insert_assigned" on public.parent_reminders for insert to authenticated
  with check (clinician_id = auth.uid() and public.is_professional() and public.can_access_patient(patient_id));
create policy "parent_reminders_update_related" on public.parent_reminders for update to authenticated
  using (public.can_access_patient(patient_id))
  with check (public.can_access_patient(patient_id));
revoke update on public.parent_reminders from authenticated;
grant update (status, read_at) on public.parent_reminders to authenticated;

-- Transactional clinician workflow used by ClinicianDashboard.jsx.
create or replace function public.clinician_create_patient(
  p_guardian_email text,
  p_nickname text,
  p_full_name text default null,
  p_birth_date date default null,
  p_gender text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clinician_id uuid := auth.uid();
  v_guardian_id uuid;
  v_patient_id uuid;
begin
  if v_clinician_id is null or not public.is_professional(v_clinician_id) then
    raise exception 'An authorized professional account is required';
  end if;
  if nullif(btrim(p_guardian_email), '') is null then
    raise exception 'Guardian email is required';
  end if;
  if nullif(btrim(p_nickname), '') is null then
    raise exception 'Patient nickname is required';
  end if;
  if p_birth_date is null or p_birth_date > current_date then
    raise exception 'A valid birth date is required';
  end if;

  select id into v_guardian_id
  from public.profiles
  where lower(email) = lower(btrim(p_guardian_email))
    and lower(role) in ('guardian', 'parent')
  order by created_at
  limit 1;

  if v_guardian_id is null then
    raise exception 'No guardian account matches that email';
  end if;

  insert into public.patients (guardian_id, nickname, full_name, birth_date, gender)
  values (
    v_guardian_id,
    btrim(p_nickname),
    nullif(btrim(coalesce(p_full_name, '')), ''),
    p_birth_date,
    nullif(btrim(coalesce(p_gender, '')), '')
  ) returning id into v_patient_id;

  insert into public.clinician_patient_access (clinician_id, patient_id)
  values (v_clinician_id, v_patient_id)
  on conflict (clinician_id, patient_id) do nothing;

  return v_patient_id;
end;
$$;
revoke all on function public.clinician_create_patient(text, text, text, date, text) from public;
grant execute on function public.clinician_create_patient(text, text, text, date, text) to authenticated;

-- Clinical RAG documents and 384-dimensional multilingual-e5-small chunks.
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

create index if not exists clinical_chunks_document_id_idx on public.clinical_knowledge_chunks(document_id);
create index if not exists clinical_chunks_game_key_idx on public.clinical_knowledge_chunks(game_key);
create index if not exists clinical_chunks_population_idx on public.clinical_knowledge_chunks(population);
create index if not exists clinical_chunks_embedding_hnsw_idx
  on public.clinical_knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.clinical_knowledge_documents enable row level security;
alter table public.clinical_knowledge_chunks enable row level security;
drop policy if exists "clinical_documents_read_professional" on public.clinical_knowledge_documents;
drop policy if exists "clinical_chunks_read_professional" on public.clinical_knowledge_chunks;
create policy "clinical_documents_read_professional" on public.clinical_knowledge_documents
  for select to authenticated using (is_active and public.is_professional());
create policy "clinical_chunks_read_professional" on public.clinical_knowledge_chunks
  for select to authenticated using (
    public.is_professional() and exists (
      select 1 from public.clinical_knowledge_documents d
      where d.id = document_id and d.is_active
    )
  );
grant select on public.clinical_knowledge_documents, public.clinical_knowledge_chunks to authenticated;

-- Canonical RPC used by the server.
create or replace function public.match_clinical_knowledge(
  query_embedding extensions.vector(384),
  match_count integer default 8,
  filter_game_key text default null,
  filter_ability text default null,
  similarity_threshold double precision default 0.55
)
returns table (
  chunk_id uuid, document_id uuid, title text, authors text,
  publication_year integer, journal text, source_url text, file_name text,
  content text, page_number integer, section_title text, game_key text,
  ability text, population text, similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select c.id, d.id, d.title, d.authors, d.publication_year, d.journal,
         d.source_url, d.file_name, c.content, c.page_number, c.section_title,
         c.game_key, c.ability, c.population,
         (1 - (c.embedding <=> query_embedding))::double precision as similarity
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
  chunk_id uuid, document_id uuid, title text, authors text,
  publication_year integer, journal text, source_url text, file_name text,
  content text, page_number integer, section_title text, game_key text,
  ability text, population text, similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select c.id, d.id, d.title, d.authors, d.publication_year, d.journal,
         d.source_url, d.file_name, c.content, c.page_number, c.section_title,
         c.game_key, c.ability, c.population,
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

revoke all on function public.match_clinical_knowledge(extensions.vector, integer, text, text, double precision) from public;
revoke all on function public.match_clinical_knowledge(extensions.vector, double precision, integer, text, text) from public;
grant execute on function public.match_clinical_knowledge(extensions.vector, integer, text, text, double precision) to authenticated;
grant execute on function public.match_clinical_knowledge(extensions.vector, double precision, integer, text, text) to authenticated;

commit;
