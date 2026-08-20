import { createClient } from '@supabase/supabase-js';
import type { DecisionFactor } from './decisionEngine';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Recommendation   = 'keep' | 'sell' | 'donate' | 'recycle' | 'trash';
export type UserDecision     = Recommendation | 'decide_later';
export type Condition        = 'excellent' | 'good' | 'fair' | 'poor';
export type EffortLevel      = 'low' | 'medium' | 'high';
export type ProjectGoal      = 'space' | 'move' | 'downsize' | 'organize' | 'estate' | 'sell';
export type ProjectStyle     = 'cautious' | 'balanced' | 'aggressive';
export type ProjectStatus    = 'active' | 'completed';
export type TaskCategory     = 'today' | 'this_week';
export type ScanType         = 'single' | 'group' | 'angle' | 'label';
export type ConfidenceLevel  = 'high' | 'medium' | 'low';

export interface Project {
  id: string;
  name: string;
  room_type: string;
  emoji: string;
  notes: string | null;
  goal: ProjectGoal;
  style: ProjectStyle;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  project_id: string;
  name: string;
  photo_url: string | null;
  resale_value_cents: number;
  resale_value_min_cents: number;
  resale_value_max_cents: number;
  replacement_cost_cents: number;
  confidence_score: number;          // 0–100 (legacy, kept for ConfidenceRing)
  confidence_level: ConfidenceLevel; // 'high' | 'medium' | 'low'
  recommendation: Recommendation;
  user_decision: UserDecision | null;
  override_reason: string | null;
  explanation: string;
  category: string | null;
  condition: Condition;
  effort_level: EffortLevel;
  listing_price_cents: number;
  net_proceeds_cents: number;
  notes: string | null;
  needs_questions: boolean;
  scan_type: ScanType;
  decision_factors: DecisionFactor[] | null;
  ai_scores: Record<string, number> | null;
  item_factors: Record<string, unknown> | null;
  what_if_context: Record<string, unknown> | null;
  created_at: string;
}

export interface Listing {
  id: string;
  item_id: string;
  title: string;
  description: string;
  asking_price_cents: number;
  min_price_cents: number;
  platform_facebook: boolean;
  platform_ebay: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  category: TaskCategory;
  title: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
}

export interface ItemAnswer {
  id: string;
  item_id: string;
  question: string;
  answer: string;
  created_at: string;
}

export const formatDollars = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);

export const GOAL_LABELS: Record<ProjectGoal, string> = {
  space:    'Create more space',
  move:     'Prepare for a move',
  downsize: 'Downsize',
  organize: 'Organize the room',
  estate:   "Clear out someone else's belongings",
  sell:     'Sell unused items',
};

export const STYLE_META: Record<ProjectStyle, { label: string; description: string }> = {
  cautious: {
    label: 'Cautious',
    description: 'Recommend keeping items when uncertain. Better safe than sorry.',
  },
  balanced: {
    label: 'Balanced',
    description: 'Consider usage, replacement cost, condition, and value together.',
  },
  aggressive: {
    label: 'Aggressive',
    description: 'Prioritize reclaiming space and reducing clutter. When in doubt, let it go.',
  },
};
