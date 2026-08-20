import { supabase } from './supabase';
import type { IdentificationResult } from './imageAnalysis';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComparableListing {
  title: string;
  price_cents: number;
  condition: string | null;
  url: string | null;
  image_url: string | null;
  shipping_price_cents: number | null;
  item_id: string | null;
}

export interface PricingResult {
  median_sold_cents: number;
  min_sold_cents: number;
  max_sold_cents: number;
  recommended_list_cents: number;
  quick_sale_cents: number;
  confidence_level: 'high' | 'medium' | 'low';
  confidence_score: number;
  comparable_count: number;
  comparables: ComparableListing[];
  outliers_removed: number;
  search_query: string;
  source: 'ebay_browse' | 'ai_estimate';
}

export interface PriceRequest {
  identification: Pick<IdentificationResult, 'object_name' | 'brand' | 'model' | 'category' | 'condition'>;
  corrected_model?: string | null;
  project_id?: string;
  item_id?: string;
  identification_id?: string;
}

export class PricingError extends Error {
  constructor(message: string, public readonly hint?: string) {
    super(message);
    this.name = 'PricingError';
  }
}

// ─── API call ────────────────────────────────────────────────────────────────

export async function priceItem(req: PriceRequest): Promise<PricingResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const apiUrl = `${supabaseUrl}/functions/v1/price-item`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
    },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    let message = `Pricing failed (${response.status})`;
    try {
      const errorBody = await response.json();
      message = errorBody.error || message;
    } catch { /* use default */ }
    throw new PricingError(message);
  }

  const data = await response.json();

  if (!data || typeof data.median_sold_cents !== 'number') {
    throw new PricingError('Invalid response from pricing service');
  }

  return data as PricingResult;
}

// ─── Load pricing from database ──────────────────────────────────────────────

export async function loadPricingForItem(itemId: string): Promise<PricingResult | null> {
  const { data } = await supabase
    .from('item_pricings')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    median_sold_cents: data.median_sold_cents,
    min_sold_cents: data.min_sold_cents,
    max_sold_cents: data.max_sold_cents,
    recommended_list_cents: data.recommended_list_cents,
    quick_sale_cents: data.quick_sale_cents,
    confidence_level: data.confidence_level,
    confidence_score: data.confidence_score,
    comparable_count: data.comparable_count,
    comparables: (data.comparables ?? []) as ComparableListing[],
    outliers_removed: data.outliers_removed,
    search_query: data.search_query,
    source: data.source ?? 'ai_estimate',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function getSourceLabel(source: string): string {
  return source === 'ebay_browse' ? 'eBay active listings' : 'AI estimate';
}
