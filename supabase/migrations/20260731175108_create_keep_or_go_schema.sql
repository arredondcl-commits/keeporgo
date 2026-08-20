/*
# Keep or Go — Core Schema

Creates the full data model for the Keep or Go decluttering app.

1. New Tables
  - `projects`: A decluttering project per room/space. Stores name, room type, emoji, and summary stats.
  - `items`: Every item scanned within a project. Stores AI analysis results — name, estimated values, recommendation, explanation, confidence score, and a photo URL placeholder.
  - `listings`: Marketplace-ready selling listings generated for items tagged "sell".

2. Security
  - RLS enabled on all three tables.
  - No sign-in required — uses anon + authenticated policies so the anon-key frontend can fully operate.

3. Notes
  - Recommendations are constrained to: keep, sell, donate, recycle, trash.
  - Confidence scores are stored as integers 0–100.
  - All monetary values are stored in USD cents (integer) to avoid float precision issues. Frontend divides by 100.
*/

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  room_type text NOT NULL DEFAULT 'other',
  emoji text NOT NULL DEFAULT '📦',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_projects" ON projects;
CREATE POLICY "anon_select_projects" ON projects FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_projects" ON projects;
CREATE POLICY "anon_insert_projects" ON projects FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_projects" ON projects;
CREATE POLICY "anon_update_projects" ON projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_projects" ON projects;
CREATE POLICY "anon_delete_projects" ON projects FOR DELETE TO anon, authenticated USING (true);


CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  photo_url text,
  resale_value_cents integer NOT NULL DEFAULT 0,
  replacement_cost_cents integer NOT NULL DEFAULT 0,
  confidence_score integer NOT NULL DEFAULT 70 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  recommendation text NOT NULL DEFAULT 'keep' CHECK (recommendation IN ('keep','sell','donate','recycle','trash')),
  explanation text NOT NULL DEFAULT '',
  category text,
  condition text NOT NULL DEFAULT 'good' CHECK (condition IN ('excellent','good','fair','poor')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS items_project_id_idx ON items(project_id);
CREATE INDEX IF NOT EXISTS items_recommendation_idx ON items(recommendation);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_items" ON items;
CREATE POLICY "anon_select_items" ON items FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_items" ON items;
CREATE POLICY "anon_insert_items" ON items FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_items" ON items;
CREATE POLICY "anon_update_items" ON items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_items" ON items;
CREATE POLICY "anon_delete_items" ON items FOR DELETE TO anon, authenticated USING (true);


CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  asking_price_cents integer NOT NULL DEFAULT 0,
  min_price_cents integer NOT NULL DEFAULT 0,
  platform_facebook boolean NOT NULL DEFAULT true,
  platform_ebay boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listings_item_id_idx ON listings(item_id);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_listings" ON listings;
CREATE POLICY "anon_select_listings" ON listings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_listings" ON listings;
CREATE POLICY "anon_insert_listings" ON listings FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_listings" ON listings;
CREATE POLICY "anon_update_listings" ON listings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_listings" ON listings;
CREATE POLICY "anon_delete_listings" ON listings FOR DELETE TO anon, authenticated USING (true);
