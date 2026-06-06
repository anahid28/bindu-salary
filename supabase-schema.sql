-- Run this in Supabase SQL Editor to set up your database

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null unique,
  name text not null,
  designation text not null,
  branch_id uuid references branches(id) on delete set null,
  basic_salary numeric not null default 0,
  yearly_leave_allowance int not null default 1,
  conveyance numeric not null default 1500,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists salary_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  month int not null check (month between 1 and 12),
  year int not null,
  advance_deducted numeric not null default 0,
  leave_days_taken numeric not null default 0,
  late_days int not null default 0,
  ot_days numeric not null default 0,
  attendance_bonus numeric not null default 0,
  notes text not null default '',
  created_at timestamptz default now(),
  unique(employee_id, month, year)
);

create table if not exists eid_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  title text not null default 'Eid ul Adha Bonus 2026',
  year int not null,
  salary_payment_pct numeric not null default 50,
  advance_deducted numeric not null default 0,
  eid_bonus_pct numeric not null default 50,
  created_at timestamptz default now(),
  unique(employee_id, year, title)
);

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null default 'Bindu Premium',
  logo_url text,
  generated_by text not null default 'Nahid',
  payment_by text not null default '',
  updated_at timestamptz default now()
);

-- Insert default settings
insert into settings (company_name, generated_by) values ('Bindu Premium', 'Nahid')
on conflict do nothing;

-- Seed branches from existing data
insert into branches (name) values
  ('Cox Branch'),
  ('Teknaf Branch'),
  ('Basurhat Branch'),
  ('Dorga Branch'),
  ('Jessore Branch'),
  ('Lama Branch'),
  ('Sylhet Branch'),
  ('Office')
on conflict do nothing;
