import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IdentificationResult {
  identification_id?: string;
  object_name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  condition: string | null;
  accessories: string[];
  replacement_cost_cents: number | null;
  confidence_level: 'high' | 'medium' | 'low';
  confidence_score: number;
  needs_more_photos: boolean;
  missing_info: string[];
}

export interface AnalyzeOptions {
  projectId?: string;
  itemId?: string;
}

export class AnalysisError extends Error {
  constructor(message: string, public readonly hint?: string) {
    super(message);
    this.name = 'AnalysisError';
  }
}

// ─── Image helpers ────────────────────────────────────────────────────────────

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

// Downscale large images to keep payload reasonable (max ~1024px on longest side)
export async function compressImage(file: File, maxSize = 1024): Promise<string> {
  const dataUrl = await fileToDataUrl(file);

  // If it's already small, return as-is
  if (file.size < 500_000) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ─── API call ────────────────────────────────────────────────────────────────

export async function analyzeImage(
  images: string[],
  options: AnalyzeOptions = {}
): Promise<IdentificationResult> {
  if (images.length === 0) {
    throw new AnalysisError('At least one image is required');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const apiUrl = `${supabaseUrl}/functions/v1/analyze-item`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
    },
    body: JSON.stringify({
      images,
      project_id: options.projectId,
      item_id: options.itemId,
    }),
  });

  if (!response.ok) {
    let message = `Analysis failed (${response.status})`;
    let hint: string | undefined;
    try {
      const errorBody = await response.json();
      message = errorBody.error || message;
      if (response.status === 503) {
        hint = 'The OpenAI API key needs to be configured as an edge function secret.';
      } else if (response.status === 502) {
        hint = 'The AI service may be temporarily unavailable.';
      }
    } catch {
      // Use default message
    }
    throw new AnalysisError(message, hint);
  }

  const data = await response.json();

  // Validate response shape
  if (!data || typeof data.object_name !== 'string') {
    throw new AnalysisError('Invalid response from analysis service');
  }

  return data as IdentificationResult;
}

// ─── Missing info display helpers ────────────────────────────────────────────

export const MISSING_INFO_LABELS: Record<string, string> = {
  brand: 'Brand name',
  model: 'Model number',
  size: 'Dimensions or size',
  condition: 'Condition details',
  accessories: 'Included accessories',
  label: 'Label or tag',
  serial_number: 'Serial number',
};

export function formatMissingInfo(missing: string[]): string {
  if (missing.length === 0) return '';
  return missing
    .map((m) => MISSING_INFO_LABELS[m] ?? m)
    .join(', ');
}
