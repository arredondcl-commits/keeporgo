import React, { useEffect, useState } from 'react';
import { Trash2, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, formatDollars, type Item, type Listing, type UserDecision } from '@/lib/supabase';
import { NavBar } from '@/components/NavBar';
import { RecommendationBadge } from '@/components/RecommendationBadge';
import { ConfidenceLabel } from '@/components/ConfidenceLabel';
import { WhyPanel } from '@/components/WhyPanel';
import { WhatIfPanel } from '@/components/WhatIfPanel';
import { PricingPanel } from '@/components/PricingPanel';
import { ChangeRecommendation } from '@/components/ChangeRecommendation';
import { loadPricingForItem, type PricingResult } from '@/lib/pricing';
import type { DecisionFactor, ItemFactors } from '@/lib/decisionEngine';
import { recordDecision } from '@/lib/preferences';

interface ItemDetailProps {
  item: Item;
  onBack: () => void;
  onDeleted: () => void;
  onCreateListing: (item: Item) => void;
}

const DECISION_OPTS: { value: UserDecision; label: string; active: string; ring: string }[] = [
  { value: 'keep',         label: 'Keep',         active: 'bg-emerald-600 text-white border-emerald-600', ring: 'ring-emerald-400' },
  { value: 'sell',         label: 'Sell',         active: 'bg-blue-600 text-white border-blue-600',       ring: 'ring-blue-400' },
  { value: 'donate',       label: 'Donate',       active: 'bg-amber-500 text-white border-amber-500',     ring: 'ring-amber-400' },
  { value: 'recycle',      label: 'Recycle',      active: 'bg-teal-600 text-white border-teal-600',       ring: 'ring-teal-400' },
  { value: 'trash',        label: 'Trash',        active: 'bg-stone-700 text-white border-stone-700',     ring: 'ring-stone-400' },
  { value: 'decide_later', label: 'Decide later', active: 'bg-purple-600 text-white border-purple-600',   ring: 'ring-purple-400' },
];

const EFFORT_META: Record<string, { label: string; color: string; desc: string }> = {
  low:    { label: 'Low effort',    color: 'text-emerald-600', desc: 'Small and shippable — easy to list.' },
  medium: { label: 'Medium effort', color: 'text-amber-600',   desc: 'Requires some coordination — local pickup likely.' },
  high:   { label: 'High effort',   color: 'text-red-500',     desc: 'Large or bulky — significant time to coordinate.' },
};

