import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriceRequest {
  identification: {
    object_name: string;
    brand: string | null;
    model: string | null;
    category: string | null;
    condition: string | null;
  };
  corrected_model?: string | null;
  project_id?: string;
  item_id?: string;
  identification_id?: string;
}

interface ComparableListing {
  title: string;
  price_cents: number;
  condition: string | null;
  url: string | null;
  image_url: string | null;
  shipping_price_cents: number | null;
  item_id: string | null;
}

interface PricingResult {
  median_sold_cents: number;
  min_sold_cents: number;
  max_sold_cents: number;
  recommended_list_cents: number;
  quick_sale_cents: number;
  confidence_level: "high" | "medium" | "low";
  confidence_score: number;
  comparable_count: number;
  comparables: ComparableListing[];
  outliers_removed: number;
  search_query: string;
  source: "ebay_browse" | "ai_estimate";
}

// ─── eBay OAuth ────────────────────────────────────────────────────────────────

async function getEbayAccessToken(): Promise<string | null> {
  const clientId = Deno.env.get("EBAY_CLIENT_ID");
  const clientSecret = Deno.env.get("EBAY_CLIENT_SECRET");

  if (!clientId || !clientSecret) return null;

  const credentials = btoa(`${clientId}:${clientSecret}`);

  try {
    const response = await fetch(
      "https://api.ebay.com/identity/v1/application/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "https://api.ebay.com/oauth/api_scope",
        }),
      },
    );

    if (!response.ok) {
      console.error("eBay OAuth failed:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (err) {
    console.error("eBay OAuth error:", err);
    return null;
  }
}

// ─── eBay Browse API search ────────────────────────────────────────────────────

async function searchEbayListings(
  accessToken: string,
  query: string,
  limit = 50,
): Promise<ComparableListing[]> {
  const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  // Sort by price + shipping to get a spread
  url.searchParams.set("sort", "price");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    });

    if (!response.ok) {
      console.error("eBay Browse search failed:", response.status, await response.text());
      return [];
    }

    const data = await response.json();
    const items = (data.itemSummaries ?? []) as Array<Record<string, unknown>>;

    return items
      .map((item) => {
        const price = item.price;
        const priceCents = price
          ? Math.round(parseFloat(price.value as string) * 100)
          : 0;
        const shipping = item.shippingOptions?.[0]?.shippingCost;
        const shippingCents = shipping
          ? Math.round(parseFloat(shipping.value as string) * 100)
          : null;
        return {
          title: item.title as string,
          price_cents: priceCents,
          condition: (item.condition as string) ?? null,
          url: (item.itemWebUrl as string) ?? null,
          image_url: (item.image?.imageUrl as string) ?? null,
          shipping_price_cents: shippingCents,
          item_id: (item.itemId as string) ?? null,
        } as ComparableListing;
      })
      .filter((c) => c.price_cents > 0);
  } catch (err) {
    console.error("eBay Browse search error:", err);
    return [];
  }
}

// ─── IQR-based outlier removal ─────────────────────────────────────────────────

