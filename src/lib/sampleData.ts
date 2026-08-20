import type { ItemFactors, LastUsed, UseFrequency, SentimentLevel, ItemSize } from './decisionEngine';

// ─── Question bank ────────────────────────────────────────────────────────────

export interface SmartQuestion {
  id: string;
  text: string;
  options: string[];
  factorKey: string; // maps to ItemFactors
}

export const QUESTION_BANK: SmartQuestion[] = [
  {
    id: 'last_used',
    text: 'When did you last use this?',
    options: ['Within the past week', 'Within the past month', 'Within the past year', 'Two or more years ago', "Can't remember / never"],
    factorKey: 'lastUsed',
  },
  {
    id: 'frequency',
    text: 'How often do you actually use it?',
    options: ['Daily or almost daily', 'A few times a week', 'Monthly', 'Once or twice a year', 'Rarely', 'Never'],
    factorKey: 'frequency',
  },
  {
    id: 'sentimental',
    text: 'Does this have sentimental value to you?',
    options: ['Yes, very much so', 'A little', 'Not really', 'No'],
    factorKey: 'sentimentalValue',
  },
  {
    id: 'duplicate',
    text: 'Do you already own another one like this?',
    options: ['Yes', 'No'],
    factorKey: 'hasDuplicate',
  },
  {
    id: 'replace',
    text: 'If you got rid of it, how easy would it be to replace?',
    options: ['Very easy — available everywhere', 'Fairly easy', 'Somewhat difficult', 'Very difficult or impossible'],
    factorKey: 'difficultyToReplace',
  },
  {
    id: 'use_next_year',
    text: 'Will you realistically use this in the next 12 months?',
    options: ['Yes, definitely', 'Probably', 'Probably not', 'No'],
    factorKey: 'frequency',
  },
  {
    id: 'moving',
    text: 'If you were moving next month, would you bring this?',
    options: ["Yes, absolutely", "Probably", "Probably not", "No, I wouldn't bring it"],
    factorKey: 'lastUsed',
  },
];

// ─── Which questions to ask for a given item ─────────────────────────────────

export function selectQuestions(
  baseFactors: Partial<ItemFactors>,
  style: string,
  goal: string,
  confidenceScore: number
): SmartQuestion[] {
  const q: SmartQuestion[] = [];

  // Last used is almost always useful
  if (baseFactors.lastUsed === 'unknown' || confidenceScore < 80) {
    q.push(QUESTION_BANK[0]); // last_used
  }

  // Sentimental for cautious style or borderline items
  if (style === 'cautious' || confidenceScore < 75) {
    q.push(QUESTION_BANK[2]); // sentimental
  }

  // Duplicate for keep recommendations
  if (baseFactors.recommendation === 'keep') {
    q.push(QUESTION_BANK[3]); // duplicate
  }

  // Goal-specific questions
  if (goal === 'move') {
    q.push(QUESTION_BANK[6]); // moving
  } else if (goal === 'sell') {
    q.push(QUESTION_BANK[5]); // use_next_year
  }

  // Frequency if not already captured
  if (!q.find((x) => x.id === 'frequency') && confidenceScore < 70) {
    q.push(QUESTION_BANK[1]); // frequency
  }

  // Deduplicate and limit
  const seen = new Set<string>();
  return q.filter((x) => { if (seen.has(x.id)) return false; seen.add(x.id); return true; }).slice(0, 3);
}

// ─── Sample items (base factors for demo scanning) ────────────────────────────

export interface SampleItem {
  name: string;
  category: string;
  photo_url: string;
  baseFactors: Partial<ItemFactors>; // incomplete — questions fill the rest
  confidenceScore: number;           // AI visual confidence 0-100
}