export function ItemDetail({ item: initialItem, onBack, onDeleted, onCreateListing }: ItemDetailProps) {
  const [item, setItem]           = useState(initialItem);
  const [listing, setListing]     = useState<Listing | null>(null);
  const [savingDecision, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pricing, setPricing] = useState<PricingResult | null>(null);

  useEffect(() => {
    supabase
      .from('listings')
      .select('*')
      .eq('item_id', item.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setListing(data); });
    loadPricingForItem(item.id).then(setPricing);
  }, [item.id]);

  async function setDecision(d: UserDecision) {
    if (d === item.user_decision) return;
    setSaving(true);
    setItem((prev) => ({ ...prev, user_decision: d }));
    await supabase.from('items').update({ user_decision: d }).eq('id', item.id);
    await recordDecision({
      projectId: item.project_id,
      category: item.category,
      aiRecommendation: item.recommendation,
      userDecision: d,
    });
    setSaving(false);
  }

  async function deleteItem() {
    setDeleting(true);
    await supabase.from('items').delete().eq('id', item.id);
    onDeleted();
  }

  const decision  = item.user_decision ?? item.recommendation;
  const isOverride = item.user_decision !== null && item.user_decision !== item.recommendation;
  const factors   = (item.decision_factors ?? []) as DecisionFactor[];
  const baseItemFactors = item.item_factors as ItemFactors | null;
  const confidence = (item.confidence_level ?? 'medium') as 'high' | 'medium' | 'low';
  const effort    = EFFORT_META[item.effort_level] ?? EFFORT_META.medium;

  return (
    <>
      <NavBar
        title={item.name}
        onBack={onBack}
        right={
          <button onClick={() => setConfirmDelete(true)} className="p-1 text-stone-400 hover:text-red-500 transition-colors">
            <Trash2 size={18} />
          </button>
        }
      />

      <div className="max-w-lg mx-auto px-4 py-5 space-y-3 pb-12">

        {/* Photo */}
        {item.photo_url && (
          <div className="w-full aspect-video rounded-3xl overflow-hidden shadow-md">
            <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Main card */}
        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
          <div className="p-5 border-b border-stone-50">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                {item.category && <p className="text-xs text-stone-400 mb-0.5">{item.category}</p>}
                <h1 className="text-xl font-bold text-stone-900">{item.name}</h1>
                <p className="text-xs text-stone-400 mt-0.5 capitalize">Condition: {item.condition}</p>
              </div>
              <ConfidenceLabel level={confidence} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-stone-400">AI recommends:</span>
              <RecommendationBadge recommendation={item.recommendation} />
              {isOverride && (
                <>
                  <span className="text-xs text-stone-400">You chose:</span>
                  <RecommendationBadge recommendation={item.user_decision!} />
                </>
              )}
            </div>

            {isOverride && item.override_reason && (
              <p className="mt-2 text-xs text-stone-500 italic border-l-2 border-stone-200 pl-2">
                Your reason: {item.override_reason}
              </p>
            )}
          </div>

          {/* Explanation */}
          <div className="p-5 border-b border-stone-50">
            <p className="text-sm text-stone-700 leading-relaxed">{item.explanation}</p>
          </div>

          {/* Value row */}
          <div className="grid grid-cols-2 divide-x divide-stone-50">
            <div className="p-4">
              <p className="text-xs text-stone-400 mb-0.5">Est. resale range</p>
              <p className="text-lg font-bold text-stone-900">
                {item.resale_value_min_cents > 0
                  ? `${formatDollars(item.resale_value_min_cents)}–${formatDollars(item.resale_value_max_cents)}`
                  : '—'}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">Based on similar items</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-stone-400 mb-0.5">Replacement cost</p>
              <p className="text-lg font-bold text-stone-900">
                {item.replacement_cost_cents > 0 ? formatDollars(item.replacement_cost_cents) : '—'}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">Estimated retail</p>
            </div>
          </div>

          {/* Sell extras */}
          {item.recommendation === 'sell' && item.listing_price_cents > 0 && (
            <div className="border-t border-stone-50 px-5 py-4 bg-blue-50">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-blue-500 mb-0.5">Suggested listing</p>
                  <p className="text-lg font-bold text-blue-900">{formatDollars(item.listing_price_cents)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-500 mb-0.5">Est. net proceeds</p>
                  <p className="text-lg font-bold text-blue-900">~{formatDollars(item.net_proceeds_cents)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2.5">
                <span className="text-xs text-blue-500">Sell effort:</span>
                <span className={`text-xs font-semibold ${effort.color}`}>{effort.label}</span>
                <span className="text-xs text-blue-400 flex-1 truncate">· {effort.desc}</span>
              </div>
            </div>
          )}
        </div>

        {/* Pricing panel */}
        <PricingPanel
          identification={{
            object_name: item.name,
            brand: null,
            model: null,
            category: item.category,
            condition: item.condition,
          }}
          itemId={item.id}
          projectId={item.project_id}
          initialPricing={pricing}
          onPriced={setPricing}
        />

        {/* Change recommendation */}
        <ChangeRecommendation
          currentRecommendation={item.recommendation}
          onChange={(rec) => setDecision(rec)}
        />

        {/* Why panel */}
        <WhyPanel
          explanation={item.explanation}
          factors={factors}
          defaultOpen={factors.length > 0}
        />

        {/* What if panel */}
        {baseItemFactors && (
          <WhatIfPanel
            baseFactors={baseItemFactors}
            originalRecommendation={item.recommendation}
          />
        )}

        {/* Your decision */}
        <div>
          <p className="text-xs text-stone-400 font-semibold uppercase tracking-wide mb-2">Your decision</p>
          <div className="grid grid-cols-3 gap-2">
            {DECISION_OPTS.map(({ value, label, active, ring }) => (
              <button
                key={value}
                onClick={() => setDecision(value)}
                disabled={savingDecision}
                className={`border rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-60 ${
                  decision === value
                    ? `${active} ring-2 ring-offset-1 ${ring}`
                    : 'border-stone-200 text-stone-600 hover:border-stone-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate listing for sell items */}
        {(item.user_decision === 'sell' || (!item.user_decision && item.recommendation === 'sell')) && (
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
            {listing ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Listing ready</p>
                  <span className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 font-medium">Created</span>
                </div>
                <p className="text-sm font-semibold text-stone-900 mb-1">{listing.title}</p>
                <p className="text-sm text-stone-500">{formatDollars(listing.asking_price_cents)} asking</p>
              </div>
            ) : (
              <button
                onClick={() => onCreateListing(item)}
                className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-stone-800 transition-colors"
              >
                <Tag size={14} />
                Generate marketplace listing
              </button>
            )}
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Your note</p>
            <p className="text-sm text-stone-700">{item.notes}</p>
          </div>
        )}

        {/* AI score breakdown (advanced) */}
        {item.ai_scores && (
          <div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showHistory ? 'Hide' : 'Show'} AI score breakdown
            </button>
            {showHistory && (
              <div className="mt-2 bg-stone-50 rounded-2xl p-4 border border-stone-100">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Decision scores</p>
                <div className="space-y-2">
                  {Object.entries(item.ai_scores)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([key, score]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-stone-500 w-20 capitalize">{key}</span>
                        <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${key === item.recommendation ? 'bg-stone-900' : 'bg-stone-300'}`}
                            style={{ width: `${Math.min(100, Math.max(0, score as number))}%` }}
                          />
                        </div>
                        <span className="text-xs text-stone-400 w-8 text-right">{Math.round(score as number)}</span>
                      </div>
                    ))}
                </div>
                <p className="text-xs text-stone-400 mt-2 italic">Scores before goal and style modifiers.</p>
              </div>
            )}
          </div>
        )}

        {/* Confidence footnote */}
        <p className="text-xs text-stone-400 text-center px-2 pb-2">
          {confidence === 'high'
            ? 'High confidence — strong match from visual and market data.'
            : confidence === 'medium'
            ? 'Moderate confidence — additional photos or answers may improve accuracy.'
            : 'Lower confidence — consider adding a label photo or model number.'}
        </p>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-stone-900 mb-2">Remove this item?</h2>
            <p className="text-sm text-stone-500 mb-5">"{item.name}" will be permanently removed from this project.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 border border-stone-200 text-stone-700 rounded-xl py-3 text-sm font-semibold hover:bg-stone-50">
                Cancel
              </button>
              <button onClick={deleteItem} disabled={deleting} className="flex-1 bg-red-500 text-white rounded-xl py-3 text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors">
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
