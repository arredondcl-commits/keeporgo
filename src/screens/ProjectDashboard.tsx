import React, { useEffect, useState, useCallback } from 'react';
import { Camera, ChevronRight, Package, ClipboardList, Play } from 'lucide-react';
import { supabase, formatDollars, type Project, type Item, type UserDecision } from '@/lib/supabase';
import { NavBar } from '@/components/NavBar';
import { RecommendationBadge } from '@/components/RecommendationBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface ProjectDashboardProps {
  project: Project;
  onBack: () => void;
  onScanItems: () => void;
  onViewItem: (item: Item) => void;
  onReviewQueue: () => void;
  onActionPlan: () => void;
}

const FILTERS: { value: UserDecision | 'all' | 'pending'; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'pending',      label: 'Pending' },
  { value: 'keep',         label: 'Keep' },
  { value: 'sell',         label: 'Sell' },
  { value: 'donate',       label: 'Donate' },
  { value: 'recycle',      label: 'Recycle' },
  { value: 'trash',        label: 'Trash' },
  { value: 'decide_later', label: 'Later' },
];

export function ProjectDashboard({ project, onBack, onScanItems, onViewItem, onReviewQueue, onActionPlan }: ProjectDashboardProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<UserDecision | 'all' | 'pending'>('all');

  const loadItems = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  }, [project.id]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const decision = (i: Item) => i.user_decision ?? null;

  const pending  = items.filter((i) => decision(i) === null).length;
  const reviewed = items.filter((i) => decision(i) !== null).length;
  const pct      = items.length > 0 ? Math.round((reviewed / items.length) * 100) : 0;
  const sellVal  = items.filter((i) => (decision(i) ?? i.recommendation) === 'sell').reduce((s, i) => s + i.resale_value_cents, 0);

  const filtered = activeFilter === 'all'
    ? items
    : activeFilter === 'pending'
    ? items.filter((i) => decision(i) === null)
    : items.filter((i) => (decision(i) ?? i.recommendation) === activeFilter);

  return (
    <>
      <NavBar
        title={project.name}
        onBack={onBack}
        right={
          <button onClick={onScanItems} className="flex items-center gap-1 bg-stone-900 text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-stone-800 transition-colors">
            <Camera size={12} />
            Scan
          </button>
        }
      />
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-10">

        {/* Progress */}
        {items.length > 0 && (
          <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-stone-700">{reviewed} of {items.length} reviewed</p>
              <span className="text-base font-bold text-stone-900">{pct}%</span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-stone-900 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-stone-500">
                {pending > 0 ? `${pending} item${pending !== 1 ? 's' : ''} left to review` : 'Everything reviewed.'}
              </p>
              {pending > 0 && (
                <p className="text-xs text-stone-400">About {Math.max(1, Math.ceil(pending * 25 / 60))} min left</p>
              )}
            </div>
            <div className="flex gap-2">
              {pending > 0 && (
                <button
                  onClick={onReviewQueue}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-stone-900 text-white rounded-xl py-2.5 text-xs font-semibold hover:bg-stone-800 active:scale-[0.98] transition-all"
                >
                  <Play size={12} />
                  Review {pending} pending
                </button>
              )}
              {reviewed > 0 && (
                <button
                  onClick={onActionPlan}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-stone-200 text-stone-700 rounded-xl py-2.5 text-xs font-semibold hover:bg-stone-50 active:scale-[0.98] transition-all"
                >
                  <ClipboardList size={12} />
                  Action plan
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quick stats */}
        {items.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white rounded-2xl p-3 border border-stone-100 shadow-sm text-center">
              <p className="text-xl font-bold text-stone-900">{items.length}</p>
              <p className="text-xs text-stone-400 mt-0.5">Total</p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-stone-100 shadow-sm text-center">
              <p className="text-xl font-bold text-blue-600">{items.filter(i => (decision(i) ?? i.recommendation) === 'sell').length}</p>
              <p className="text-xs text-stone-400 mt-0.5">To sell</p>
            </div>
            <div className="bg-stone-900 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-white">{sellVal > 0 ? formatDollars(sellVal) : '—'}</p>
              <p className="text-xs text-stone-400 mt-0.5">Est. value</p>
            </div>
          </div>
        )}

        {/* Items list */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-bold text-stone-900">Items</h2>
          </div>

          {/* Filter tabs */}
          {items.length > 0 && (
            <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 mb-3 scrollbar-none">
              {FILTERS.filter((f) => {
                if (f.value === 'all' || f.value === 'pending') return true;
                return items.some((i) => (decision(i) ?? i.recommendation) === f.value);
              }).map((f) => (
                <button
                  key={f.value}
                  onClick={() => setActiveFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                    activeFilter === f.value ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <LoadingSpinner />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
                <Package size={24} className="text-stone-400" />
              </div>
              <p className="text-stone-500 text-sm mb-1">
                {items.length === 0 ? 'No items yet.' : 'Nothing in this category.'}
              </p>
              <p className="text-stone-400 text-xs mb-4">
                {items.length === 0 ? 'Take a photo to add the first item.' : 'Try a different filter.'}
              </p>
              {items.length === 0 && (
                <button onClick={onScanItems} className="bg-stone-900 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-stone-800 active:scale-[0.98] transition-all">
                  Scan first item
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => {
                const d = decision(item) ?? item.recommendation;
                return (
                  <button
                    key={item.id}
                    onClick={() => onViewItem(item)}
                    className="w-full bg-white rounded-2xl p-3.5 shadow-sm border border-stone-100 flex items-center gap-3 hover:border-stone-300 hover:shadow-md transition-all text-left group"
                  >
                    {item.photo_url ? (
                      <img src={item.photo_url} alt={item.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                        <Package size={18} className="text-stone-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-stone-900 truncate text-sm">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <RecommendationBadge recommendation={d} size="sm" />
                        {item.user_decision === null && (
                          <span className="text-xs text-stone-400 italic">needs review</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={15} className="text-stone-300 group-hover:text-stone-500 transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
