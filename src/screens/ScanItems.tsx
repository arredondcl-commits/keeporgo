import React, { useState, useCallback } from 'react';
import { Camera, FileText, Tag, RotateCcw, ImagePlus, ChevronDown, CheckCircle2, X, AlertCircle, Sparkles, Plus } from 'lucide-react';
import { supabase, type Project, type Item, formatDollars } from '@/lib/supabase';
import { NavBar } from '@/components/NavBar';
import { RecommendationBadge } from '@/components/RecommendationBadge';
import { ConfidenceLabel } from '@/components/ConfidenceLabel';
import { WhyPanel } from '@/components/WhyPanel';
import { WhatIfPanel } from '@/components/WhatIfPanel';
import { PricingPanel } from '@/components/PricingPanel';
import { ChangeRecommendation } from '@/components/ChangeRecommendation';
import type { PricingResult } from '@/lib/pricing';
import { analyzeImage, compressImage, type IdentificationResult, AnalysisError, formatMissingInfo, MISSING_INFO_LABELS } from '@/lib/imageAnalysis';
import { analyzeItem, answersToFactors, type ItemFactors, type WhatIfOverrides } from '@/lib/decisionEngine';
import { selectQuestions, type SmartQuestion } from '@/lib/sampleData';
import { recordDecision } from '@/lib/preferences';

interface ScanItemsProps {
  project: Project;
  onBack: () => void;
  onItemSaved: (item: Item) => void;
  onGoToQueue: () => void;
}

type ScanStep = 'capture' | 'analyzing' | 'low_confidence' | 'questions' | 'result' | 'saved' | 'error';
type CaptureMode = 'single' | 'group' | 'angle' | 'label';

const CAPTURE_MODES: { mode: CaptureMode; icon: React.ReactNode; label: string; desc: string }[] = [
  { mode: 'single', icon: <Camera size={18} />,    label: 'One item',        desc: 'Best for a clear single object' },
  { mode: 'group',  icon: <ImagePlus size={18} />, label: 'Group of items',  desc: 'Identify multiple items at once' },
  { mode: 'angle',  icon: <RotateCcw size={18} />, label: 'Another angle',   desc: 'Add more photos to existing item' },
  { mode: 'label',  icon: <Tag size={18} />,       label: 'Label / model',   desc: 'Improve accuracy with brand / model' },
];

const ANALYZING_STEPS = [
  'Looking at the photo…',
  'Figuring out what this is…',
  'Checking the brand and condition…',
  'Estimating its value…',
  'Preparing a suggestion…',
];

