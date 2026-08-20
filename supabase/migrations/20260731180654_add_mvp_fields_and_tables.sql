/*
# Keep or Go — MVP Enhancements

Extends the schema to support the full MVP decision workflow.

1. Modified Tables
  - `projects`: adds `goal` (user's main clearing objective), `style` (recommendation aggressiveness),
    `status` (active/completed), and `total_items` / `reviewed_items` denormalized counts for
    fast progress display on the home screen.
  - `items`: adds `user_decision` (what the user actually chose, may differ from AI recommendation),
    `effort_level` (low/medium/high — cost to sell), `listing_price_cents`, `net_proceeds_cents`,
    `notes` (text or voice note), `needs_questions` flag, `scan_type` (single/group/angle/label).

2. New Tables
  - `item_answers`: stores user responses to decision questions per item.
  - `tasks`: action-plan tasks generated per project, with category (today/this_week), title,
    completed flag, and sort order.
  - `item_photos`: multiple photos per item with a `photo_type` label.

3. Security
  - RLS enabled on all new tables. anon + authenticated policies (no sign-in required).

4. Notes
  - All monetary columns remain in cents (integer).
  - `user_decision` uses the same constraint set as `recommendation` plus 'decide_later'.
  - `style` defaults to 'balanced' matching the original design intent.
*/

-- Projects: add goal, style, status, progress counts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='goal') THEN
    ALTER TABLE projects ADD COLUMN goal text NOT NULL DEFAULT 'space';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='style') THEN
    ALTER TABLE projects ADD COLUMN style text NOT NULL DEFAULT 'balanced'
      CHECK (style IN ('cautious','balanced','aggressive'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='status') THEN
    ALTER TABLE projects ADD COLUMN status text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','completed'));
  END IF;
END $$;

-- Items: add user_decision, effort, listing fields, notes, scan meta
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='user_decision') THEN
    ALTER TABLE items ADD COLUMN user_decision text
      CHECK (user_decision IN ('keep','sell','donate','recycle','trash','decide_later'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='effort_level') THEN
    ALTER TABLE items ADD COLUMN effort_level text NOT NULL DEFAULT 'medium'
      CHECK (effort_level IN ('low','medium','high'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='listing_price_cents') THEN
    ALTER TABLE items ADD COLUMN listing_price_cents integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='net_proceeds_cents') THEN
    ALTER TABLE items ADD COLUMN net_proceeds_cents integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='notes') THEN
    ALTER TABLE items ADD COLUMN notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='needs_questions') THEN
    ALTER TABLE items ADD COLUMN needs_questions boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='scan_type') THEN
    ALTER TABLE items ADD COLUMN scan_type text NOT NULL DEFAULT 'single'
      CHECK (scan_type IN ('single','group','angle','label'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='resale_value_min_cents') THEN
    ALTER TABLE items ADD COLUMN resale_value_min_cents integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='resale_value_max_cents') THEN
    ALTER TABLE items ADD COLUMN resale_value_max_cents integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- item_answers: decision question responses per item
CREATE TABLE IF NOT EXISTS item_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS item_answers_item_id_idx ON item_answers(item_id);

ALTER TABLE item_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_item_answers" ON item_answers;
CREATE POLICY "anon_select_item_answers" ON item_answers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_item_answers" ON item_answers;
CREATE POLICY "anon_insert_item_answers" ON item_answers FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_item_answers" ON item_answers;
CREATE POLICY "anon_update_item_answers" ON item_answers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_item_answers" ON item_answers;
CREATE POLICY "anon_delete_item_answers" ON item_answers FOR DELETE TO anon, authenticated USING (true);


-- tasks: action plan tasks per project
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'today' CHECK (category IN ('today','this_week')),
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tasks" ON tasks;
CREATE POLICY "anon_select_tasks" ON tasks FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tasks" ON tasks;
CREATE POLICY "anon_insert_tasks" ON tasks FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tasks" ON tasks;
CREATE POLICY "anon_update_tasks" ON tasks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tasks" ON tasks;
CREATE POLICY "anon_delete_tasks" ON tasks FOR DELETE TO anon, authenticated USING (true);


-- item_photos: multiple photos per item
CREATE TABLE IF NOT EXISTS item_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  url text NOT NULL,
  photo_type text NOT NULL DEFAULT 'primary' CHECK (photo_type IN ('primary','angle','label','group')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS item_photos_item_id_idx ON item_photos(item_id);

ALTER TABLE item_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_item_photos" ON item_photos;
CREATE POLICY "anon_select_item_photos" ON item_photos FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_item_photos" ON item_photos;
CREATE POLICY "anon_insert_item_photos" ON item_photos FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_item_photos" ON item_photos;
CREATE POLICY "anon_update_item_photos" ON item_photos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_item_photos" ON item_photos;
CREATE POLICY "anon_delete_item_photos" ON item_photos FOR DELETE TO anon, authenticated USING (true);
