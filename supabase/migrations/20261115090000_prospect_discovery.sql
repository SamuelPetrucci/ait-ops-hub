-- Free area discovery fields (OpenStreetMap / Overpass).
alter table public.prospects add column if not exists osm_id text;
alter table public.prospects add column if not exists company_size_bucket text;
alter table public.prospects add column if not exists discovery_source text;

create unique index if not exists prospects_osm_id_uidx
  on public.prospects (osm_id)
  where osm_id is not null;

create index if not exists prospects_company_size_bucket_idx
  on public.prospects (company_size_bucket)
  where company_size_bucket is not null;

comment on column public.prospects.osm_id is 'OpenStreetMap element id as type/id (e.g. way/123).';
comment on column public.prospects.company_size_bucket is 'Estimated size bucket: 1-10, 11-50, 51-200, 200+, unknown.';
comment on column public.prospects.discovery_source is 'Origin of the lead, e.g. openstreetmap.';