export function ScanItems({ project, onBack, onItemSaved, onGoToQueue }: ScanItemsProps) {
  const [step, setStep]               = useState<ScanStep>('capture');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('single');
  const [showModes, setShowModes]     = useState(false);
  const [note, setNote]               = useState('');
  const [showNote, setShowNote]       = useState(false);
  const [analyzingStep, setAnalyzingStep] = useState(0);
  const [errorMsg, setErrorMsg]       = useState('');
  const [errorHint, setErrorHint]     = useState('');

  // Collected images (primary + additional angles/labels)
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl]       = useState<string | null>(null);

  // AI identification result
  const [identification, setIdentification] = useState<IdentificationResult | null>(null);

  // Decision engine
  const [questions, setQuestions]           = useState<SmartQuestion[]>([]);
  const [answers, setAnswers]               = useState<Record<string, string>>({});
  const [engineResult, setEngineResult]     = useState<ReturnType<typeof analyzeItem> | null>(null);
  const [whatIfOverrides, setWhatIfOverrides] = useState<WhatIfOverrides>({});
  const [pricingResult, setPricingResult]     = useState<PricingResult | null>(null);
  const [saving, setSaving]                   = useState(false);

  // ── Build full ItemFactors from identification + answers ────────────────────
  function buildFactors(id: IdentificationResult, extraAnswers: Record<string, string>): ItemFactors {
    const base: Partial<ItemFactors> = {
      name: id.object_name,
      category: id.category ?? 'Other',
      condition: (id.condition as ItemFactors['condition']) ?? 'good',
      resaleValueCents: 0,        // Not estimated yet — identification only
      resaleMinCents: 0,
      resaleMaxCents: 0,
      replacementCostCents: id.replacement_cost_cents ?? 0,
      lastUsed: 'unknown',
      frequency: 'unknown',
      seasonal: false,
      sentimentalValue: 'none',
      hasDuplicate: false,
      difficultyToReplace: 'easy',
      effortToSell: 'medium',
      shippable: false,
      size: 'medium',
    };

    const answerPatch = answersToFactors(extraAnswers, base);
    return {
      lastUsed: 'unknown',
      frequency: 'unknown',
      seasonal: false,
      sentimentalValue: 'none',
      hasDuplicate: false,
      difficultyToReplace: 'easy',
      shippable: false,
      size: 'medium',
      effortToSell: 'medium',
      ...base,
      ...answerPatch,
      goal: project.goal,
      style: project.style,
    } as ItemFactors;
  }

  // ── Handle file selection ──────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset input
    await processNewPhoto(file);
  }, [project]);

  async function processNewPhoto(file: File) {
    setStep('analyzing');
    setAnalyzingStep(0);
    setErrorMsg('');

    try {
      const compressed = await compressImage(file);
      const newImages = [...imageDataUrls, compressed];
      setImageDataUrls(newImages);
      setPreviewUrl(compressed);

      // Animate analyzing steps
      let s = 0;
      const stepInterval = setInterval(() => {
        s = Math.min(s + 1, ANALYZING_STEPS.length - 1);
        setAnalyzingStep(s);
      }, 600);

      const result = await analyzeImage(newImages, { projectId: project.id });

      clearInterval(stepInterval);
      setAnalyzingStep(ANALYZING_STEPS.length - 1);

      setIdentification(result);

      // Check confidence — if low and needs more photos, go to low_confidence screen
      if (result.needs_more_photos || result.confidence_level === 'low') {
        setTimeout(() => setStep('low_confidence'), 400);
      } else {
        // Build factors and decide whether to ask questions
        const factors = buildFactors(result, {});
        const qs = selectQuestions(
          { ...factors, recommendation: undefined } as Partial<ItemFactors>,
          project.style,
          project.goal,
          result.confidence_score
        );

        setQuestions(qs);

        if (qs.length > 0) {
          setTimeout(() => setStep('questions'), 400);
        } else {
          const engine = analyzeItem(factors, {});
          setEngineResult(engine);
          setTimeout(() => setStep('result'), 400);
        }
      }
    } catch (err) {
      const isAnalysisErr = err instanceof AnalysisError;
      setErrorMsg(isAnalysisErr ? err.message : 'Failed to analyze image. Please try again.');
      setErrorHint(isAnalysisErr ? err.hint : undefined);
      setStep('error');
    }
  }

  // ── Re-analyze with additional photos ───────────────────────────────────────
  async function addMorePhoto(file: File) {
    await processNewPhoto(file);
  }

  // ── Skip the low-confidence warning and proceed ────────────────────────────
  function proceedWithLowConfidence() {
    if (!identification) return;
    const factors = buildFactors(identification, {});
    const qs = selectQuestions(
      { ...factors, recommendation: undefined } as Partial<ItemFactors>,
      project.style,
      project.goal,
      identification.confidence_score
    );
    setQuestions(qs);
    if (qs.length > 0) {
      setStep('questions');
    } else {
      const engine = analyzeItem(factors, {});
      setEngineResult(engine);
      setStep('result');
    }
  }

  // ── Finish questions and compute recommendation ────────────────────────────
  function finishQuestions() {
    if (!identification) return;
    const unanswered = questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) return;
    const factors = buildFactors(identification, answers);
    const result = analyzeItem(factors, {});
    setEngineResult(result);
    setStep('result');
  }

  // ─── Computed display values ────────────────────────────────────────────────
  const currentFactors = identification ? buildFactors(identification, answers) : null;
  const displayResult = currentFactors && engineResult
    ? (Object.keys(whatIfOverrides).length > 0 ? analyzeItem(currentFactors, whatIfOverrides) : engineResult)
    : engineResult;
  const allAnswered = questions.every((q) => answers[q.id]);

  // ── Save item to database ──────────────────────────────────────────────────
  async function saveItem() {
    if (!identification || !displayResult) return;
    setSaving(true);

    const rec = displayResult.recommendation;
    const confidence_level = displayResult.confidence;

    const { data, error } = await supabase.from('items').insert({
      project_id:             project.id,
      name:                   identification.object_name,
      photo_url:              imageDataUrls[0] ?? null,
      resale_value_cents:     0,
      resale_value_min_cents: 0,
      resale_value_max_cents: 0,
      replacement_cost_cents: identification.replacement_cost_cents ?? 0,
      confidence_score:       identification.confidence_score,
      confidence_level,
      recommendation:         rec,
      explanation:            displayResult.explanation,
      category:               identification.category,
      condition:              (identification.condition as Item['condition']) ?? 'good',
      effort_level:           'medium',
      listing_price_cents:    0,
      net_proceeds_cents:     0,
      notes:                  note.trim() || null,
      scan_type:              captureMode,
      decision_factors:       displayResult.factors,
      ai_scores:              displayResult.scores,
      item_factors:           currentFactors as Record<string, unknown>,
      what_if_context:        Object.keys(whatIfOverrides).length > 0 ? whatIfOverrides : null,
    }).select().maybeSingle();

    if (!error && data && Object.keys(answers).length > 0) {
      await supabase.from('item_answers').insert(
        Object.entries(answers).map(([qid, ans]) => ({
          item_id:  data.id,
          question: questions.find((q) => q.id === qid)?.text ?? qid,
          answer:   ans,
        }))
      );
    }

    if (!error && data) {
      await recordDecision({
        projectId:        project.id,
        category:         identification.category,
        aiRecommendation: engineResult!.recommendation,
        userDecision:     rec,
      });
    }

    setSaving(false);
    if (!error && data) {
      setStep('saved');
      setTimeout(() => onItemSaved(data), 900);
    }
  }

  function reset() {
    setStep('capture');
    setImageDataUrls([]);
    setPreviewUrl(null);
    setIdentification(null);
    setNote('');
    setShowNote(false);
    setAnswers({});
    setQuestions([]);
    setEngineResult(null);
    setWhatIfOverrides({});
    setPricingResult(null);
    setErrorMsg('');
    setErrorHint('');
  }

  return (
    <>
      <NavBar
        title="Scan Item"
        onBack={step === 'capture' ? onBack : reset}
        right={
          <button onClick={onGoToQueue} className="text-xs text-stone-500 font-medium hover:text-stone-900 transition-colors">
            Review queue
          </button>
        }
      />

      <div className="max-w-lg mx-auto px-4 py-5 pb-10">

        {/* ── CAPTURE ──────────────────────────────────────────────── */}
        {step === 'capture' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold text-stone-900 mb-1">Add an item</h1>
              <p className="text-sm text-stone-500">
                Take a photo and the AI will identify the object, brand, model, condition, and replacement cost.
              </p>
            </div>

            {/* Mode selector */}
            <div className="relative">
              <button
                onClick={() => setShowModes(!showModes)}
                className="w-full flex items-center justify-between bg-white rounded-xl border border-stone-200 px-4 py-3 text-sm shadow-sm"
              >
                <div className="flex items-center gap-2 text-stone-700">
                  {CAPTURE_MODES.find((m) => m.mode === captureMode)?.icon}
                  <span className="font-medium">{CAPTURE_MODES.find((m) => m.mode === captureMode)?.label}</span>
                </div>
                <ChevronDown size={15} className={`text-stone-400 transition-transform ${showModes ? 'rotate-180' : ''}`} />
              </button>
              {showModes && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-stone-200 shadow-lg overflow-hidden">
                  {CAPTURE_MODES.map((m) => (
                    <button
                      key={m.mode}
                      onClick={() => { setCaptureMode(m.mode); setShowModes(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0 ${captureMode === m.mode ? 'bg-stone-50' : ''}`}
                    >
                      <span className="text-stone-500">{m.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-stone-800">{m.label}</p>
                        <p className="text-xs text-stone-400">{m.desc}</p>
                      </div>
                      {captureMode === m.mode && <CheckCircle2 size={15} className="ml-auto text-stone-900 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Photo upload areas */}
            <label className="block w-full aspect-[4/3] bg-stone-100 rounded-3xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center cursor-pointer hover:bg-stone-50 hover:border-stone-400 transition-all overflow-hidden">
              <Camera size={36} className="text-stone-400 mb-2" />
              <p className="text-sm font-semibold text-stone-600">Take or upload a photo</p>
              <p className="text-xs text-stone-400 mt-1">The AI will identify what this is</p>
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleFileSelect} />
            </label>

            {/* Note */}
            {!showNote ? (
              <button onClick={() => setShowNote(true)} className="flex items-center gap-2 text-sm text-stone-400 hover:text-stone-600 transition-colors">
                <FileText size={14} />
                Add a note about this item
              </button>
            ) : (
              <div className="relative">
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Dad's old camera, missing the battery grip…"
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 resize-none pr-8"
                  autoFocus
                />
                <button onClick={() => { setShowNote(false); setNote(''); }} className="absolute top-2.5 right-2.5 text-stone-300 hover:text-stone-500">
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">What the AI identifies</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-stone-600">
                <span>📷 Object type</span>
                <span>🏷️ Brand & model</span>
                <span>✨ Condition</span>
                <span>📦 Accessories</span>
                <span>💰 Replacement cost</span>
                <span>📊 Confidence level</span>
              </div>
              <p className="text-xs text-stone-400 mt-2.5 italic">
                Resale prices are not estimated yet — that comes after identification.
              </p>
            </div>
          </div>
        )}

        {/* ── ANALYZING ────────────────────────────────────────────── */}
        {step === 'analyzing' && (
          <div className="flex flex-col items-center py-10 gap-6">
            {previewUrl && (
              <div className="w-44 h-44 rounded-3xl overflow-hidden shadow-lg">
                <img src={previewUrl} alt="Scanning" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-stone-900 text-white rounded-full px-5 py-2.5 mb-4 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-sm font-medium">Thinking…</span>
              </div>
            </div>
            <div className="w-full max-w-xs space-y-3">
              {ANALYZING_STEPS.map((label, i) => {
                const done = analyzingStep > i;
                const active = analyzingStep === i;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${done ? 'border-emerald-500 bg-emerald-500' : active ? 'border-stone-900 bg-stone-900' : 'border-stone-200'}`}>
                      {done && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      {active && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                    </div>
                    <span className={`text-sm transition-colors ${done ? 'text-stone-400 line-through' : active ? 'text-stone-900 font-medium' : 'text-stone-300'}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── LOW CONFIDENCE — ask for more photos ─────────────────── */}
        {step === 'low_confidence' && identification && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
                <AlertCircle size={24} className="text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-stone-900 mb-1">We're not quite sure</h2>
              <p className="text-sm text-stone-500 max-w-xs mx-auto">
                We couldn't identify some details with confidence. Another photo could help.
              </p>
            </div>

            {/* What the AI found */}
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-stone-900">{identification.object_name}</p>
                <ConfidenceLabel level={identification.confidence_level} size="sm" />
              </div>
              <div className="space-y-1.5 text-sm">
                {identification.brand && <p className="text-stone-600">Brand: <span className="font-medium">{identification.brand}</span></p>}
                {identification.model && <p className="text-stone-600">Model: <span className="font-medium">{identification.model}</span></p>}
                {identification.category && <p className="text-stone-600">Category: <span className="font-medium">{identification.category}</span></p>}
              </div>
            </div>

            {/* Missing info */}
            {identification.missing_info.length > 0 && (
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Another photo could help with</p>
                <div className="space-y-1.5">
                  {identification.missing_info.map((m) => (
                    <div key={m} className="flex items-center gap-2 text-sm text-amber-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {MISSING_INFO_LABELS[m] ?? m}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mt-2.5 italic">
                  Try a closer shot, different angle, or focus on the label/model number.
                </p>
              </div>
            )}

            {/* Photo thumbnails */}
            {imageDataUrls.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {imageDataUrls.map((url, i) => (
                  <div key={i} className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-stone-200">
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
                <label className="w-16 h-16 rounded-xl border-2 border-dashed border-stone-300 flex items-center justify-center cursor-pointer hover:border-stone-400 transition-colors shrink-0">
                  <Plus size={18} className="text-stone-400" />
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleFileSelect} />
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={reset} className="border border-stone-200 text-stone-600 rounded-xl px-4 py-3 text-sm font-medium hover:bg-stone-50 transition-colors shrink-0">
                Start over
              </button>
              <button onClick={proceedWithLowConfidence} className="flex-1 bg-stone-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-stone-800 transition-colors">
                Proceed anyway
              </button>
            </div>
          </div>
        )}

        {/* ── QUESTIONS ────────────────────────────────────────────── */}
        {step === 'questions' && identification && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">A few quick questions</p>
              <h2 className="text-xl font-bold text-stone-900">{identification.object_name}</h2>
              <p className="text-sm text-stone-500 mt-0.5">These help us give you a better suggestion.</p>
            </div>

            {previewUrl && (
              <div className="w-full h-36 rounded-2xl overflow-hidden">
                <img src={previewUrl} alt={identification.object_name} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Identification summary */}
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-3.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">What we found</p>
                <ConfidenceLabel level={identification.confidence_level} size="sm" />
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {identification.brand && <div><span className="text-stone-400">Brand:</span> <span className="font-medium text-stone-700">{identification.brand}</span></div>}
                {identification.model && <div><span className="text-stone-400">Model:</span> <span className="font-medium text-stone-700">{identification.model}</span></div>}
                {identification.category && <div><span className="text-stone-400">Category:</span> <span className="font-medium text-stone-700">{identification.category}</span></div>}
                {identification.condition && <div><span className="text-stone-400">Condition:</span> <span className="font-medium text-stone-700 capitalize">{identification.condition}</span></div>}
                {identification.replacement_cost_cents !== null && identification.replacement_cost_cents > 0 && (
                  <div><span className="text-stone-400">Replace:</span> <span className="font-medium text-stone-700">{formatDollars(identification.replacement_cost_cents)}</span></div>
                )}
                {identification.accessories.length > 0 && (
                  <div className="col-span-2"><span className="text-stone-400">Accessories:</span> <span className="font-medium text-stone-700">{identification.accessories.join(', ')}</span></div>
                )}
              </div>
            </div>

            {questions.map((q) => (
              <div key={q.id} className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-stone-50">
                  <p className="text-sm font-semibold text-stone-900">{q.text}</p>
                </div>
                <div className="p-2.5 space-y-1.5">
                  {q.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all ${
                        answers[q.id] === opt ? 'bg-stone-900 text-white font-medium' : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={finishQuestions}
              disabled={!allAnswered}
              className="w-full bg-stone-900 text-white rounded-2xl py-3.5 text-sm font-semibold hover:bg-stone-800 disabled:opacity-40 transition-all"
            >
              See recommendation
            </button>
          </div>
        )}

        {/* ── RESULT ───────────────────────────────────────────────── */}
        {step === 'result' && identification && displayResult && (
          <div className="space-y-3">
            {previewUrl && (
              <div className="w-full aspect-video rounded-3xl overflow-hidden shadow-md">
                <img src={previewUrl} alt={identification.object_name} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Identification card */}
            <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden animate-slide-up">
              <div className="p-5 border-b border-stone-50">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    {identification.category && <p className="text-xs text-stone-400 mb-0.5">{identification.category}</p>}
                    <h2 className="text-xl font-bold text-stone-900 leading-tight">{identification.object_name}</h2>
                    {(identification.brand || identification.model) && (
                      <p className="text-xs text-stone-500 mt-0.5">
                        {identification.brand}{identification.brand && identification.model ? ' · ' : ''}{identification.model}
                      </p>
                    )}
                  </div>
                  <ConfidenceLabel level={displayResult.confidence} size="sm" />
                </div>

                {/* Identification details */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  {identification.condition && (
                    <div className="bg-stone-50 rounded-lg px-2.5 py-1.5">
                      <span className="text-stone-400">Condition: </span>
                      <span className="font-medium text-stone-700 capitalize">{identification.condition}</span>
                    </div>
                  )}
                  {identification.replacement_cost_cents !== null && identification.replacement_cost_cents > 0 && (
                    <div className="bg-stone-50 rounded-lg px-2.5 py-1.5">
                      <span className="text-stone-400">Replace: </span>
                      <span className="font-medium text-stone-700">{formatDollars(identification.replacement_cost_cents)}</span>
                    </div>
                  )}
                  {identification.accessories.length > 0 && (
                    <div className="bg-stone-50 rounded-lg px-2.5 py-1.5 col-span-2">
                      <span className="text-stone-400">Accessories: </span>
                      <span className="font-medium text-stone-700">{identification.accessories.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Our suggestion */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-stone-400 font-medium">We suggest:</span>
                  <RecommendationBadge recommendation={displayResult.recommendation} />
                </div>
              </div>

              <div className="p-5 border-b border-stone-50">
                <p className="text-sm text-stone-700 leading-relaxed">{displayResult.explanation}</p>
              </div>

              {identification.replacement_cost_cents !== null && identification.replacement_cost_cents > 0 && (
                <div className="p-4">
                  <p className="text-xs text-stone-400 mb-0.5">Replacement cost (estimated)</p>
                  <p className="text-lg font-bold text-stone-900">{formatDollars(identification.replacement_cost_cents)}</p>
                  <p className="text-xs text-stone-400 mt-0.5">What it would cost to buy this new today</p>
                </div>
              )}
            </div>

            {/* Pricing panel */}
            <PricingPanel
              identification={{
                object_name: identification.object_name,
                brand: identification.brand,
                model: identification.model,
                category: identification.category,
                condition: identification.condition,
              }}
              identificationId={identification.identification_id}
              projectId={project.id}
              onPriced={setPricingResult}
            />

            {/* Why panel */}
            <WhyPanel
              explanation={displayResult.explanation}
              factors={displayResult.factors}
            />

            {/* What if panel */}
            {currentFactors && (
              <WhatIfPanel
                baseFactors={currentFactors}
                originalRecommendation={engineResult!.recommendation}
                onOverridesChange={setWhatIfOverrides}
              />
            )}

            {/* Change recommendation option */}
            {displayResult && (
              <ChangeRecommendation
                currentRecommendation={displayResult.recommendation}
                onChange={(newRec) => {
                  setWhatIfOverrides({ ...whatIfOverrides, _override_recommendation: newRec });
                }}
              />
            )}

            <p className="text-xs text-stone-400 text-center">
              {identification.confidence_level === 'high' ? "We're very confident" : identification.confidence_level === 'medium' ? "We're fairly confident" : "We're less sure"} about this
              {pricingResult ? ` · ${pricingResult.confidence_level === 'high' ? 'very confident' : pricingResult.confidence_level === 'medium' ? 'fairly confident' : 'less sure'} on pricing` : ''}
            </p>

            <div className="flex gap-3 pt-1">
              <button onClick={reset} className="border border-stone-200 text-stone-600 rounded-xl px-4 py-3 text-sm font-medium hover:bg-stone-50 transition-colors shrink-0">
                Scan another
              </button>
              <button
                onClick={saveItem}
                disabled={saving}
                className="flex-1 bg-stone-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-stone-800 disabled:opacity-60 transition-colors"
              >
                {saving ? 'Saving…' : 'Add to project'}
              </button>
            </div>
          </div>
        )}

        {/* ── SAVED ────────────────────────────────────────────────── */}
        {step === 'saved' && (
          <div className="flex flex-col items-center py-16 gap-3 animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <p className="text-lg font-bold text-stone-900">Item added</p>
            <p className="text-sm text-stone-400">Taking you to the review queue…</p>
          </div>
        )}

        {/* ── ERROR ────────────────────────────────────────────────── */}
        {step === 'error' && (
          <div className="flex flex-col items-center py-12 gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
              <AlertCircle size={24} className="text-red-500" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-stone-900 mb-1">Analysis failed</h2>
              <p className="text-sm text-stone-500 max-w-xs mx-auto">{errorMsg}</p>
              {errorHint && (
                <p className="text-xs text-stone-400 mt-2 max-w-xs mx-auto italic">{errorHint}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={reset} className="border border-stone-200 text-stone-600 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-stone-50 transition-colors">
                Start over
              </button>
              <button onClick={() => { setImageDataUrls([]); setStep('capture'); }} className="bg-stone-900 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-stone-800 transition-colors">
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
