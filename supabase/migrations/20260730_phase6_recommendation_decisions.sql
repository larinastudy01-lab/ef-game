-- Phase 6: additive adaptive recommendation decision log. Existing recommendation code/data remain unchanged.
create table if not exists public.recommendation_decisions (
  id text primary key,
  participant_id uuid not null references public.research_participants(id) on delete restrict,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  recommendation_timestamp timestamptz not null,
  recommendation_version text not null,
  policy_name text not null,
  policy_version text not null,
  reward_version text not null,
  context jsonb not null,
  available_actions jsonb not null,
  selected_action jsonb not null,
  predicted_reward numeric,
  exploration boolean not null default false,
  actual_outcome jsonb,
  actual_reward numeric check (actual_reward is null or (actual_reward >= 0 and actual_reward <= 1)),
  reward_components jsonb,
  outcome_recorded_at timestamptz,
  created_at timestamptz not null default now(),
  check ((actual_outcome is null and actual_reward is null) or (actual_outcome is not null and actual_reward is not null))
);

comment on table public.recommendation_decisions is
  'Versioned research decision log. Context contains authorized behavioral fields only; simulation rows are not persisted.';

create index if not exists idx_recommendation_participant_time on public.recommendation_decisions(participant_id, recommendation_timestamp desc);
create index if not exists idx_recommendation_policy_time on public.recommendation_decisions(policy_version, recommendation_timestamp desc);

create or replace function public.protect_recommendation_decision()
returns trigger language plpgsql as $$
begin
  if old.participant_id is distinct from new.participant_id
     or old.policy_version is distinct from new.policy_version
     or old.context is distinct from new.context
     or old.available_actions is distinct from new.available_actions
     or old.selected_action is distinct from new.selected_action
     or old.reward_version is distinct from new.reward_version then
    raise exception 'Recommendation decision fields are immutable';
  end if;
  if old.actual_outcome is not null and (old.actual_outcome is distinct from new.actual_outcome or old.actual_reward is distinct from new.actual_reward) then
    raise exception 'Recommendation outcome has already been recorded';
  end if;
  return new;
end;
$$;

drop trigger if exists recommendation_decision_protect on public.recommendation_decisions;
create trigger recommendation_decision_protect before update on public.recommendation_decisions
for each row execute function public.protect_recommendation_decision();

alter table public.recommendation_decisions enable row level security;
create policy "recommendation_decisions_select_related" on public.recommendation_decisions
for select using (public.can_read_research_participant(participant_id));
create policy "recommendation_decisions_insert_related" on public.recommendation_decisions
for insert with check (created_by = auth.uid() and (
  public.can_write_research_participant(participant_id)
  or (public.can_read_research_participant(participant_id) and exists (
    select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('clinician','medical','doctor')
  ))
));
create policy "recommendation_decisions_update_related" on public.recommendation_decisions
for update using (created_by = auth.uid()) with check (created_by = auth.uid());

grant select, insert, update on public.recommendation_decisions to authenticated;

-- Rollback (decision metadata only; existing training results are unaffected):
-- drop table if exists public.recommendation_decisions;