function removeOutliers(prices: number[]): { filtered: number[]; removed: number } {
  if (prices.length < 4) return { filtered: prices, removed: 0 };

  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const q1 = sorted[Math.floor(mid / 2)];
  const q3 = sorted[mid + Math.floor((sorted.length - mid) / 2)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const filtered = sorted.filter((p) => p >= lowerBound && p <= upperBound);
  return { filtered, removed: sorted.length - filtered.length };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// ─── AI fallback pricing via OpenAI ────────────────────────────────────────────

async function aiEstimatePrice(
  identification: PriceRequest["identification"],
  correctedModel?: string | null,
): Promise<PricingResult | null> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return null;

  const model = correctedModel ?? identification.model;
  const brand = identification.brand;
  const name = identification.object_name;
  const condition = identification.condition ?? "good";

  const prompt = `You are a resale pricing expert. Estimate the realistic sold price range for this item on the secondary market (eBay, Facebook Marketplace, etc.).

Item: ${name}
Brand: ${brand ?? "unknown"}
Model: ${model ?? "unknown"}
Condition: ${condition}

Based on your knowledge of secondary market resale values, provide:
- median_sold_cents: The most likely sold price in cents (e.g. 15000 = $150)
- min_sold_cents: The low end of realistic sold prices in cents
- max_sold_cents: The high end of realistic sold prices in cents
- recommended_list_cents: The suggested listing price in cents (slightly above median)
- quick_sale_cents: A price that would sell within a few days in cents
- confidence_level: "high", "medium", or "low" based on how confident you are
- confidence_score: 0-100

Be conservative. Do not inflate prices. If you're unsure, set confidence to "low".`;

  const schema = {
    type: "json_schema",
    json_schema: {
      name: "price_estimate",
      schema: {
        type: "object",
        properties: {
          median_sold_cents: { type: "integer" },
          min_sold_cents: { type: "integer" },
          max_sold_cents: { type: "integer" },
          recommended_list_cents: { type: "integer" },
          quick_sale_cents: { type: "integer" },
          confidence_level: { type: "string", enum: ["high", "medium", "low"] },
          confidence_score: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: ["median_sold_cents", "min_sold_cents", "max_sold_cents", "recommended_list_cents", "quick_sale_cents", "confidence_level", "confidence_score"],
        additionalProperties: false,
      },
      strict: true,
    },
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        text: { format: schema },
        max_output_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const outputText = data.output
      ?.flatMap((o: Record<string, unknown>) =>
        o.type === "message" ? (o.content as Array<Record<string, unknown>>) : []
      )
      ?.find((c: Record<string, unknown>) => c.type === "output_text")
      ?.text;

    if (!outputText) return null;

    const parsed = JSON.parse(outputText);

    return {
      median_sold_cents: parsed.median_sold_cents,
      min_sold_cents: parsed.min_sold_cents,
      max_sold_cents: parsed.max_sold_cents,
      recommended_list_cents: parsed.recommended_list_cents,
      quick_sale_cents: parsed.quick_sale_cents,
      confidence_level: parsed.confidence_level,
      confidence_score: parsed.confidence_score,
      comparable_count: 0,
      comparables: [],
      outliers_removed: 0,
      search_query: `${brand ?? ""} ${model ?? name}`.trim(),
      source: "ai_estimate",
    };
  } catch (err) {
    console.error("AI price estimate error:", err);
    return null;
  }
}

// ─── Build search query from identification ────────────────────────────────────

function buildSearchQuery(identification: PriceRequest["identification"], correctedModel?: string | null): string {
  const model = correctedModel ?? identification.model;
  const parts: string[] = [];

  if (identification.brand) parts.push(identification.brand);
  if (model) parts.push(model);
  if (parts.length === 0) parts.push(identification.object_name);

  return parts.join(" ");
}

// ─── Calculate confidence from data quality ────────────────────────────────────

function calculateConfidence(comparableCount: number, outliersRemoved: number): { level: "high" | "medium" | "low"; score: number } {
  if (comparableCount >= 20) return { level: "high", score: Math.min(95, 70 + comparableCount) };
  if (comparableCount >= 10) return { level: "high", score: 75 };
  if (comparableCount >= 5) return { level: "medium", score: 60 };
  if (comparableCount >= 2) return { level: "medium", score: 45 };
  return { level: "low", score: 25 };
}

// ─── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json() as PriceRequest;
    const { identification, corrected_model, project_id, item_id, identification_id } = body;

    if (!identification || !identification.object_name) {
      return new Response(
        JSON.stringify({ error: "Identification with object_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const searchQuery = buildSearchQuery(identification, corrected_model);

    // ── Try eBay Browse API first ────────────────────────────────────
    let comparables: ComparableListing[] = [];
    let source: "ebay_browse" | "ai_estimate" = "ebay_browse";

    const ebayToken = await getEbayAccessToken();
    if (ebayToken) {
      comparables = await searchEbayListings(ebayToken, searchQuery);
    }

    // If we got eBay data, compute pricing from it
    if (comparables.length >= 2) {
      const allPrices = comparables.map((c) => c.price_cents);
      const { filtered, removed } = removeOutliers(allPrices);

      if (filtered.length > 0) {
        const med = median(filtered);
        const min = filtered[0];
        const max = filtered[filtered.length - 1];

        // Recommended list: ~8-12% above median
        const recommendedList = Math.round(med * 1.1);
        // Quick sale: ~15% below median
        const quickSale = Math.round(med * 0.85);

        const conf = calculateConfidence(filtered.length, removed);

        const result: PricingResult = {
          median_sold_cents: med,
          min_sold_cents: min,
          max_sold_cents: max,
          recommended_list_cents: recommendedList,
          quick_sale_cents: quickSale,
          confidence_level: conf.level,
          confidence_score: conf.score,
          comparable_count: filtered.length,
          comparables: comparables.slice(0, 12),
          outliers_removed: removed,
          search_query: searchQuery,
          source,
        };

        // Store in Supabase
        await storePricing(result, { project_id, item_id, identification_id });

        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Fallback to AI estimate ──────────────────────────────────────
    source = "ai_estimate";
    const aiResult = await aiEstimatePrice(identification, corrected_model);

    if (aiResult) {
      aiResult.source = source;
      await storePricing(aiResult, { project_id, item_id, identification_id });
      return new Response(
        JSON.stringify(aiResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── No data available ─────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        error: "Unable to generate pricing. eBay API credentials may not be configured and AI fallback failed.",
        median_sold_cents: 0,
        min_sold_cents: 0,
        max_sold_cents: 0,
        recommended_list_cents: 0,
        quick_sale_cents: 0,
        confidence_level: "low",
        confidence_score: 0,
        comparable_count: 0,
        comparables: [],
        outliers_removed: 0,
        search_query: searchQuery,
        source: "ai_estimate",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("price-item error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ─── Store pricing in Supabase ────────────────────────────────────────────────

async function storePricing(
  result: PricingResult,
  refs: { project_id?: string; item_id?: string; identification_id?: string },
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) return;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from("item_pricings")
      .insert({
        item_id: refs.item_id ?? null,
        identification_id: refs.identification_id ?? null,
        search_query: result.search_query,
        median_sold_cents: result.median_sold_cents,
        min_sold_cents: result.min_sold_cents,
        max_sold_cents: result.max_sold_cents,
        recommended_list_cents: result.recommended_list_cents,
        quick_sale_cents: result.quick_sale_cents,
        confidence_level: result.confidence_level,
        confidence_score: result.confidence_score,
        comparable_count: result.comparable_count,
        comparables: result.comparables,
        outliers_removed: result.outliers_removed,
      })
      .select()
      .maybeSingle();

    // Link pricing to item if we have an item_id
    if (data && refs.item_id) {
      await supabase
        .from("items")
        .update({ pricing_id: data.id })
        .eq("id", refs.item_id);
    }
  } catch (err) {
    console.error("Failed to store pricing:", err);
  }
}
