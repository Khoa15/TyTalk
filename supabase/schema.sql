-- TyTalk schema for Supabase. Run once in the SQL editor (or via supabase db push).
-- The backend uses the secret key, which bypasses RLS. RLS is enabled with no policies
-- so the publishable/anon key can read or write nothing.

create table if not exists users (
  id bigint generated always as identity primary key,
  email varchar(255) not null unique,
  password_hash varchar(255) not null,
  display_name varchar(100) not null,
  created_at timestamp not null default now()
);

create table if not exists user_personas (
  user_id bigint primary key references users(id) on delete cascade,
  traits jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamp not null default now()
);

create table if not exists refresh_tokens (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  token_hash varchar(64) not null unique,
  expires_at timestamp not null,
  revoked_at timestamp
);
create index if not exists ix_refresh_tokens_user_id on refresh_tokens(user_id);

alter table users enable row level security;
alter table user_personas enable row level security;
alter table refresh_tokens enable row level security;
