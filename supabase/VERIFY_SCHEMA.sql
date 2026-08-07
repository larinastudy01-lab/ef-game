-- Read-only checks to run after all migrations. Every query should return zero rows
-- unless the comment says otherwise.

-- Missing application columns (expect 0 rows).
with required(table_name, column_name) as (values
  ('profiles', 'full_name'), ('patients', 'full_name'),
  ('parent_reminders', 'title'), ('parent_reminders', 'read_at')
)
select r.*
from required r
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = r.table_name
 and c.column_name = r.column_name
where c.column_name is null;

-- Public tables without RLS (expect 0 rows).
select schemaname, tablename
from pg_tables
where schemaname = 'public' and not rowsecurity
order by tablename;

-- Broken foreign keys (expect 0 rows).
select conrelid::regclass as table_name, conname
from pg_constraint
where contype = 'f' and not convalidated;

-- Duplicate knowledge chunks (expect 0 rows).
select document_id, chunk_index, count(*)
from public.clinical_knowledge_chunks
group by document_id, chunk_index
having count(*) > 1;

-- Inventory (informational).
select 'documents' as entity, count(*) from public.clinical_knowledge_documents
union all
select 'chunks', count(*) from public.clinical_knowledge_chunks;