export const SAMPLE_ITEMS: SampleItem[] = [
  {
    name: 'Trek Mountain Bike',
    category: 'Sports & Fitness',
    photo_url: 'https://images.pexels.com/photos/100582/pexels-photo-100582.jpeg?auto=compress&cs=tinysrgb&w=600',
    baseFactors: {
      condition: 'good',
      size: 'large',
      effortToSell: 'medium',
      shippable: false,
      resaleValueCents: 28500,
      resaleMinCents: 24000,
      resaleMaxCents: 33500,
      replacementCostCents: 65000,
      lastUsed: 'unknown',
      frequency: 'unknown',
      seasonal: false,
      sentimentalValue: 'none',
      hasDuplicate: false,
      difficultyToReplace: 'easy',
    },
    confidenceScore: 91,
  },
  {
    name: 'Craftsman Toolbox (Full Set)',
    category: 'Tools',
    photo_url: 'https://images.pexels.com/photos/162553/keys-workshop-mechanic-tools-162553.jpeg?auto=compress&cs=tinysrgb&w=600',
    baseFactors: {
      condition: 'excellent',
      size: 'medium',
      effortToSell: 'medium',
      shippable: false,
      resaleValueCents: 18000,
      resaleMinCents: 15000,
      resaleMaxCents: 21000,
      replacementCostCents: 42000,
      lastUsed: 'unknown',
      frequency: 'unknown',
      seasonal: false,
      sentimentalValue: 'none',
      hasDuplicate: false,
      difficultyToReplace: 'easy',
    },
    confidenceScore: 88,
  },
  {
    name: 'NordicTrack Treadmill',
    category: 'Sports & Fitness',
    photo_url: 'https://images.pexels.com/photos/4761352/pexels-photo-4761352.jpeg?auto=compress&cs=tinysrgb&w=600',
    baseFactors: {
      condition: 'good',
      size: 'bulky',
      effortToSell: 'high',
      shippable: false,
      resaleValueCents: 32000,
      resaleMinCents: 26000,
      resaleMaxCents: 38000,
      replacementCostCents: 110000,
      lastUsed: 'unknown',
      frequency: 'unknown',
      seasonal: false,
      sentimentalValue: 'none',
      hasDuplicate: false,
      difficultyToReplace: 'very_easy',
    },
    confidenceScore: 87,
  },
  {
    name: 'Acoustic Guitar',
    category: 'Musical Instruments',
    photo_url: 'https://images.pexels.com/photos/534283/pexels-photo-534283.jpeg?auto=compress&cs=tinysrgb&w=600',
    baseFactors: {
      condition: 'good',
      size: 'medium',
      effortToSell: 'low',
      shippable: true,
      resaleValueCents: 22000,
      resaleMinCents: 18000,
      resaleMaxCents: 26000,
      replacementCostCents: 48000,
      lastUsed: 'unknown',
      frequency: 'unknown',
      seasonal: false,
      sentimentalValue: 'none',
      hasDuplicate: false,
      difficultyToReplace: 'easy',
    },
    confidenceScore: 89,
  },
  {
    name: 'Canon EOS DSLR Camera',
    category: 'Electronics',
    photo_url: 'https://images.pexels.com/photos/243757/pexels-photo-243757.jpeg?auto=compress&cs=tinysrgb&w=600',
    baseFactors: {
      condition: 'excellent',
      size: 'small',
      effortToSell: 'low',
      shippable: true,
      resaleValueCents: 38000,
      resaleMinCents: 32000,
      resaleMaxCents: 44000,
      replacementCostCents: 82000,
      lastUsed: 'unknown',
      frequency: 'unknown',
      seasonal: false,
      sentimentalValue: 'none',
      hasDuplicate: false,
      difficultyToReplace: 'very_easy',
    },
    confidenceScore: 93,
  },
  {
    name: 'Ski Equipment (Pair)',
    category: 'Sports & Fitness',
    photo_url: 'https://images.pexels.com/photos/848599/pexels-photo-848599.jpeg?auto=compress&cs=tinysrgb&w=600',
    baseFactors: {
      condition: 'good',
      size: 'large',
      effortToSell: 'medium',
      shippable: false,
      resaleValueCents: 12000,
      resaleMinCents: 9500,
      resaleMaxCents: 14500,
      replacementCostCents: 38000,
      lastUsed: 'unknown',
      frequency: 'unknown',
      seasonal: true,
      sentimentalValue: 'none',
      hasDuplicate: false,
      difficultyToReplace: 'easy',
    },
    confidenceScore: 82,
  },
  {
    name: 'Box of Hardcover Books',
    category: 'Books & Media',
    photo_url: 'https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg?auto=compress&cs=tinysrgb&w=600',
    baseFactors: {
      condition: 'good',
      size: 'medium',
      effortToSell: 'high',
      shippable: false,
      resaleValueCents: 1500,
      resaleMinCents: 0,
      resaleMaxCents: 2500,
      replacementCostCents: 22000,
      lastUsed: 'years_ago',
      frequency: 'never',
      seasonal: false,
      sentimentalValue: 'none',
      hasDuplicate: false,
      difficultyToReplace: 'very_easy',
    },
    confidenceScore: 82,
  },
  {
    name: 'KitchenAid Stand Mixer',
    category: 'Kitchen Appliances',
    photo_url: 'https://images.pexels.com/photos/6996064/pexels-photo-6996064.jpeg?auto=compress&cs=tinysrgb&w=600',
    baseFactors: {
      condition: 'excellent',
      size: 'medium',
      effortToSell: 'medium',
      shippable: false,
      resaleValueCents: 19000,
      resaleMinCents: 16000,
      resaleMaxCents: 22000,
      replacementCostCents: 45000,
      lastUsed: 'unknown',
      frequency: 'unknown',
      seasonal: false,
      sentimentalValue: 'none',
      hasDuplicate: false,
      difficultyToReplace: 'easy',
    },
    confidenceScore: 92,
  },
  {
    name: 'Samsung 55" TV (2018)',
    category: 'Electronics',
    photo_url: 'https://images.pexels.com/photos/1201996/pexels-photo-1201996.jpeg?auto=compress&cs=tinysrgb&w=600',
    baseFactors: {
      condition: 'good',
      size: 'large',
      effortToSell: 'high',
      shippable: false,
      resaleValueCents: 12500,
      resaleMinCents: 10000,
      resaleMaxCents: 15000,
      replacementCostCents: 35000,
      lastUsed: 'years_ago',
      frequency: 'rarely',
      seasonal: false,
      sentimentalValue: 'none',
      hasDuplicate: false,
      difficultyToReplace: 'very_easy',
    },
    confidenceScore: 86,
  },
  {
    name: 'Cardboard Boxes (Stack)',
    category: 'Packaging',
    photo_url: 'https://images.pexels.com/photos/4246120/pexels-photo-4246120.jpeg?auto=compress&cs=tinysrgb&w=600',
    baseFactors: {
      condition: 'fair',
      size: 'medium',
      effortToSell: 'low',
      shippable: false,
      resaleValueCents: 0,
      resaleMinCents: 0,
      resaleMaxCents: 0,
      replacementCostCents: 800,
      lastUsed: 'never',
      frequency: 'never',
      seasonal: false,
      sentimentalValue: 'none',
      hasDuplicate: false,
      difficultyToReplace: 'very_easy',
    },
    confidenceScore: 99,
  },
  {
    name: 'Broken Vacuum Cleaner',
    category: 'Appliances',
    photo_url: 'https://images.pexels.com/photos/4108715/pexels-photo-4108715.jpeg?auto=compress&cs=tinysrgb&w=600',
    baseFactors: {
      condition: 'poor',
      size: 'medium',
      effortToSell: 'low',
      shippable: false,
      resaleValueCents: 0,
      resaleMinCents: 0,
      resaleMaxCents: 0,
      replacementCostCents: 0,
      lastUsed: 'never',
      frequency: 'never',
      seasonal: false,
      sentimentalValue: 'none',
      hasDuplicate: false,
      difficultyToReplace: 'very_easy',
    },
    confidenceScore: 96,
  },
  {
    name: 'Floor Lamp',
    category: 'Home & Furniture',
    photo_url: 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=600',
    baseFactors: {
      condition: 'fair',
      size: 'medium',
      effortToSell: 'high',
      shippable: false,
      resaleValueCents: 2500,
      resaleMinCents: 0,
      resaleMaxCents: 4000,
      replacementCostCents: 9500,
      lastUsed: 'unknown',
      frequency: 'unknown',
      seasonal: false,
      sentimentalValue: 'none',
      hasDuplicate: false,
      difficultyToReplace: 'very_easy',
    },
    confidenceScore: 74,
  },
];

export const ROOM_ITEM_POOL: Record<string, number[]> = {
  garage:   [0, 1, 2, 5, 9],
  basement: [3, 4, 6, 10],
  kitchen:  [7, 8, 11],
  attic:    [5, 6, 9, 10],
  storage:  [0, 2, 3, 4, 8],
  closet:   [6, 7, 11],
  office:   [4, 7, 8],
  bedroom:  [3, 6, 11],
  other:    [0, 1, 4, 7],
};

const usedByRoom: Record<string, Set<number>> = {};

export function getNextSampleItem(roomType: string): SampleItem {
  const pool = ROOM_ITEM_POOL[roomType] ?? ROOM_ITEM_POOL.other;
  if (!usedByRoom[roomType]) usedByRoom[roomType] = new Set();
  const used = usedByRoom[roomType];
  const remaining = pool.filter((i) => !used.has(i));
  const candidates = remaining.length > 0 ? remaining : pool;
  if (remaining.length === 0) usedByRoom[roomType] = new Set();
  const idx = candidates[Math.floor(Math.random() * candidates.length)];
  usedByRoom[roomType].add(idx);
  return SAMPLE_ITEMS[idx];
}
