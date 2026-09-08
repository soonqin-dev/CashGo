-- CashGo v2 Supabase schema
-- Run this once in Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense')),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense')),
  amount numeric(12,2) not null check (amount > 0),
  category_id uuid not null references public.categories(id) on delete restrict,
  account_id uuid not null references public.accounts(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  day_of_month int not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  amount numeric(12,2) not null check (amount > 0),
  category_id uuid not null references public.categories(id) on delete restrict,
  account_id uuid not null references public.accounts(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  recurring_id uuid references public.recurring_items(id) on delete set null,
  note text not null default '',
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_budget numeric(12,2) not null default 1500,
  updated_at timestamptz not null default now()
);

create unique index if not exists cashgo_accounts_user_name on public.accounts(user_id, lower(name));
create unique index if not exists cashgo_categories_user_type_name on public.categories(user_id, type, lower(name));
create unique index if not exists cashgo_projects_user_name on public.projects(user_id, lower(name));
create unique index if not exists cashgo_recurring_month_guard on public.transactions(user_id, recurring_id, date) where recurring_id is not null;

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.projects enable row level security;
alter table public.recurring_items enable row level security;
alter table public.transactions enable row level security;
alter table public.user_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['accounts','categories','projects','recurring_items','transactions','user_settings'] loop
    execute format('drop policy if exists "cashgo_select_own" on public.%I', t);
    execute format('drop policy if exists "cashgo_insert_own" on public.%I', t);
    execute format('drop policy if exists "cashgo_update_own" on public.%I', t);
    execute format('drop policy if exists "cashgo_delete_own" on public.%I', t);
    execute format('create policy "cashgo_select_own" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "cashgo_insert_own" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "cashgo_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "cashgo_delete_own" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;
