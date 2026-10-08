-- Fiesta Fresh SEO & AI Visibility dashboard — database schema
-- Run once in the Supabase SQL editor. Safe to re-run (uses IF NOT EXISTS).

-- ============ password gate (locked down: RLS on, NO policies) ============
create table if not exists owner_secret (
  id int primary key,
  salt text not null,
  hash text not null
);
alter table owner_secret enable row level security;
-- No policies on purpose. Only the Edge Functions (service_role) touch this table.

-- ============ SEO scoreboard ============
create table if not exists seo_queries (
  id serial primary key,
  query text unique not null,
  active boolean default true
);
create table if not exists seo_rank_checks (
  id serial primary key,
  query_id int references seo_queries(id),
  checked_at timestamptz default now(),
  on_page1 boolean,
  page1_domains text[],
  notes text
);

-- ============ AI visibility ============
create table if not exists ai_questions (
  id serial primary key,
  qgroup text not null,
  question text unique not null,
  active boolean default true
);
create table if not exists ai_engine_checks (
  id serial primary key,
  question_id int references ai_questions(id),
  engine text not null,
  checked_at timestamptz default now(),
  mentioned boolean,
  recommended boolean,
  beaten_by text,
  position int,
  notes text
);

-- ============ experiments + playbook (both workers) ============
create table if not exists experiments (
  id serial primary key,
  worker text not null,           -- 'seo' or 'ai'
  started_at date default current_date,
  change text not null,
  hypothesis text not null,
  status text default 'running',  -- running | keep | extend | revert
  checkback_7d date,
  checkback_14d date,
  verdict text,
  verdict_at date,
  verdict_notes text
);
create table if not exists playbook (
  id serial primary key,
  worker text not null,           -- 'seo' or 'ai'
  rule text not null,
  added_at date default current_date,
  evidence text
);

-- ============ headline numbers (one row per metric per day) ============
-- value null + label 'could not verify' means unknown. Never a fake zero.
create table if not exists metric_snapshots (
  id serial primary key,
  day date default current_date,
  kind text not null,
  value numeric,
  label text
);

-- ============ worker run logs ============
create table if not exists nightly_logs (
  id serial primary key,
  worker text not null,           -- 'seo' or 'ai'
  day date default current_date,
  summary text,
  details jsonb
);

-- ============ Google Business Profile reviews ============
create table if not exists gbp_reviews (
  id serial primary key,
  checked_at timestamptz default now(),
  review_count int,
  velocity_month int,
  rating numeric,
  source text
);

-- ============ RLS: app reads everything except owner_secret ============
alter table seo_queries enable row level security;
alter table seo_rank_checks enable row level security;
alter table ai_questions enable row level security;
alter table ai_engine_checks enable row level security;
alter table experiments enable row level security;
alter table playbook enable row level security;
alter table metric_snapshots enable row level security;
alter table nightly_logs enable row level security;
alter table gbp_reviews enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'anon read seo_queries') then
    create policy "anon read seo_queries" on seo_queries for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon read seo_rank_checks') then
    create policy "anon read seo_rank_checks" on seo_rank_checks for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon read ai_questions') then
    create policy "anon read ai_questions" on ai_questions for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon read ai_engine_checks') then
    create policy "anon read ai_engine_checks" on ai_engine_checks for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon read experiments') then
    create policy "anon read experiments" on experiments for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon read playbook') then
    create policy "anon read playbook" on playbook for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon read metric_snapshots') then
    create policy "anon read metric_snapshots" on metric_snapshots for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon read nightly_logs') then
    create policy "anon read nightly_logs" on nightly_logs for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon read gbp_reviews') then
    create policy "anon read gbp_reviews" on gbp_reviews for select to anon using (true);
  end if;
end $$;

