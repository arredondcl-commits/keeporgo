import React, { useState, useEffect } from 'react';
import { Copy, ExternalLink, Check, Facebook, ShoppingBag } from 'lucide-react';
import { supabase, formatDollars, type Item, type Listing } from '@/lib/supabase';
import { NavBar } from '@/components/NavBar';

interface SellFlowProps {
  item: Item;
  onBack: () => void;
  onListingCreated: (listing: Listing) => void;
}

function generateListing(item: Item) {
  const askingCents = Math.round(item.resale_value_cents * 1.05);
  const minCents = Math.round(item.resale_value_cents * 0.75);
  const condition = item.condition.charAt(0).toUpperCase() + item.condition.slice(1);

  const titles: Record<string, string[]> = {
    'Sports & Fitness': [`${item.name} — ${condition} Condition`, `${item.name} for Sale — Used ${condition}`],
    'Electronics': [`${item.name} — Works Great, ${condition} Shape`, `${item.name} (${condition}) — Tested & Ready`],
    'Musical Instruments': [`${item.name} — ${condition} Condition, Sounds Great`, `${item.name} (${condition}) — Ready to Play`],
    'Home & Furniture': [`${item.name} — ${condition} Condition`, `${item.name} for Sale, ${condition}`],
  };

  const titlePool = titles[item.category ?? ''] ?? [`${item.name} — ${condition} Condition, Ready to Go`];
  const title = titlePool[0];

  const descriptions: Record<string, string> = {
    keep: '',
    sell: `Up for sale: ${item.name} in ${item.condition} condition.\n\nThis item works great and has been well cared for. Perfect for anyone looking to save on a quality piece. Replacement retail is ${formatDollars(item.replacement_cost_cents)} — you're getting a deal.\n\nNo low-ball offers please. Cash or Venmo. Local pickup preferred.`,
    donate: '',
    recycle: '',
    trash: '',
  };

  return {
    title,
    description: descriptions.sell.replace('descriptions.sell', ''),
    askingCents,
    minCents,
  };
}

export function SellFlow({ item, onBack, onListingCreated }: SellFlowProps) {
  const generated = generateListing(item);

  const [title, setTitle] = useState(generated.title);
  const [description, setDescription] = useState(
    `Up for sale: ${item.name} in ${item.condition} condition.\n\nThis item works great and has been well cared for. Replacement retail is ${formatDollars(item.replacement_cost_cents)} — you\'re getting a deal.\n\nNo low-ball offers please. Cash or Venmo. Local pickup preferred.`
  );
  const [askingPrice, setAskingPrice] = useState(Math.round(generated.askingCents / 100));
  const [minPrice, setMinPrice] = useState(Math.round(generated.minCents / 100));
  const [facebook, setFacebook] = useState(true);
  const [ebay, setEbay] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function saveListing() {
    setSaving(true);
    const { data, error } = await supabase
      .from('listings')
      .insert({
        item_id: item.id,
        title,
        description,
        asking_price_cents: askingPrice * 100,
        min_price_cents: minPrice * 100,
        platform_facebook: facebook,
        platform_ebay: ebay,
      })
      .select()
      .maybeSingle();
    setSaving(false);
    if (!error && data) onListingCreated(data);
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }

  return (
    <>
      <NavBar title="Create Listing" onBack={onBack} />

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 mb-1">Sell: {item.name}</h1>
          <p className="text-sm text-stone-500">Your listing is ready. Edit anything before publishing.</p>
        </div>

        {item.photo_url && (
          <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-sm">
            <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Title field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Listing Title</label>
            <button onClick={() => copyToClipboard(title, 'title')} className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors">
              {copiedField === 'title' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              {copiedField === 'title' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
          />
        </div>

        {/* Description field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Description</label>
            <button onClick={() => copyToClipboard(description, 'desc')} className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors">
              {copiedField === 'desc' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              {copiedField === 'desc' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent resize-none"
          />
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Pricing</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-stone-100 border-t border-stone-100">
            <div className="p-4">
              <p className="text-xs text-stone-400 mb-1.5">Asking Price</p>
              <div className="flex items-center gap-1">
                <span className="text-sm text-stone-500">$</span>
                <input
                  type="number"
                  value={askingPrice}
                  onChange={(e) => setAskingPrice(Number(e.target.value))}
                  className="w-full text-xl font-bold text-stone-900 focus:outline-none bg-transparent"
                />
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs text-stone-400 mb-1.5">Minimum</p>
              <div className="flex items-center gap-1">
                <span className="text-sm text-stone-500">$</span>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(Number(e.target.value))}
                  className="w-full text-xl font-bold text-stone-900 focus:outline-none bg-transparent"
                />
              </div>
            </div>
          </div>
          <div className="px-5 py-3 bg-stone-50 border-t border-stone-100">
            <p className="text-xs text-stone-400">
              Est. resale: <strong className="text-stone-700">{formatDollars(item.resale_value_cents)}</strong>
              {' · '}
              Retail: <strong className="text-stone-700">{formatDollars(item.replacement_cost_cents)}</strong>
            </p>
          </div>
        </div>

        {/* Platforms */}
        <div>
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Post to</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setFacebook(!facebook)}
              className={`flex items-center gap-3 rounded-2xl p-4 border-2 transition-all ${
                facebook ? 'border-blue-500 bg-blue-50' : 'border-stone-200 bg-white'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${facebook ? 'bg-blue-500' : 'bg-stone-100'}`}>
                <ShoppingBag size={16} className={facebook ? 'text-white' : 'text-stone-400'} />
              </div>
              <div className="text-left">
                <p className={`text-sm font-semibold ${facebook ? 'text-blue-700' : 'text-stone-600'}`}>Facebook</p>
                <p className={`text-xs ${facebook ? 'text-blue-500' : 'text-stone-400'}`}>Marketplace</p>
              </div>
            </button>

            <button
              onClick={() => setEbay(!ebay)}
              className={`flex items-center gap-3 rounded-2xl p-4 border-2 transition-all ${
                ebay ? 'border-amber-500 bg-amber-50' : 'border-stone-200 bg-white'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ebay ? 'bg-amber-500' : 'bg-stone-100'}`}>
                <ExternalLink size={16} className={ebay ? 'text-white' : 'text-stone-400'} />
              </div>
              <div className="text-left">
                <p className={`text-sm font-semibold ${ebay ? 'text-amber-700' : 'text-stone-600'}`}>eBay</p>
                <p className={`text-xs ${ebay ? 'text-amber-500' : 'text-stone-400'}`}>Auction or fixed</p>
              </div>
            </button>
          </div>
          <p className="text-xs text-stone-400 mt-2 text-center">Platform export is a placeholder — copy your listing details above.</p>
        </div>

        <button
          onClick={saveListing}
          disabled={saving || (!facebook && !ebay)}
          className="w-full bg-stone-900 text-white rounded-2xl py-4 text-base font-semibold hover:bg-stone-800 disabled:opacity-60 transition-colors shadow-sm"
        >
          {saving ? 'Saving listing...' : 'Save listing'}
        </button>
      </div>
    </>
  );
}
