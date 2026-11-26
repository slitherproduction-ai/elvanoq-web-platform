create table public.portal_staff (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('admin','reseller')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.portal_managed_devices (
 id uuid primary key default gen_random_uuid(),
 mac text not null unique check (mac ~ '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'),
 key_hash text not null,
 display_name text not null,
 reseller_id uuid references public.portal_staff(user_id),
 active boolean not null default true,
 expires_at timestamptz,
 created_at timestamptz not null default now()
);
create index portal_managed_devices_reseller_idx on public.portal_managed_devices(reseller_id);
create table public.portal_playlists (
 device_id uuid primary key references public.portal_managed_devices(id) on delete cascade,
 name text not null,
 kind text not null check (kind in ('m3u','xtream')),
 credentials jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.portal_staff enable row level security;
alter table public.portal_managed_devices enable row level security;
alter table public.portal_playlists enable row level security;
revoke all on public.portal_staff, public.portal_managed_devices, public.portal_playlists from anon, authenticated;
grant all on public.portal_staff, public.portal_managed_devices, public.portal_playlists to service_role;
