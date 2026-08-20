import React, { useState, useCallback } from 'react';
import { TrendingUp, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Pencil, X, Check, AlertCircle } from 'lucide-react';
import { ConfidenceLabel } from './ConfidenceLabel';
import { priceItem, formatPrice, getSourceLabel, type PricingResult, type PriceRequest } from '@/lib/pricing';
import type { IdentificationResult } from '@/lib/imageAnalysis';

interface PricingPanelProps {
  identification: Pick<IdentificationResult, 'object_name' | 'brand' | 'model' | 'category' | 'condition'>;
  identificationId?: string;
  projectId?: string;
  itemId?: string;
  initialPricing?: PricingResult | null;
  onPriced?: (result: PricingResult) => void;
  defaultOpen?: boolean;
}

export function PricingPanel({
  identification,
  identificationId,
  projectId,
  itemId,
  initialPricing = null,
  onPriced,
  defaultOpen = true,
}: PricingPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [pricing, setPricing] = useState<PricingResult | null>(initialPricing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComparables, setShowComparables] = useState(false);
  const [editingModel, setEditingModel] = useState(false);
  const [modelInput, setModelInput] = useState(identification.model ?? '');
  const [correctedModel, setCorrectedModel] = useState<string | null>(null);

  const effectiveModel = correctedModel ?? identification.model;
  const hasPriced = pricing !== null;

  const runPricing = useCallback(async (modelOverride?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const req: PriceRequest = {
        identification,
        corrected_model: modelOverride !== undefined ? modelOverride : correctedModel,
        project_id: projectId,
        item_id: itemId,
        identification_id: identificationId,
      };
      const result = await priceItem(req);
      setPricing(result);
      onPriced?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get pricing';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [identification, correctedModel, projectId, itemId, identificationId, onPriced]);

  function handleSaveModel() {
    setCorrectedModel(modelInput.trim() || null);
    setEditingModel(false);
    // Re-run pricing with corrected model
    runPricing(modelInput.trim() || null);
  }

  function handleCancelEdit() {
    setModelInput(effectiveModel ?? '');
    setEditingModel(false);
  }

  return (
    <div className="rounded-2xl border border-stone-100 overflow-hidden bg-white">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-stone-400 shrink-0" />
          <span className="text-sm font-semibold text-stone-700">Resale pricing</span>
          {pricing && (
            <span className="text-xs text-stone-400">
              · {formatPrice(pricing.median_sold_cents)} median
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">

          {/* Model correction */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-stone-400">Pricing based on:</span>
            {editingModel ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <input
                  type="text"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveModel(); if (e.key === 'Escape') handleCancelEdit(); }}
                  placeholder="Enter correct model..."
                  className="flex-1 min-w-0 border border-stone-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-stone-900"
                  autoFocus
                />
                <button onClick={handleSaveModel} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                  <Check size={14} />
                </button>
                <button onClick={handleCancelEdit} className="p-1 text-stone-400 hover:bg-stone-100 rounded">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <span className="font-medium text-stone-700">
                  {identification.brand ? `${identification.brand} ` : ''}
                  {effectiveModel ?? identification.object_name}
                </span>
                {correctedModel && <span className="text-amber-500 text-xs">(corrected)</span>}
                <button
                  onClick={() => { setModelInput(effectiveModel ?? ''); setEditingModel(true); }}
                  className="flex items-center gap-0.5 text-stone-400 hover:text-stone-700 transition-colors"
                >
                  <Pencil size={11} />
                  <span>Correct</span>
                </button>
              </>
            )}
          </div>

          {/* Pricing results */}
          {loading && (
            <div className="flex items-center justify-center py-6 gap-2">
              <RefreshCw size={16} className="text-stone-400 animate-spin" />
              <span className="text-sm text-stone-400">Searching sold listings…</span>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-2 bg-red-50 rounded-xl p-3 border border-red-100">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-700 font-medium">{error}</p>
                <button onClick={() => runPricing()} className="text-xs text-red-500 hover:text-red-700 mt-1 underline">
                  Try again
                </button>
              </div>
            </div>
          )}

          {pricing && !loading && !error && (
            <>
              {/* Price grid */}
              <div className="grid grid-cols-2 gap-2">
                <PriceCell label="Median sold" value={formatPrice(pricing.median_sold_cents)} highlight />
                <PriceCell label="Price range" value={`${formatPrice(pricing.min_sold_cents)}–${formatPrice(pricing.max_sold_cents)}`} />
                <PriceCell label="Recommended list" value={formatPrice(pricing.recommended_list_cents)} accent="blue" />
                <PriceCell label="Quick sale" value={formatPrice(pricing.quick_sale_cents)} accent="amber" />
              </div>

              {/* Confidence + source */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <ConfidenceLabel level={pricing.confidence_level} size="sm" />
                <span className="text-xs text-stone-400">
                  {pricing.comparable_count} comparable{pricing.comparable_count !== 1 ? 's' : ''}
                  {pricing.outliers_removed > 0 && ` · ${pricing.outliers_removed} outlier${pricing.outliers_removed !== 1 ? 's' : ''} removed`}
                  {' · '}
                  {getSourceLabel(pricing.source)}
                </span>
              </div>

              {/* Comparables toggle */}
              {pricing.comparables.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowComparables(!showComparables)}
                    className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 transition-colors"
                  >
                    {showComparables ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {showComparables ? 'Hide' : 'Show'} comparable sold items ({pricing.comparables.length})
                  </button>

                  {showComparables && (
                    <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                      {pricing.comparables.map((c, i) => (
                        <a
                          key={i}
                          href={c.url ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 bg-stone-50 rounded-xl p-2 hover:bg-stone-100 transition-colors group"
                        >
                          {c.image_url ? (
                            <img src={c.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-stone-200 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-stone-700 truncate">{c.title}</p>
                            <div className="flex items-center gap-2 text-xs text-stone-400">
                              <span className="font-semibold text-stone-600">{formatPrice(c.price_cents)}</span>
                              {c.condition && <span className="capitalize">{c.condition}</span>}
                              {c.shipping_price_cents !== null && c.shipping_price_cents > 0 && (
                                <span>+ {formatPrice(c.shipping_price_cents)} ship</span>
                              )}
                            </div>
                          </div>
                          <ExternalLink size={12} className="text-stone-300 group-hover:text-stone-500 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Recalculate button */}
              <button
                onClick={() => runPricing()}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-700 transition-colors"
              >
                <RefreshCw size={12} />
                Recalculate estimates
              </button>
            </>
          )}

          {/* Initial price button */}
          {!hasPriced && !loading && !error && (
            <button
              onClick={() => runPricing()}
              className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-stone-800 transition-colors"
            >
              <TrendingUp size={14} />
              Get resale estimate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PriceCell({ label, value, highlight, accent }: { label: string; value: string; highlight?: boolean; accent?: 'blue' | 'amber' }) {
  const bg = accent === 'blue' ? 'bg-blue-50' : accent === 'amber' ? 'bg-amber-50' : highlight ? 'bg-stone-900 text-white' : 'bg-stone-50';
  const text = accent === 'blue' ? 'text-blue-900' : accent === 'amber' ? 'text-amber-900' : highlight ? 'text-white' : 'text-stone-900';
  const labelColor = highlight ? 'text-stone-300' : 'text-stone-400';
  return (
    <div className={`rounded-xl p-3 ${bg}`}>
      <p className={`text-xs mb-0.5 ${labelColor}`}>{label}</p>
      <p className={`text-base font-bold ${text}`}>{value}</p>
    </div>
  );
}
