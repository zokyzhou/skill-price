import { NextRequest, NextResponse } from 'next/server';

// Model input costs per 1M tokens (USD, March 2026)
const MODEL_RATES: Record<string, number> = {
  'claude-haiku-4-5': 0.80,
  'claude-sonnet-4-6': 3.00,
  'claude-opus-4-6': 15.00,
  'gpt-4o-mini': 0.15,
  'gpt-4o': 2.50,
};

const DEFAULT_MODEL = 'claude-sonnet-4-6';

// Approximate token count: ~4 chars per token for English prose/markdown
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Demand multiplier: scales from 1.0 (0 installs) to ~3.0 (10k+ installs)
function demandMultiplier(installs: number): number {
  if (installs <= 0) return 1.0;
  return Math.min(3.0, 1.0 + Math.log10(installs + 1) * 0.8);
}

// Quality multiplier: scales from 0.5 (1-star) to 1.5 (5-star)
function qualityMultiplier(rating: number): number {
  const clamped = Math.max(1, Math.min(5, rating));
  return 0.5 + ((clamped - 1) / 4) * 1.0;
}

// Retention multiplier: ratio of active users to total installs
function retentionMultiplier(installs: number, activeUsers30d: number): number {
  if (installs <= 0) return 1.0;
  const ratio = Math.min(1, activeUsers30d / installs);
  return 0.8 + ratio * 0.4; // 0.8 → 1.2
}

// Category base price multiplier
const CATEGORY_MULTIPLIERS: Record<string, number> = {
  productivity: 1.3,
  utilities: 1.1,
  data: 1.2,
  finance: 1.4,
  social: 0.9,
  fun: 0.7,
  other: 1.0,
};

// Suggest a monthly subscription price tier
function suggestPriceTier(score: number): { price: string; tier: string } {
  if (score < 0.5)  return { price: 'Free',       tier: 'free'    };
  if (score < 2)    return { price: '$1.99/mo',   tier: 'starter' };
  if (score < 5)    return { price: '$4.99/mo',   tier: 'popular' };
  if (score < 15)   return { price: '$9.99/mo',   tier: 'pro'     };
  return              { price: '$19.99/mo',  tier: 'premium' };
}

export async function POST(request: NextRequest) {
  let body: {
    content?: string;
    installs?: number;
    active_30d?: number;
    rating?: number;
    category?: string;
    model?: string;
    uses_per_month?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    content = '',
    installs = 0,
    active_30d = 0,
    rating = 3.0,
    category = 'other',
    model = DEFAULT_MODEL,
    uses_per_month = 1000,
  } = body;

  if (!content || content.trim().length === 0) {
    return NextResponse.json({ error: '"content" field is required' }, { status: 400 });
  }

  const modelRate = MODEL_RATES[model] ?? MODEL_RATES[DEFAULT_MODEL];
  const tokens = estimateTokens(content);
  const costPerUse = (tokens / 1_000_000) * modelRate;
  const monthlyCost = costPerUse * uses_per_month;

  const demand    = demandMultiplier(installs);
  const quality   = qualityMultiplier(rating);
  const retention = retentionMultiplier(installs, active_30d);
  const categoryMult = CATEGORY_MULTIPLIERS[category] ?? 1.0;

  // Value score: composite signal used to pick price tier
  const valueScore = monthlyCost * demand * quality * retention * categoryMult;

  const { price, tier } = suggestPriceTier(valueScore);

  return NextResponse.json({
    tokens,
    model,
    cost_per_use_usd:  parseFloat(costPerUse.toFixed(6)),
    monthly_cost_usd:  parseFloat(monthlyCost.toFixed(4)),
    signals: {
      demand_multiplier:    parseFloat(demand.toFixed(2)),
      quality_multiplier:   parseFloat(quality.toFixed(2)),
      retention_multiplier: parseFloat(retention.toFixed(2)),
      category_multiplier:  categoryMult,
    },
    value_score:     parseFloat(valueScore.toFixed(4)),
    suggested_price: price,
    tier,
  });
}
