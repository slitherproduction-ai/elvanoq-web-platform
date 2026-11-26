-- Índices para chaves estrangeiras sem índice e remoção de índice duplicado (Supabase advisors).
-- Não altera dados nem regras.
drop index if exists public.portal_managed_reseller_idx; -- idêntico a portal_managed_devices_reseller_idx
create index if not exists portal_code_device_grants_code_fk_idx on public.portal_code_device_grants (code);
create index if not exists portal_device_assignments_actor_fk_idx on public.portal_device_assignments (actor);
create index if not exists portal_device_binding_events_device_id_fk_idx on public.portal_device_binding_events (device_id);
create index if not exists portal_device_binding_events_actor_fk_idx on public.portal_device_binding_events (actor);
create index if not exists portal_device_events_actor_fk_idx on public.portal_device_events (actor);
create index if not exists portal_license_audit_actor_fk_idx on public.portal_license_audit (actor);
create index if not exists portal_managed_devices_created_by_fk_idx on public.portal_managed_devices (created_by);
create index if not exists portal_managed_devices_server_code_fk_idx on public.portal_managed_devices (server_code);
create index if not exists portal_roku_devices_server_code_fk_idx on public.portal_roku_devices (server_code);
create index if not exists portal_roku_devices_created_by_fk_idx on public.portal_roku_devices (created_by);
create index if not exists portal_roku_events_actor_fk_idx on public.portal_roku_events (actor);
create index if not exists portal_roku_events_device_id_fk_idx on public.portal_roku_events (device_id);
create index if not exists portal_roku_payments_device_id_fk_idx on public.portal_roku_payments (device_id);
create index if not exists portal_roku_payments_confirmed_by_fk_idx on public.portal_roku_payments (confirmed_by);
create index if not exists portal_server_code_events_actor_fk_idx on public.portal_server_code_events (actor);
create index if not exists portal_server_codes_updated_by_fk_idx on public.portal_server_codes (updated_by);
create index if not exists portal_server_hosts_code_fk_idx on public.portal_server_hosts (code);
create index if not exists portal_staff_device_actions_actor_fk_idx on public.portal_staff_device_actions (actor);