-- ============ seed: the frozen 14 SEO queries ============
insert into seo_queries (query) values
  ('bond cleaning gold coast'),
  ('end of lease cleaning gold coast'),
  ('house cleaning gold coast'),
  ('airbnb cleaning gold coast'),
  ('deep cleaning gold coast'),
  ('carpet cleaning gold coast'),
  ('commercial cleaning gold coast'),
  ('best cleaning company gold coast'),
  ('cleaning services gold coast'),
  ('cleaners surfers paradise'),
  ('house cleaning broadbeach'),
  ('house cleaning robina'),
  ('cleaning services southport queensland'),
  ('house cleaning burleigh heads')
on conflict (query) do nothing;

-- ============ seed: the frozen 30 AI questions ============
insert into ai_questions (qgroup, question) values
  ('Cleaning services','Who are the best house cleaners on the Gold Coast?'),
  ('Cleaning services','I need a regular cleaner for my home in Surfers Paradise. Who should I call?'),
  ('Cleaning services','Which cleaning company on the Gold Coast is best for deep cleaning?'),
  ('Cleaning services','What is the best value cleaning service on the Gold Coast?'),
  ('Cleaning services','Who cleans offices and commercial spaces on the Gold Coast?'),
  ('Cleaning services','Which Gold Coast cleaner offers a satisfaction guarantee?'),
  ('Bond / end of lease','Who is the best bond cleaner on the Gold Coast?'),
  ('Bond / end of lease','How do I get my bond back with an end of lease clean in Broadbeach?'),
  ('Bond / end of lease','What does a bond clean include in Queensland?'),
  ('Bond / end of lease','Which end of lease cleaner in Robina has the best reviews?'),
  ('Bond / end of lease','How much does bond cleaning cost on the Gold Coast?'),
  ('Bond / end of lease','Who offers a bond-back guarantee for end of lease cleaning on the Gold Coast?'),
  ('Airbnb','Who does the best Airbnb turnover cleaning on the Gold Coast?'),
  ('Airbnb','I need a cleaner for my Airbnb in Burleigh Heads. Who do you recommend?'),
  ('Airbnb','Which Gold Coast cleaning company handles short-stay changeovers?'),
  ('Airbnb','What should an Airbnb cleaning service include?'),
  ('Airbnb','Who cleans holiday rentals in Surfers Paradise?'),
  ('Airbnb','Which Airbnb cleaner on the Gold Coast is most reliable?'),
  ('Locations','Who is the best cleaner in Surfers Paradise?'),
  ('Locations','Who is the best cleaner in Broadbeach?'),
  ('Locations','Who is the best cleaner in Robina?'),
  ('Locations','Who is the best cleaner in Southport?'),
  ('Locations','Who is the best cleaner in Burleigh Heads?'),
  ('Locations','Which cleaning company covers all Gold Coast suburbs?'),
  ('Brand','Who is Fiesta Fresh Cleaning?'),
  ('Brand','Is Fiesta Fresh Cleaning a real business on the Gold Coast?'),
  ('Brand','What services does Fiesta Fresh Cleaning offer?'),
  ('Brand','What do customers say about Fiesta Fresh Cleaning?'),
  ('Brand','How do I book Fiesta Fresh Cleaning?'),
  ('Brand','Is Fiesta Fresh Cleaning recommended for bond cleaning on the Gold Coast?')
on conflict (question) do nothing;

-- ============ seed: day-one honest baseline ============
insert into metric_snapshots (day, kind, value, label) values
  (current_date, 'seo_page1', 0, '0 of 14'),
  (current_date, 'seo_visitors_week', null, 'could not verify'),
  (current_date, 'seo_leads_week', null, 'could not verify'),
  (current_date, 'ai_sov', 0, '0 of 30'),
  (current_date, 'ai_mentions_week', 0, '0')
on conflict do nothing;

insert into nightly_logs (worker, day, summary, details) values
  ('seo', current_date, 'Phase 1 baseline recorded.', '{"page1": "0 of 14"}'),
  ('ai', current_date, 'Phase 1 baseline recorded.', '{"mentions": "0 of 30", "engines": "all could not verify"}')
on conflict do nothing;
