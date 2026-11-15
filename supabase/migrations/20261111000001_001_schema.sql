-- 001: extensiones, enums, tablas, índices y vista camera_status (DER v1.1).

create extension if not exists pg_cron;

create type public.space_status as enum ('free', 'occupied', 'no_data');
create type public.user_role as enum ('user', 'admin');

create table public.profile (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  full_name  text,
  role       public.user_role not null default 'user',
  created_at timestamptz not null default now()
);

create table public.parking_lot (
  id         bigint generated always as identity primary key,
  name       text not null,
  address    text,
  boundary   jsonb,                                  -- anillo [lng, lat]
  lanes      jsonb not null default '[]',
  timezone   text not null default 'America/Bogota',
  created_at timestamptz not null default now()
);

create table public.zone (
  id             bigint generated always as identity primary key,
  parking_lot_id bigint not null references public.parking_lot (id) on delete cascade,
  name           text not null,
  level          text,
  boundary       jsonb,
  is_active      boolean not null default true,
  unique (parking_lot_id, name)
);

create table public.camera (
  id             bigint generated always as identity primary key,
  parking_lot_id bigint not null references public.parking_lot (id) on delete cascade,
  name           text not null,
  source_url     text not null,
  is_online      boolean not null default false,
  last_seen_at   timestamptz
);

create table public.space (
  id            bigint generated always as identity primary key,
  zone_id       bigint not null references public.zone (id) on delete cascade,
  camera_id     bigint references public.camera (id) on delete set null,
  code          text not null,
  map_polygon   jsonb not null,
  image_polygon jsonb,
  angle         smallint not null default 0 check (angle between 0 and 359),
  is_active     boolean not null default true,
  unique (zone_id, code)
);

create table public.space_state (
  space_id   bigint primary key references public.space (id) on delete cascade,
  zone_id    bigint not null references public.zone (id),
  status     public.space_status not null default 'no_data',
  confidence real check (confidence between 0 and 1),
  updated_at timestamptz not null default now()
);

create table public.occupancy_log (
  id          bigint generated always as identity primary key,
  space_id    bigint not null references public.space (id) on delete cascade,
  status      public.space_status not null,
  confidence  real,
  recorded_at timestamptz not null default now()
);

create table public.favorite (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profile (id) on delete cascade,
  parking_lot_id bigint not null references public.parking_lot (id) on delete cascade,
  zone_id        bigint references public.zone (id) on delete cascade,
  notify         boolean not null default false,
  notify_days    smallint[],                         -- 1 = lunes ... 7 = domingo
  notify_time    time,
  created_at     timestamptz not null default now(),
  unique nulls not distinct (user_id, parking_lot_id, zone_id)
);

create table public.push_token (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profile (id) on delete cascade,
  expo_push_token text not null unique,
  platform        text check (platform in ('ios', 'android', 'web')),
  created_at      timestamptz not null default now()
);

create index zone_parking_lot_idx on public.zone (parking_lot_id);
create index camera_parking_lot_idx on public.camera (parking_lot_id);
create index space_zone_idx on public.space (zone_id);
create index space_camera_idx on public.space (camera_id);
create index space_state_zone_idx on public.space_state (zone_id);
create index occupancy_log_space_time_idx on public.occupancy_log (space_id, recorded_at);
create index favorite_parking_lot_idx on public.favorite (parking_lot_id);
create index push_token_user_idx on public.push_token (user_id);

-- Vista sin source_url; corre con los permisos de su dueño para que el
-- visitante la lea sin tener acceso a la tabla camera.
create view public.camera_status
  with (security_invoker = false) as
  select id, parking_lot_id, name, is_online, last_seen_at
  from public.camera;
