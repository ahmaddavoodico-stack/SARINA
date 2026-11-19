-- Add confirmed field-boundary storage for SARINA farm productivity intelligence.
-- Applied to the linked Supabase project on 2026-11-19.
alter table public.farm_fields
  add column if not exists boundary public.geometry(MultiPolygon, 4326),
  add column if not exists boundary_capture_method text,
  add column if not exists gps_accuracy_m numeric,
  add column if not exists boundary_confirmed_at timestamptz;

alter table public.farm_fields
  add constraint farm_fields_boundary_capture_method_check
  check (boundary_capture_method is null or boundary_capture_method in ('device_gps','map_pin','mixed'));

alter table public.farm_fields
  add constraint farm_fields_gps_accuracy_nonnegative_check
  check (gps_accuracy_m is null or gps_accuracy_m >= 0);

create or replace function public.set_farm_field_boundary_area()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.boundary is not null then
    if public.st_srid(new.boundary) <> 4326 or not public.st_isvalid(new.boundary) then
      raise exception 'Field boundary must be a valid SRID 4326 polygon.';
    end if;
    if public.st_isempty(new.boundary) then raise exception 'Field boundary cannot be empty.'; end if;
    new.area := public.st_area(new.boundary::public.geography) / 10000;
    new.area_unit := 'hectare';
  end if;
  return new;
end;
$$;

drop trigger if exists farm_fields_boundary_area_before_write on public.farm_fields;
create trigger farm_fields_boundary_area_before_write before insert or update of boundary on public.farm_fields
for each row execute function public.set_farm_field_boundary_area();

create index if not exists farm_fields_boundary_gix on public.farm_fields using gist (boundary) where boundary is not null;

comment on column public.farm_fields.boundary is 'Farmer-confirmed field boundary as MultiPolygon, WGS84 / SRID 4326.';
comment on column public.farm_fields.boundary_capture_method is 'How the boundary was captured: device_gps, map_pin, or mixed.';
comment on column public.farm_fields.gps_accuracy_m is 'Device-reported horizontal GPS accuracy in meters at capture time; null when unavailable.';
comment on column public.farm_fields.boundary_confirmed_at is 'Timestamp when the farmer confirmed the field boundary.';