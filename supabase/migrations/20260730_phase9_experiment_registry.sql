-- Phase 9: backward-compatible registry metadata for existing Phase 4 experiments.
alter table public.ml_experiments add column if not exists research_question text;
alter table public.ml_experiments add column if not exists result_path text;

comment on column public.ml_experiments.research_question is
  'Predeclared or explicitly recorded behavioral research question; null only for legacy rows.';
comment on column public.ml_experiments.result_path is
  'Repository-relative or approved artifact path for reproducible results; null only for legacy rows.';

create index if not exists idx_ml_experiments_research_question on public.ml_experiments(research_question)
where research_question is not null;

-- Rollback preserves experiment rows while removing Phase 9 optional metadata:
-- alter table public.ml_experiments drop column if exists result_path;
-- alter table public.ml_experiments drop column if exists research_question;

