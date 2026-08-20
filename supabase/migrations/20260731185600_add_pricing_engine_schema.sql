/*
# Add pricing engine schema

1. New Tables
  - `item_pricings`
    - `id` (uuid, primary key)
    - `item_id` (uuid, FK to items, nullable)
    - `identification_id` (uuid, FK to item_identifications)
    - `search_query` (text, the query used on eBay)
    - `median_sold_cents` (integer)
    - `min_sold_cents` (integer, IQR lower bound)
    - `max_sold_cents` (integer, IQR upper bound)
    - `recommended_list_cents` (integer)
    - `quick_sale_cents` (integer)
    - `confidence_level` (text, high/medium/low)
    - `confidence_score` (integer 0-100)
    - `comparable_count` (integer)
    - `comparables` (jsonb, array of sold listing details)
    - `outliers_removed` (integer)
    - `created_at` (timestamptz)

2. Modified Tables
  - `items`: adds `pricing_id` (uuid, FK to item_pricings) referencing
    the most recent pricing run.

3. Security
  - RLS enabled on item_pricings. anon + authenticated (no sign-in).
*/

CREATE TABLE IF NOT EXISTS item_pricings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  identification_id uuid REFERENCES item_identifications(id) ON DELETE CASCADE,
  search_query text NOT NULL DEFAULT '',
  median_sold_cents integer NOT NULL DEFAULT 0,
  min_sold_cents integer NOT NULL DEFAULT 0,
  max_sold_cents integer NOT NULL DEFAULT 0,
  recommended_list_cents integer NOT NULL DEFAULT 0,
  quick_sale_cents integer NOT NULL DEFAULT 0,
  confidence_level text NOT NULL DEFAULT 'medium' CHECK (confidence_level IN ('high','medium','low')),
  confidence_score integer NOT NULL DEFAULT 50,
  comparable_count integer NOT NULL DEFAULT 0,
  comparables jsonb NOT NULL DEFAULT '[]',
  outliers_removed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS item_pricings_item_idx ON item_pricings(item_id);
CREATE INDEX IF NOT EXISTS item_pricings_ident_idx ON item_pricings(identification_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='pricing_id') THEN
    ALTER TABLE items ADD COLUMN pricing_id uuid REFERENCES item_pricings(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE item_pricings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_item_pricings" ON item_pricings;
CREATE POLICY "anon_select_item_pricings" ON item_pricings FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_item_pricings" ON item_pricings;
CREATE POLICY "anon_insert_item_pricings" ON item_pricings FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_item_pricings" ON item_pricings;
CREATE POLICY "anon_update_item_pricings" ON item_pricings FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_item_pricings" ON item_pricings;
CREATE POLICY "anon_delete_item_pricings" ON item_pricings FOR DELETE
TO anon, authenticated USING (true);
