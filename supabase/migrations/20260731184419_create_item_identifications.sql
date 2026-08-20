/*
# Create item_identifications table

Stores every AI identification result from the OpenAI Responses API.
Each row is one analysis of one photo (or set of photos) for one item.

1. New Tables
  - `item_identifications`
    - `id` (uuid, primary key)
    - `item_id` (uuid, FK to items, nullable until an item row is created)
    - `project_id` (uuid, FK to projects, for orphan analyses)
    - `photo_urls` (text[], the images that were analyzed)
    - `object_name` (text, what the AI thinks the item is)
    - `brand` (text, nullable)
    - `model` (text, nullable)
    - `category` (text, nullable)
    - `condition` (text, nullable)
    - `accessories` (text[], nullable)
    - `replacement_cost_cents` (integer, nullable)
    - `confidence_level` (text, high/medium/low)
    - `confidence_score` (integer, 0-100)
    - `needs_more_photos` (boolean, true when AI requests additional photos)
    - `missing_info` (text[], what's missing — brand, model, size, condition, accessories)
    - `raw_response` (jsonb, full OpenAI response for audit)
    - `created_at` (timestamptz)

2. Security
  - RLS enabled. anon + authenticated (no sign-in required).
*/

CREATE TABLE IF NOT EXISTS item_identifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  photo_urls text[] NOT NULL DEFAULT '{}',
  object_name text NOT NULL DEFAULT '',
  brand text,
  model text,
  category text,
  condition text,
  accessories text[] NOT NULL DEFAULT '{}',
  replacement_cost_cents integer,
  confidence_level text NOT NULL DEFAULT 'medium' CHECK (confidence_level IN ('high','medium','low')),
  confidence_score integer NOT NULL DEFAULT 50,
  needs_more_photos boolean NOT NULL DEFAULT false,
  missing_info text[] NOT NULL DEFAULT '{}',
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS item_identifications_item_idx ON item_identifications(item_id);
CREATE INDEX IF NOT EXISTS item_identifications_project_idx ON item_identifications(project_id);

ALTER TABLE item_identifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_item_identifications" ON item_identifications;
CREATE POLICY "anon_select_item_identifications" ON item_identifications FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_item_identifications" ON item_identifications;
CREATE POLICY "anon_insert_item_identifications" ON item_identifications FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_item_identifications" ON item_identifications;
CREATE POLICY "anon_update_item_identifications" ON item_identifications FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_item_identifications" ON item_identifications;
CREATE POLICY "anon_delete_item_identifications" ON item_identifications FOR DELETE
TO anon, authenticated USING (true);
