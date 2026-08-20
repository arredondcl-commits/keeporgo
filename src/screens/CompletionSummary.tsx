import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, ArrowRight, TrendingUp, Award, Heart, Sparkles } from 'lucide-react';
import { supabase, formatDollars, type Project, type Item } from '@/lib/supabase';
import { NavBar } from '@/components/NavBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { buildAgreementSummary, getLearnedInsights, loadPatterns } from '@/lib/preferences';

interface CompletionSummaryProps {
  project: Project;
  onStartNewRoom: () => void;
  onReviewSellItems: () => void;
  onBack: () => void;
}

export function CompletionSummary({ project, onStartNewRoom, onReviewSellItems, onBack }: CompletionSummaryProps) {
  const [items, setItems]   = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }] = await Promise.all([
      supabase.from('items').select('*').eq('project_id', project.id),
      loadPatterns(project.id),
    ]);
    if (data) setItems(data);
    const learned = getLearnedInsights(project.id);
    setInsights(learned.map((l) => l.text));
    setLoading(false);
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  // Mark project complete
  useEffect(() => {
    if (items.length > 0) {
      supabase.from('projects').update({ status: 'completed' }).eq('id', project.id);
    }
  }, [items, project.id]);

  if (loading) return <><NavBar title="Complete" onBack={onBack} /><LoadingSpinner /></>;

  const d = (i: Item) => i.user_decision ?? i.recommendation;
  const kept     = items.filter((i) => d(i) === 'keep').length;
  const sell     = items.filter((i) => d(i) === 'sell');
  const donate   = items.filter((i) => d(i) === 'donate').length;
  const recycle  = items.filter((i) => d(i) === 'recycle').length;
  const trash    = items.filter((i) => d(i) === 'trash').length;
  const leaving  = sell.length + donate + recycle + trash;

  const estResale  = sell.reduce((s, i) => s + i.resale_value_cents, 0);
  const keptValue  = items.filter((i) => d(i) === 'keep').reduce((s, i) => s + i.replacement_cost_cents, 0);
  const estSqFt    = Math.round(leaving * 2.4);
  const pctCleared = items.length > 0 ? Math.round((leaving / items.length) * 100) : 0;

  const agreement  = buildAgreementSummary(items.map((i) => ({
    recommendation: i.recommendation,
    user_decision:  i.user_decision,
  })));

  // Generate "why these recommendations make sense" narrative
  const whyNarrative = buildWhyNarrative(items);

  return (
    <>
      <NavBar title={project.name} onBack={onBack} />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4 pb-12">

        {/* Hero with completion badge */}
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-4 animate-scale-in">
            <Award size={32} className="text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 mb-1">{project.name} is done.</h1>
          <p className="text-stone-500 text-sm max-w-xs mx-auto leading-relaxed">
            You made {items.length} decision{items.length !== 1 ? 's' : ''}. Every item has a clear path forward.
          </p>
        </div>

        {/* Primary stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Items reviewed"  value={String(items.length)} />
          <StatCard label="Space reclaimed" value={`~${pctCleared}%`}    sub={`~${estSqFt} sq ft`} accent />
          <StatCard label="Kept"            value={String(kept)}         sub="items staying" />
          <StatCard label="Leaving"         value={String(leaving)}      sub="donate · sell · recycle · trash" />
        </div>

        {/* Decision breakdown */}
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-50">
            <p className="text-sm font-bold text-stone-900">What's leaving this room</p>
          </div>
          {[
            { label: 'To sell',    count: sell.length, color: 'text-blue-600' },
            { label: 'To donate',  count: donate,      color: 'text-amber-600' },
            { label: 'To recycle', count: recycle,     color: 'text-teal-600' },
            { label: 'To trash',   count: trash,       color: 'text-stone-500' },
          ].filter((r) => r.count > 0).map((row) => (
            <div key={row.label} className="flex items-center justify-between px-5 py-3.5 border-b border-stone-50 last:border-0">
              <span className="text-sm text-stone-600">{row.label}</span>
              <span className={`text-sm font-bold ${row.color}`}>{row.count} item{row.count !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>

        {/* Donation impact */}
        {donate > 0 && (
          <div className="bg-amber-50 rounded-3xl p-5 border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <Heart size={16} className="text-amber-500" />
              <p className="text-sm font-bold text-amber-800">Your donation impact</p>
            </div>
            <p className="text-sm text-amber-700 leading-relaxed">
              {donate} item{donate !== 1 ? 's' : ''} going to a new home instead of a landfill. That's real reuse — someone else will get value from what you no longer need.
            </p>
          </div>
        )}

        {/* Why these recommendations make sense */}
        {whyNarrative.length > 0 && (
          <div className="bg-stone-50 rounded-3xl p-5 border border-stone-100">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-stone-400" />
              <p className="text-sm font-bold text-stone-700">Here's why these recommendations make sense</p>
            </div>
            <div className="space-y-2">
              {whyNarrative.map((line, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-stone-400 text-xs mt-0.5 shrink-0">→</span>
                  <p className="text-sm text-stone-600 leading-relaxed">{line}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI agreement */}
        {agreement.pctAgreement > 0 && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-5 py-4">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">You and the AI</p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-stone-900 rounded-full" style={{ width: `${agreement.pctAgreement}%` }} />
                </div>
              </div>
              <span className="text-sm font-bold text-stone-900 shrink-0">{agreement.pctAgreement}% agreed</span>
            </div>
            <p className="text-xs text-stone-400 mt-2">
              {agreement.agreed} recommendation{agreement.agreed !== 1 ? 's' : ''} accepted
              {agreement.overridden > 0 && ` · ${agreement.overridden} override${agreement.overridden !== 1 ? 's' : ''}`}
            </p>
          </div>
        )}

        {/* Preference insights */}
        {insights.length > 0 && (
          <div className="bg-stone-50 rounded-2xl border border-stone-100 px-5 py-4">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Patterns noticed</p>
            <div className="space-y-1.5">
              {insights.map((text, i) => (
                <p key={i} className="text-xs text-stone-500 italic">{text}</p>
              ))}
            </div>
          </div>
        )}

        {/* Money section */}
        {(estResale > 0 || keptValue > 0) && (
          <div className="bg-stone-900 text-white rounded-3xl p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wide mb-3">The numbers</p>
            {estResale > 0 && (
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm text-stone-300">Estimated resale proceeds</span>
                <span className="text-base font-bold">{formatDollars(estResale)}</span>
              </div>
            )}
            {keptValue > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-300">Replacement value preserved</span>
                <span className="text-base font-bold">{formatDollars(keptValue)}</span>
              </div>
            )}
          </div>
        )}

        {/* Closing message */}
        <div className="text-center px-4 py-6">
          <div className="inline-flex items-center gap-1.5 text-stone-400 mb-3">
            <Sparkles size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide">Room complete</span>
          </div>
          <p className="text-xl font-bold text-stone-900 mb-1">Ready for the next room?</p>
          <p className="text-sm text-stone-500 max-w-xs mx-auto">
            You've seen how this works. Pick another space and keep the momentum going.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          {sell.length > 0 && (
            <button
              onClick={onReviewSellItems}
              className="w-full flex items-center justify-between bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl px-5 py-4 text-sm font-semibold hover:bg-blue-100 transition-colors"
            >
              Review {sell.length} items to sell
              <ArrowRight size={16} />
            </button>
          )}
          {donate > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4">
              <p className="text-sm font-semibold text-amber-700">Schedule donation pickup</p>
              <p className="text-xs text-amber-600 mt-0.5">Goodwill · Habitat ReStore · local shelters</p>
            </div>
          )}
          <button
            onClick={onStartNewRoom}
            className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white rounded-2xl py-4 text-sm font-semibold hover:bg-stone-800 active:scale-[0.98] transition-all"
          >
            Start another room <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${accent ? 'bg-stone-900 text-white' : 'bg-white border border-stone-100 shadow-sm'}`}>
      <p className="text-xs font-medium mb-1 text-stone-400">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-white' : 'text-stone-900'}`}>{value}</p>
      {sub && <p className="text-xs mt-0.5 text-stone-400">{sub}</p>}
    </div>
  );
}

function buildWhyNarrative(items: Item[]): string[] {
  const lines: string[] = [];
  const total   = items.length;
  if (total === 0) return lines;

  const d = (i: Item) => i.user_decision ?? i.recommendation;
  const sell    = items.filter((i) => d(i) === 'sell');
  const donate  = items.filter((i) => d(i) === 'donate');
  const kept    = items.filter((i) => d(i) === 'keep');
  const recycle = items.filter((i) => d(i) === 'recycle');

  if (sell.length > 0) {
    const avgResale = sell.reduce((s, i) => s + i.resale_value_cents, 0) / sell.length / 100;
    const highEffort = sell.filter((i) => i.effort_level === 'low' || i.effort_level === 'medium').length;
    lines.push(
      `${sell.length} item${sell.length !== 1 ? 's' : ''} flagged for sale have an average resale value of ~${formatDollars(Math.round(avgResale) * 100)} — ${highEffort} of them are easy to ship or list locally.`
    );
  }

  if (donate.length > 0) {
    const lowValue = donate.filter((i) => i.resale_value_cents < 5000).length;
    if (lowValue > 0) {
      lines.push(
        `${lowValue} donated item${lowValue !== 1 ? 's' : ''} had low resale value but were still in usable condition — donating gets them out immediately without the effort of listing.`
      );
    }
  }

  if (kept.length > 0) {
    const highReplacement = kept.filter((i) => i.replacement_cost_cents >= 15000).length;
    if (highReplacement > 0) {
      lines.push(
        `${highReplacement} kept item${highReplacement !== 1 ? 's' : ''} have high replacement cost — keeping them avoids significant future spending.`
      );
    }
  }

  if (recycle.length > 0) {
    lines.push(`${recycle.length} item${recycle.length !== 1 ? 's' : ''} recycled responsibly — no resale potential but not landfill either.`);
  }

  const overrides = items.filter((i) => i.user_decision !== null && i.user_decision !== i.recommendation).length;
  if (overrides > 0) {
    lines.push(`You adjusted ${overrides} AI recommendation${overrides !== 1 ? 's' : ''} — those overrides have been noted and will influence future suggestions.`);
  }

  return lines.slice(0, 4);
}
