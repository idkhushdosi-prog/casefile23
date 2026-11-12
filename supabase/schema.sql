-- ============================================================================
-- CASE FILE: CLASS OF 23 — Supabase Schema, Triggers, RPCs & RLS Policies
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Optional Editor Allowlist (used only if you also enable email magic-link editor login;
--    otherwise student-editor passcode login uses SUPABASE_SERVICE_ROLE_KEY on the server)
-- ----------------------------------------------------------------------------
create table if not exists public.editor_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.editor_allowlist enable row level security;
-- No public/anon policies: only postgres / service_role can read or modify.

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and coalesce(auth.jwt() ->> 'email', '') <> ''
    and exists (
      select 1
      from public.editor_allowlist e
      where lower(e.email) = lower(auth.jwt() ->> 'email')
    );
$$;

-- ----------------------------------------------------------------------------
-- 2. Core Tables
-- ----------------------------------------------------------------------------
create table if not exists public.contributors (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  roster_id text not null unique,
  scholar_number text not null check (scholar_number ~ '^[0-9]{3,5}$'),
  first_name_caps text not null check (
    first_name_caps = upper(first_name_caps)
    and char_length(trim(first_name_caps)) > 0
  ),
  middle_name_caps text null check (
    middle_name_caps is null
    or (middle_name_caps = upper(middle_name_caps) and char_length(trim(middle_name_caps)) > 0)
  ),
  last_name_caps text not null check (
    last_name_caps = upper(last_name_caps)
    and char_length(trim(last_name_caps)) > 0
  ),
  full_name_caps text not null check (
    full_name_caps = upper(full_name_caps)
    and char_length(trim(full_name_caps)) > 0
  ),
  consent_portrait boolean not null default false,
  shuffle_seed integer not null default floor(random() * 2147483647)::integer,
  xp integer not null default 0 check (xp >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  updated_at timestamptz not null default now()
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  subject_roster_id text not null,
  question_key text not null,
  answer jsonb not null,
  updated_at timestamptz not null default now(),
  unique (contributor_id, subject_roster_id, question_key)
);

create table if not exists public.case_meta (
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  subject_roster_id text not null,
  familiarity text null check (
    familiarity is null
    or familiarity in ('best_friends', 'same_group', 'talk_sometimes', 'barely_spoken', 'distance_only')
  ),
  status text not null default 'unopened' check (status in ('unopened', 'in_progress', 'filed', 'skipped')),
  started_at timestamptz null,
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  primary key (contributor_id, subject_roster_id)
);

create table if not exists public.skips (
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  subject_roster_id text not null,
  reason_choice text not null,
  reason_text text null,
  created_at timestamptz not null default now(),
  primary key (contributor_id, subject_roster_id)
);

create table if not exists public.awards (
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  award_key text not null,
  voted_roster_id text not null,
  updated_at timestamptz not null default now(),
  primary key (contributor_id, award_key)
);

create table if not exists public.archive_entries (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  section_key text not null,
  content jsonb not null,
  tagged_roster_id text null,
  updated_at timestamptz not null default now()
);

create table if not exists public.anything_else (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  tagged_roster_id text null,
  body text not null check (char_length(body) <= 10000),
  is_editor_note boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  kind text not null check (kind in ('portrait', 'mugshot', 'worst_face', 'chaos', 'extra')),
  storage_path text not null,
  caption text null check (caption is null or char_length(caption) <= 300),
  photo_type text null,
  tagged_roster_ids text[] not null default '{}',
  sha256_hash text null,
  width integer null,
  height integer null,
  created_at timestamptz not null default now()
);

create table if not exists public.editor_notes (
  id uuid primary key default gen_random_uuid(),
  subject_roster_id text not null unique,
  note text not null default '',
  pseudo_latin_binomial text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.editor_picks (
  id uuid primary key default gen_random_uuid(),
  target_type text not null default 'response' check (target_type in ('response', 'archive', 'anything_else', 'upload')),
  entry_id uuid not null unique,
  picked boolean not null default false,
  edited_text text null,
  used_in text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.editor_settings (
  id integer primary key default 1 check (id = 1),
  familiarity_weights jsonb not null default '{"best_friends": 1.5, "same_group": 1.25, "talk_sometimes": 1.0, "barely_spoken": 0.5, "distance_only": 0.5}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.editor_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.archive_dispatches (
  id integer primary key default 1 check (id = 1),
  dispatched_for_count integer not null default 0,
  status text not null default 'idle' check (status in ('idle', 'sending', 'sent', 'failed')),
  recipient_email text null,
  storage_zip_path text null,
  error_message text null,
  dispatched_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.archive_dispatches enable row level security;

insert into public.archive_dispatches (id)
values (1)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_responses_subject on public.responses (subject_roster_id, question_key);
create index if not exists idx_responses_contributor on public.responses (contributor_id);
create index if not exists idx_case_meta_subject on public.case_meta (subject_roster_id, status);
create index if not exists idx_skips_subject on public.skips (subject_roster_id);
create index if not exists idx_awards_key on public.awards (award_key, voted_roster_id);
create index if not exists idx_archive_section on public.archive_entries (section_key);
create index if not exists idx_anything_else_contributor on public.anything_else (contributor_id);
create index if not exists idx_uploads_contributor on public.uploads (contributor_id, kind);
create index if not exists idx_uploads_tags on public.uploads using gin (tagged_roster_ids);

-- ----------------------------------------------------------------------------
-- 4. Anti-Self-Writing Triggers (database enforcement)
-- ----------------------------------------------------------------------------
create or replace function public.enforce_not_self_subject()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  own_roster_id text;
  target_roster_id text;
begin
  select roster_id into own_roster_id
  from public.contributors
  where id = new.contributor_id;

  if own_roster_id is null then
    raise exception 'Contributor profile must exist before recording entries';
  end if;

  if tg_table_name = 'awards' then
    target_roster_id := new.voted_roster_id;
  else
    target_roster_id := new.subject_roster_id;
  end if;

  if target_roster_id = own_roster_id then
    raise exception 'Rule violation: you cannot write or vote about yourself (%)', own_roster_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_responses_not_self on public.responses;
create trigger trg_responses_not_self
  before insert or update on public.responses
  for each row execute function public.enforce_not_self_subject();

drop trigger if exists trg_case_meta_not_self on public.case_meta;
create trigger trg_case_meta_not_self
  before insert or update on public.case_meta
  for each row execute function public.enforce_not_self_subject();

drop trigger if exists trg_skips_not_self on public.skips;
create trigger trg_skips_not_self
  before insert or update on public.skips
  for each row execute function public.enforce_not_self_subject();

drop trigger if exists trg_awards_not_self on public.awards;
create trigger trg_awards_not_self
  before insert or update on public.awards
  for each row execute function public.enforce_not_self_subject();

-- ----------------------------------------------------------------------------
-- 5. Safe Public RPCs (SECURITY DEFINER, zero leakage of answers or IDs)
-- ----------------------------------------------------------------------------
create or replace function public.get_witness_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  submitted_total integer;
  started_total integer;
  filed_map jsonb;
  top_subject text;
begin
  select count(*) into submitted_total
  from public.contributors
  where status = 'submitted';

  select count(*) into started_total
  from public.contributors;

  select coalesce(jsonb_object_agg(subject_roster_id, cnt), '{}'::jsonb)
  into filed_map
  from (
    select subject_roster_id, count(*)::integer as cnt
    from public.case_meta
    where status = 'filed'
    group by subject_roster_id
  ) sub;

  select subject_roster_id into top_subject
  from public.case_meta
  where status = 'filed'
  group by subject_roster_id
  order by count(*) desc, subject_roster_id asc
  limit 1;

  return jsonb_build_object(
    'submitted_count', submitted_total,
    'started_count', started_total,
    'total_roster', 23,
    'subject_filed_counts', filed_map,
    'most_filed_subject_id', top_subject
  );
end;
$$;

create or replace function public.get_nickname_suggestions(p_subject_roster_id text)
returns table (nickname text, suggestion_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    trim(answer ->> 'value') as nickname,
    count(*)::bigint as suggestion_count
  from public.responses
  where subject_roster_id = p_subject_roster_id
    and question_key = 'q1_nickname'
    and coalesce(trim(answer ->> 'value'), '') <> ''
  group by trim(answer ->> 'value')
  order by count(*) desc, trim(answer ->> 'value') asc
  limit 20;
$$;

grant execute on function public.get_witness_counts() to anon, authenticated;
grant execute on function public.get_nickname_suggestions(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Row Level Security (RLS)
-- ----------------------------------------------------------------------------
alter table public.contributors enable row level security;
alter table public.responses enable row level security;
alter table public.case_meta enable row level security;
alter table public.skips enable row level security;
alter table public.awards enable row level security;
alter table public.archive_entries enable row level security;
alter table public.anything_else enable row level security;
alter table public.uploads enable row level security;
alter table public.editor_notes enable row level security;
alter table public.editor_picks enable row level security;
alter table public.editor_settings enable row level security;

-- Contributors: own rows only, editor reads all
drop policy if exists contributors_select_own on public.contributors;
create policy contributors_select_own on public.contributors
  for select using (id = auth.uid() or public.is_editor());

drop policy if exists contributors_insert_own on public.contributors;
create policy contributors_insert_own on public.contributors
  for insert with check (id = auth.uid());

drop policy if exists contributors_update_own on public.contributors;
create policy contributors_update_own on public.contributors
  for update using (id = auth.uid() or public.is_editor())
  with check (id = auth.uid() or public.is_editor());

-- Responses
drop policy if exists responses_select_own on public.responses;
create policy responses_select_own on public.responses
  for select using (contributor_id = auth.uid() or public.is_editor());

drop policy if exists responses_insert_own on public.responses;
create policy responses_insert_own on public.responses
  for insert with check (contributor_id = auth.uid());

drop policy if exists responses_update_own on public.responses;
create policy responses_update_own on public.responses
  for update using (contributor_id = auth.uid())
  with check (contributor_id = auth.uid());

drop policy if exists responses_delete_own on public.responses;
create policy responses_delete_own on public.responses
  for delete using (contributor_id = auth.uid());

-- Case Meta
drop policy if exists case_meta_select_own on public.case_meta;
create policy case_meta_select_own on public.case_meta
  for select using (contributor_id = auth.uid() or public.is_editor());

drop policy if exists case_meta_insert_own on public.case_meta;
create policy case_meta_insert_own on public.case_meta
  for insert with check (contributor_id = auth.uid());

drop policy if exists case_meta_update_own on public.case_meta;
create policy case_meta_update_own on public.case_meta
  for update using (contributor_id = auth.uid())
  with check (contributor_id = auth.uid());

-- Skips
drop policy if exists skips_select_own on public.skips;
create policy skips_select_own on public.skips
  for select using (contributor_id = auth.uid() or public.is_editor());

drop policy if exists skips_insert_own on public.skips;
create policy skips_insert_own on public.skips
  for insert with check (contributor_id = auth.uid());

drop policy if exists skips_update_own on public.skips;
create policy skips_update_own on public.skips
  for update using (contributor_id = auth.uid())
  with check (contributor_id = auth.uid());

drop policy if exists skips_delete_own on public.skips;
create policy skips_delete_own on public.skips
  for delete using (contributor_id = auth.uid());

-- Awards
drop policy if exists awards_select_own on public.awards;
create policy awards_select_own on public.awards
  for select using (contributor_id = auth.uid() or public.is_editor());

drop policy if exists awards_insert_own on public.awards;
create policy awards_insert_own on public.awards
  for insert with check (contributor_id = auth.uid());

drop policy if exists awards_update_own on public.awards;
create policy awards_update_own on public.awards
  for update using (contributor_id = auth.uid())
  with check (contributor_id = auth.uid());

-- Archive Entries
drop policy if exists archive_select_own on public.archive_entries;
create policy archive_select_own on public.archive_entries
  for select using (contributor_id = auth.uid() or public.is_editor());

drop policy if exists archive_insert_own on public.archive_entries;
create policy archive_insert_own on public.archive_entries
  for insert with check (contributor_id = auth.uid());

drop policy if exists archive_update_own on public.archive_entries;
create policy archive_update_own on public.archive_entries
  for update using (contributor_id = auth.uid())
  with check (contributor_id = auth.uid());

drop policy if exists archive_delete_own on public.archive_entries;
create policy archive_delete_own on public.archive_entries
  for delete using (contributor_id = auth.uid());

-- Anything Else
drop policy if exists anything_else_select_own on public.anything_else;
create policy anything_else_select_own on public.anything_else
  for select using (contributor_id = auth.uid() or public.is_editor());

drop policy if exists anything_else_insert_own on public.anything_else;
create policy anything_else_insert_own on public.anything_else
  for insert with check (contributor_id = auth.uid());

drop policy if exists anything_else_update_own on public.anything_else;
create policy anything_else_update_own on public.anything_else
  for update using (contributor_id = auth.uid())
  with check (contributor_id = auth.uid());

drop policy if exists anything_else_delete_own on public.anything_else;
create policy anything_else_delete_own on public.anything_else
  for delete using (contributor_id = auth.uid());

-- Uploads
drop policy if exists uploads_select_own on public.uploads;
create policy uploads_select_own on public.uploads
  for select using (contributor_id = auth.uid() or public.is_editor());

drop policy if exists uploads_insert_own on public.uploads;
create policy uploads_insert_own on public.uploads
  for insert with check (contributor_id = auth.uid());

drop policy if exists uploads_update_own on public.uploads;
create policy uploads_update_own on public.uploads
  for update using (contributor_id = auth.uid())
  with check (contributor_id = auth.uid());

drop policy if exists uploads_delete_own on public.uploads;
create policy uploads_delete_own on public.uploads
  for delete using (contributor_id = auth.uid());

-- Editor-only tables
drop policy if exists editor_notes_all on public.editor_notes;
create policy editor_notes_all on public.editor_notes
  for all using (public.is_editor()) with check (public.is_editor());

drop policy if exists editor_picks_all on public.editor_picks;
create policy editor_picks_all on public.editor_picks
  for all using (public.is_editor()) with check (public.is_editor());

drop policy if exists editor_settings_all on public.editor_settings;
create policy editor_settings_all on public.editor_settings
  for all using (public.is_editor()) with check (public.is_editor());

-- ----------------------------------------------------------------------------
-- 7. Private Storage Bucket `keepsake` & Policies
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'keepsake',
  'keepsake',
  false,
  52428800, -- 50 MB (supports complete export ZIPs as well as photos)
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf', 'application/zip']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists keepsake_contributor_insert on storage.objects;
create policy keepsake_contributor_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'keepsake'
    and (storage.foldername(name))[1] in ('portraits', 'chaos', 'extra')
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists keepsake_contributor_select on storage.objects;
create policy keepsake_contributor_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'keepsake'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_editor()
    )
  );

drop policy if exists keepsake_contributor_update on storage.objects;
create policy keepsake_contributor_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'keepsake'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'keepsake'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists keepsake_contributor_delete on storage.objects;
create policy keepsake_contributor_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'keepsake'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
