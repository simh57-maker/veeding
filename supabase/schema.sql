-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users profile table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- Login history table
create table if not exists public.login_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  email text not null,
  provider text not null default 'google',
  logged_in_at timestamptz default now(),
  ip_address text
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.login_history enable row level security;

-- Profiles: users can read own profile, admins can read all
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Admins can view all profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Login history: users can insert own, admins can read all
create policy "Users can insert own login history" on public.login_history
  for insert with check (auth.uid() = user_id);

create policy "Admins can view all login history" on public.login_history
  for select using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Function: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users insert
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
