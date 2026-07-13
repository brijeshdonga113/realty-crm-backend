-- ============================================================================
-- Dual-backend support — Supabase schema
--
-- Run this once in the Supabase Dashboard → SQL Editor for your project.
-- Mirrors the Firestore data model in lib/dataStore.js so that ~15 existing
-- services (services/*.js) can work against either backend unchanged.
--
-- Type rule: record ids (patients.id, appointments.id, ...) are client-
-- generated strings (models/*.js's uid() — timestamp+random), NOT uuids.
-- doctor_id IS a real uuid (Supabase Auth's auth.users.id).
-- ============================================================================

-- ── Registry tables (service-role write only — no public insert policy) ─────

create table if not exists doctors (
  id                       uuid primary key references auth.users(id),
  first_name               text,
  last_name                text,
  email                    text,
  clinic_name              text,
  specialization           text,
  phone                    text,
  license_number           text,
  invite_code              text,
  subscription             jsonb,
  is_admin                 boolean default false,
  view_only                boolean default false,
  clinic_role              text default 'doctor',   -- 'doctor' | 'clinic_admin'
  managed_by               uuid,
  managed_doctors          uuid[],
  organization_id          uuid,
  branch_name              text,
  allowed_writers          uuid[],
  allowed_readers          uuid[],
  color_theme              text,
  dark_mode                boolean,
  date_format              text,
  currency                 text,
  working_hours            jsonb,
  logo_url                 text,
  payment_qr_url           text,
  service_charges          jsonb,
  billing_statuses         jsonb,
  inventory_custom_fields  jsonb,
  wa_templates             jsonb,
  referral_sources         jsonb,
  booking_slug             text unique,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);
-- organization_id/branch_name/allowed_*/managed_* columns exist now for schema
-- completeness. The FEATURES that use them (branch switching, clinic-admin
-- views) are explicitly deferred for SB accounts — see plan's Scope section.

create table if not exists receptionists (
  id           uuid primary key references auth.users(id),
  doctor_id    uuid not null references doctors(id),
  name         text,
  email        text,
  role         text default 'receptionist',
  view_only    boolean default false,
  permissions  jsonb default '{}',
  color_theme  text,
  dark_mode    boolean,
  date_format  text,
  currency     text,
  created_at   timestamptz default now()
);

create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists organization_branches (
  org_id       uuid references organizations(id),
  doctor_id    uuid references doctors(id),
  branch_name  text,
  primary key (org_id, doctor_id)
);

create table if not exists invite_codes (
  code        text primary key,
  doctor_id   uuid references doctors(id),
  created_at  timestamptz default now()
);

create table if not exists booking_slugs (
  slug        text primary key,
  doctor_id   uuid references doctors(id),
  created_at  timestamptz default now()
);

-- ── Tenant tables ────────────────────────────────────────────────────────────
-- One per collection in services/*.js. All share the same shape: doctor_id +
-- client-generated text id + opaque jsonb payload (dataStore.js already treats
-- every record as plain JSON with ISO-string dates, no Firestore Timestamps).

create table if not exists patients (
  doctor_id   uuid not null references doctors(id),
  id          text not null,
  data        jsonb not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  primary key (doctor_id, id)
);

create table if not exists appointments (
  doctor_id uuid not null references doctors(id), id text not null, data jsonb not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  primary key (doctor_id, id)
);

create table if not exists invoices (
  doctor_id uuid not null references doctors(id), id text not null, data jsonb not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  primary key (doctor_id, id)
);

create table if not exists expenses (
  doctor_id uuid not null references doctors(id), id text not null, data jsonb not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  primary key (doctor_id, id)
);

create table if not exists followups (
  doctor_id uuid not null references doctors(id), id text not null, data jsonb not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  primary key (doctor_id, id)
);

create table if not exists notifications (
  doctor_id uuid not null references doctors(id), id text not null, data jsonb not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  primary key (doctor_id, id)
);

create table if not exists blocked_slots (
  doctor_id uuid not null references doctors(id), id text not null, data jsonb not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  primary key (doctor_id, id)
);

create table if not exists calendar_events (
  doctor_id uuid not null references doctors(id), id text not null, data jsonb not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  primary key (doctor_id, id)
);

create table if not exists chat (
  doctor_id uuid not null references doctors(id), id text not null, data jsonb not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  primary key (doctor_id, id)
);

create table if not exists leads (
  doctor_id uuid not null references doctors(id), id text not null, data jsonb not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  primary key (doctor_id, id)
);

create table if not exists staff (
  doctor_id uuid not null references doctors(id), id text not null, data jsonb not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  primary key (doctor_id, id)
);

create table if not exists inventory (
  doctor_id uuid not null references doctors(id), id text not null, data jsonb not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  primary key (doctor_id, id)
);

-- Firestore subcollections (patients/{id}/visits, patients/{id}/progressNotes)
-- become flat tables with a patient_id FK instead of nesting.

create table if not exists visits (
  doctor_id   uuid not null references doctors(id),
  id          text not null,
  patient_id  text not null,
  data        jsonb not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  primary key (doctor_id, id),
  foreign key (doctor_id, patient_id) references patients(doctor_id, id)
);

create table if not exists progress_notes (
  doctor_id   uuid not null references doctors(id),
  id          text not null,
  patient_id  text not null,
  data        jsonb not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  primary key (doctor_id, id),
  foreign key (doctor_id, patient_id) references patients(doctor_id, id)
);

create table if not exists documents (
  doctor_id    uuid not null references doctors(id),
  id           text not null,
  patient_id   text not null,
  data         jsonb not null,     -- {name, url, size, type}
  uploaded_at  timestamptz default now(),
  primary key (doctor_id, id),
  foreign key (doctor_id, patient_id) references patients(doctor_id, id)
);

create table if not exists meta (
  doctor_id  uuid not null references doctors(id),
  key        text not null,
  value      jsonb,
  primary key (doctor_id, key)
);

-- ── Shared authorization function ───────────────────────────────────────────
-- Mirrors firestore.rules' isLinkedReceptionist() — written once instead of
-- duplicated across every RLS policy.

create or replace function is_authorized(target_doctor_id uuid) returns boolean
language sql security definer as $$
  select target_doctor_id = auth.uid()
    or exists (
      select 1 from receptionists
      where id = auth.uid() and doctor_id = target_doctor_id
    )
$$;

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table doctors enable row level security;
alter table receptionists enable row level security;
alter table organizations enable row level security;
alter table organization_branches enable row level security;
alter table invite_codes enable row level security;
alter table booking_slugs enable row level security;

-- Registry tables: readable by the account itself / linked receptionist, but
-- NO insert/update policy for regular users — writes only via the service-role
-- key (app/api/admin/create-doctor, app/api/join-sb), matching Firestore rules'
-- "allow write: if false" pattern for admin-only collections.
create policy doctors_read on doctors for select using (is_authorized(id));
create policy receptionists_read on receptionists for select using (is_authorized(doctor_id));

-- A receptionist may update their OWN row (name, personal prefs) — this is
-- row self-ownership (id = auth.uid()), distinct from is_authorized()'s
-- doctor_id linkage check above. Everything else (permissions, viewOnly,
-- creation/deletion) goes through the service-role key.
create policy receptionists_self_update on receptionists for update
  using (id = auth.uid()) with check (id = auth.uid());

alter table patients enable row level security;
alter table appointments enable row level security;
alter table invoices enable row level security;
alter table expenses enable row level security;
alter table followups enable row level security;
alter table notifications enable row level security;
alter table blocked_slots enable row level security;
alter table calendar_events enable row level security;
alter table chat enable row level security;
alter table leads enable row level security;
alter table staff enable row level security;
alter table inventory enable row level security;
alter table visits enable row level security;
alter table progress_notes enable row level security;
alter table documents enable row level security;
alter table meta enable row level security;

create policy tenant_access on patients        for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on appointments    for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on invoices        for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on expenses        for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on followups       for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on notifications   for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on blocked_slots   for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on calendar_events for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on chat            for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on leads           for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on staff           for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on inventory       for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on visits          for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on progress_notes  for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on documents       for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));
create policy tenant_access on meta            for all using (is_authorized(doctor_id)) with check (is_authorized(doctor_id));

-- booking_slugs must be readable by the public (unauthenticated) booking page —
-- it's looked up by slug before any login happens, mirroring the Firestore
-- version's public read via the Admin SDK.
create policy booking_slugs_public_read on booking_slugs for select using (true);

-- A doctor may register their OWN slug directly from the client (Settings
-- page auto-generates one on first visit) — mirrors the existing Firestore
-- rules, which allow an authenticated doctor to write their own bookingSlugs
-- doc. Everything else (admin-created rows) goes through the service-role key.
create policy booking_slugs_self_insert on booking_slugs for insert with check (doctor_id = auth.uid());

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Enables live subscribe()/subscribeWhere() support (Supabase Realtime respects
-- the RLS policies above).

alter publication supabase_realtime add table
  patients, appointments, invoices, expenses, followups, notifications,
  blocked_slots, calendar_events, chat, leads, staff, inventory,
  visits, progress_notes;

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- doctor_id is already the leading column of every composite primary key above,
-- so tenant-scoped lookups are indexed by default. Add the few extra indexes
-- the app's actual query patterns need (patientId lookups, date lookups):

create index if not exists idx_appointments_patient on appointments ((data->>'patientId'));
create index if not exists idx_appointments_date    on appointments ((data->>'date'));
create index if not exists idx_invoices_patient     on invoices ((data->>'patientId'));
create index if not exists idx_visits_patient       on visits (doctor_id, patient_id);
create index if not exists idx_progress_notes_patient on progress_notes (doctor_id, patient_id);
