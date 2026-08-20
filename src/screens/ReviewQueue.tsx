import React, { useEffect, useState, useCallback, useRef } from 'react';
import { RotateCcw, ChevronLeft, ChevronRight, X, Check, Clock, ArrowRight } from 'lucide-react';
import { supabase, formatDollars, type Item, type UserDecision, type Project } from '@/lib/supabase';
import { NavBar } from '@/components/NavBar';
import { RecommendationBadge } from '@/components/RecommendationBadge';
import { ConfidenceLabel } from '@/components/ConfidenceLabel';
import { WhyPanel } from '@/components/WhyPanel';
import { WhatIfPanel } from '@/components/WhatIfPanel';
import { PricingPanel } from '@/components/PricingPanel';
import { loadPricingForItem, formatPrice, type PricingResult } from '@/lib/pricing';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { analyzeItem, type WhatIfOverrides, type ItemFactors, type DecisionFactor } from '@/lib/decisionEngine';
import { recordDecision, getLearnedInsights, loadPatterns } from '@/lib/preferences';

interface ReviewQueueProps {
  project: Project;
  onBack: () => void;
  onComplete: () => void;
  onScanMore: () => void;
}

const DECISION_OPTIONS: { value: UserDecision; label: string; color: string; bg: string }[] = [
  { value: 'keep',         label: 'Keep',         color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
  { value: 'sell',         label: 'Sell',         color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { value: 'donate',       label: 'Donate',       color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200 hover:bg-amber-100' },
  { value: 'recycle',      label: 'Recycle',      color: 'text-teal-700',    bg: 'bg-teal-50 border-teal-200 hover:bg-teal-100' },
  { value: 'trash',        label: 'Trash',        color: 'text-stone-600',   bg: 'bg-stone-100 border-stone-200 hover:bg-stone-200' },
  { value: 'decide_later', label: 'Decide later', color: 'text-purple-600',  bg: 'bg-purple-50 border-purple-200 hover:bg-purple-100' },
];

interface UndoEntry { itemId: string; previousDecision: UserDecision | null }

export function ReviewQueue({ project, onBack, onComplete, onScanMore }: ReviewQueueProps) {
  const [items, setItems]         = useState<Item[]>([]);
  const [loading, setLoading]     = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [saving, setSaving]       = useState(false);
  const [history, setHistory]     = useState<UndoEntry[]>([]);
  const [insights, setInsights]   = useState<string[]>([]);
  const [pricing, setPricing]     = useState<PricingResult | null>(null);
  const [showChangeModal, setShowChangeModal] = useState(false);

  // Override reason modal
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [pendingDecision, setPendingDecision]  = useState<UserDecision | null>(null);
  const [overrideReason, setOverrideReason]    = useState('');
  // Swipe drag
  const dragStart = useRef<number | null>(null);
  const [dragX, setDragX]   = useState(0);
  const [exiting, setExiting] = useState<'left' | 'right' | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    await loadPatterns(project.id);
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: true });
    if (data) {
      const sorted = [
        ...data.filter((i) => i.user_decision === null),
        ...data.filter((i) => i.user_decision !== null),
      ];
      setItems(sorted);
      const firstPending = sorted.findIndex((i) => i.user_decision === null);
      setCurrentIdx(firstPending >= 0 ? firstPending : 0);
    }
    const learned = getLearnedInsights(project.id);
    setInsights(learned.map((l) => l.text));
    setLoading(false);
  }, [project.id]);

  // Load pricing when current item changes
  useEffect(() => {
    if (currentItem) {
      loadPricingForItem(currentItem.id).then(setPricing);
    } else {
      setPricing(null);
    }
  }, [currentItem?.id]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const currentItem = items[currentIdx] ?? null;
  const pendingItems = items.filter((i) => i.user_decision === null);
  const reviewedItems = items.filter((i) => i.user_decision !== null);

  function promptDecision(decision: UserDecision) {
    if (!currentItem || saving) return;
    const isOverride = decision !== currentItem.recommendation;
    if (isOverride && currentItem.confidence_level === 'high') {
      setPendingDecision(decision);
      setOverrideReason('');
      setShowReasonModal(true);
    } else {
      commitDecision(decision, '');
    }
  }

  async function commitDecision(decision: UserDecision, reason: string) {
    if (!currentItem) return;
    setSaving(true);
    setShowReasonModal(false);

    setHistory((h) => [...h.slice(-19), { itemId: currentItem.id, previousDecision: currentItem.user_decision }]);
    setItems((prev) => prev.map((i) =>
      i.id === currentItem.id ? { ...i, user_decision: decision, override_reason: reason || null } : i
    ));

    await supabase.from('items').update({
      user_decision: decision,
      override_reason: reason || null,
    }).eq('id', currentItem.id);

    await recordDecision({
      projectId: project.id,
      category: currentItem.category,
      aiRecommendation: currentItem.recommendation,
      userDecision: decision,
    });

    setSaving(false);

    // Advance to next pending
    const remaining = items.filter((i) => i.user_decision === null && i.id !== currentItem.id);
    if (remaining.length === 0) {
      setTimeout(() => onComplete(), 300);
    } else {
      const nextIdx = items.findIndex((i, idx) => idx > currentIdx && i.user_decision === null && i.id !== currentItem.id);
      setCurrentIdx(nextIdx >= 0 ? nextIdx : items.findIndex((i) => i.user_decision === null && i.id !== currentItem.id));
    }
  }

  async function undoLast() {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setItems((prev) => prev.map((i) => i.id === last.itemId ? { ...i, user_decision: last.previousDecision } : i));
    await supabase.from('items').update({ user_decision: last.previousDecision }).eq('id', last.itemId);
    const idx = items.findIndex((i) => i.id === last.itemId);
    if (idx >= 0) setCurrentIdx(idx);
  }

  // Swipe handlers
  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragStart.current === null) return;
    setDragX(e.clientX - dragStart.current);
  }
  function onPointerUp() {
    if (dragStart.current === null) return;
    const dx = dragX;
    dragStart.current = null;
    setDragX(0);
    if (dx > 90) {
      setExiting('right');
      setTimeout(() => { setExiting(null); promptDecision('keep'); }, 250);
    } else if (dx < -90) {
      setExiting('left');
      setTimeout(() => { setExiting(null); promptDecision('donate'); }, 250);
    }
  }

  // Estimate ~25 seconds per remaining item
  const estMinutes = Math.max(1, Math.ceil(pendingItems.length * 25 / 60));

  // Motivational message based on progress
  const pct = items.length > 0 ? Math.round((reviewedItems.length / items.length) * 100) : 0;
  const motivation = getMotivation(pct, pendingItems.length, reviewedItems.length, items.length);

  if (loading) return <><NavBar title="Review" onBack={onBack} /><LoadingSpinner /></>;

  if (items.length === 0) {
    return (
      <>
        <NavBar title="Review" onBack={onBack} />
        <div className="max-w-lg mx-auto px-5 py-16 text-center">
          <div className="text-5xl mb-4">📷</div>
          <p className="text-stone-500 text-sm mb-6">Scan some items first, then come back to review them.</p>
          <button onClick={onScanMore} className="bg-stone-900 text-white rounded-2xl px-6 py-3 text-sm font-semibold hover:bg-stone-800 transition-colors">
            Scan first item
          </button>
        </div>
      </>
    );
  }

  const factors: DecisionFactor[] = currentItem?.decision_factors ?? [];
  const confidence = (currentItem?.confidence_level ?? 'medium') as 'high' | 'medium' | 'low';
  const baseItemFactors = currentItem?.item_factors as ItemFactors | null;

  return (
    <>
      <NavBar
        title="Review"
        onBack={onBack}
        right={
          history.length > 0 ? (
            <button onClick={undoLast} className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 transition-colors">
              <RotateCcw size={13} />
              Undo
            </button>
          ) : undefined
        }
      />

      <div className="max-w-lg mx-auto px-4 pt-4 pb-12">

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm font-semibold text-stone-700">
              {reviewedItems.length} of {items.length} reviewed
            </span>
            <span className="text-xs text-stone-400 flex items-center gap-1">
              <Clock size={11} />
              About {estMinutes} min left
            </span>
          </div>
          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-stone-900 rounded-full transition-all duration-500"
              style={{ width: `${items.length > 0 ? (reviewedItems.length / items.length) * 100 : 0}%` }}
            />
          </div>
          {motivation && (
            <p className="text-xs text-stone-500 mt-2 leading-relaxed animate-fade-in">{motivation}</p>
          )}
          {pendingItems.length > 0 && reviewedItems.length === 0 && (
            <div className="flex items-center justify-between mt-1.5 text-xs text-stone-400">
              <span>← Swipe left to donate</span>
              <span>Swipe right to keep →</span>
            </div>
          )}
        </div>

        {/* Learned insights */}
        {insights.length > 0 && (
          <div className="mb-3 bg-stone-50 rounded-xl px-4 py-2.5 border border-stone-100">
            <p className="text-xs text-stone-500 italic">{insights[0]}</p>
          </div>
        )}

        {currentItem ? (
          <div className="space-y-3">
            {/* Swipeable card */}
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{
                transform: exiting === 'right'
                  ? 'translateX(110%) rotate(12deg)'
                  : exiting === 'left'
                  ? 'translateX(-110%) rotate(-12deg)'
                  : dragX !== 0 ? `translateX(${dragX}px) rotate(${dragX * 0.025}deg)` : undefined,
                opacity: exiting ? 0 : 1,
                transition: dragX === 0 ? 'transform 0.3s ease, opacity 0.3s' : undefined,
                touchAction: 'pan-y',
                cursor: 'grab',
                userSelect: 'none',
              }}
              className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden relative"
            >
              {/* Swipe hint overlays */}
              {dragX > 40 && (
                <div className="absolute top-4 left-4 z-10 bg-emerald-500 text-white text-xs font-bold rounded-lg px-2.5 py-1 shadow">KEEP</div>
              )}
              {dragX < -40 && (
                <div className="absolute top-4 right-4 z-10 bg-amber-500 text-white text-xs font-bold rounded-lg px-2.5 py-1 shadow">DONATE</div>
              )}

              {/* Photo */}
              {currentItem.photo_url && (
                <div className="w-full aspect-video">
                  <img src={currentItem.photo_url} alt={currentItem.name} className="w-full h-full object-cover pointer-events-none" />
                </div>
              )}

              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    {currentItem.category && <p className="text-xs text-stone-400 mb-0.5">{currentItem.category}</p>}
                    <h2 className="text-xl font-bold text-stone-900 leading-tight">{currentItem.name}</h2>
                  </div>
                  <ConfidenceLabel level={confidence} size="sm" />
                </div>

                {/* AI recommendation */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-xs text-stone-400 font-medium">We suggest:</span>
                  <RecommendationBadge recommendation={currentItem.recommendation} />
                  {currentItem.user_decision && currentItem.user_decision !== currentItem.recommendation && (
                    <>
                      <span className="text-xs text-stone-400">You chose:</span>
                      <RecommendationBadge recommendation={currentItem.user_decision} />
                    </>
                  )}
                </div>

                {/* Explanation */}
                <p className="text-sm text-stone-600 leading-relaxed mb-3">{currentItem.explanation}</p>

                {/* Value + effort row */}
                <div className="space-y-1.5 mb-1">
                  {pricing && pricing.median_sold_cents > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-400">Estimated value</span>
                      <span className="font-semibold text-stone-700">
                        {formatPrice(pricing.median_sold_cents)}
                        <span className="text-stone-400 font-normal ml-1">
                          ({formatPrice(pricing.min_sold_cents)}–{formatPrice(pricing.max_sold_cents)})
                        </span>
                      </span>
                    </div>
                  )}
                  {currentItem.resale_value_min_cents > 0 && !pricing && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-400">Estimated value</span>
                      <span className="font-semibold text-stone-700">
                        {formatDollars(currentItem.resale_value_min_cents)}–{formatDollars(currentItem.resale_value_max_cents)}
                      </span>
                    </div>
                  )}
                  {currentItem.recommendation === 'sell' && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-400">Effort to sell</span>
                      <span className={`font-medium capitalize ${
                        currentItem.effort_level === 'low' ? 'text-emerald-600' :
                        currentItem.effort_level === 'medium' ? 'text-amber-600' : 'text-red-500'
                      }`}>
                        {currentItem.effort_level}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing panel */}
            {currentItem && (
              <PricingPanel
                identification={{
                  object_name: currentItem.name,
                  brand: null,
                  model: null,
                  category: currentItem.category,
                  condition: currentItem.condition,
                }}
                itemId={currentItem.id}
                projectId={currentItem.project_id}
                initialPricing={pricing}
                onPriced={setPricing}
                defaultOpen={false}
              />
            )}

            {/* Why panel */}
            {factors.length > 0 && (
              <WhyPanel
                explanation={currentItem.explanation}
                factors={factors}
              />
            )}

            {/* What if panel */}
            {baseItemFactors && (
              <WhatIfPanel
                baseFactors={{ ...baseItemFactors, goal: project.goal, style: project.style }}
                originalRecommendation={currentItem.recommendation}
              />
            )}

            {/* Decision buttons */}
            <div className="space-y-2.5 pt-1">
              {/* Primary: Accept recommendation */}
              <button
                onClick={() => promptDecision(currentItem.recommendation)}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white rounded-2xl py-3.5 text-sm font-semibold hover:bg-stone-800 active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                <Check size={16} />
                Accept — {currentItem.recommendation === 'keep' ? 'Keep it' :
                  currentItem.recommendation === 'sell' ? 'Sell it' :
                  currentItem.recommendation === 'donate' ? 'Donate it' :
                  currentItem.recommendation === 'recycle' ? 'Recycle it' :
                  currentItem.recommendation === 'trash' ? 'Toss it' : 'Decide later'}
              </button>

              {/* Secondary: Change + Decide later */}
              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowChangeModal(true)}
                  disabled={saving}
                  className="flex-1 border border-stone-200 text-stone-700 rounded-2xl py-3 text-sm font-semibold hover:bg-stone-50 active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  Change
                </button>
                <button
                  onClick={() => promptDecision('decide_later')}
                  disabled={saving}
                  className="flex-1 border border-stone-200 text-stone-500 rounded-2xl py-3 text-sm font-semibold hover:bg-stone-50 active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  Decide later
                </button>
              </div>
            </div>

            {/* Item navigation */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                disabled={currentIdx === 0}
                className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="text-xs text-stone-400">{currentIdx + 1} / {items.length}</span>
              <button
                onClick={() => setCurrentIdx(Math.min(items.length - 1, currentIdx + 1))}
                disabled={currentIdx === items.length - 1}
                className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 disabled:opacity-30 transition-colors"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ) : null}

        {/* Bottom actions */}
        <div className="mt-5 flex gap-3">
          <button onClick={onScanMore} className="flex-1 border border-stone-200 text-stone-700 rounded-2xl py-3 text-sm font-semibold hover:bg-stone-50 transition-colors">
            Scan more items
          </button>
          {pendingItems.length === 0 && items.length > 0 && (
            <button onClick={onComplete} className="flex-1 bg-stone-900 text-white rounded-2xl py-3 text-sm font-semibold hover:bg-stone-800 transition-colors">
              See action plan
            </button>
          )}
        </div>
      </div>

      {/* Change recommendation modal */}
      {showChangeModal && currentItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slide-up">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-stone-900">Change recommendation</h2>
                <p className="text-xs text-stone-500 mt-0.5">What would you like to do with this item?</p>
              </div>
              <button onClick={() => setShowChangeModal(false)} className="text-stone-400 hover:text-stone-700 p-1">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {DECISION_OPTIONS.filter((o) => o.value !== 'decide_later').map(({ value, label, color, bg }) => (
                <button
                  key={value}
                  onClick={() => { setShowChangeModal(false); promptDecision(value); }}
                  className={`w-full flex items-center gap-3 border-2 rounded-2xl px-4 py-3.5 text-left transition-all ${bg} ${color} ${
                    currentItem.user_decision === value ? 'ring-2 ring-offset-1 ring-stone-900' : ''
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current shrink-0" />
                  <span className="text-sm font-semibold">{label}</span>
                  {currentItem.recommendation === value && (
                    <span className="text-xs italic opacity-60 ml-auto">Our suggestion</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Override reason modal */}
      {showReasonModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slide-up">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-stone-900">Just checking</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  We suggested <strong>{currentItem?.recommendation}</strong> — you're choosing <strong>{pendingDecision}</strong>.
                </p>
              </div>
              <button onClick={() => setShowReasonModal(false)} className="text-stone-400 hover:text-stone-700 p-1">
                <X size={18} />
              </button>
            </div>
            <div className="mb-4">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide block mb-1.5">
                Reason (optional)
              </label>
              <textarea
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Sentimental value, planning to use it soon…"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 resize-none"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowReasonModal(false)} className="flex-1 border border-stone-200 text-stone-700 rounded-xl py-3 text-sm font-semibold hover:bg-stone-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => commitDecision(pendingDecision!, overrideReason)}
                className="flex-1 bg-stone-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-stone-800 transition-colors"
              >
                Confirm decision
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function getMotivation(pct: number, pending: number, reviewed: number, total: number): string | null {
  if (total === 0 || pending === 0) return null;
  if (reviewed === 0) return `Let's get started. You have ${pending} item${pending !== 1 ? 's' : ''} to go.`;
  if (pct >= 75) return `Almost there — only ${pending} more to go.`;
  if (pct >= 50) return `You're halfway done. ${pending} item${pending !== 1 ? 's' : ''} left.`;
  if (pct >= 25) return `Good progress. ${pending} item${pending !== 1 ? 's' : ''} remaining.`;
  return `You've already reclaimed ${pct}% of this room.`;
}
