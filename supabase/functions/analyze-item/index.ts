import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface IdentificationResult {
  object_name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  condition: string | null;
  accessories: string[];
  replacement_cost_cents: number | null;
  confidence_level: "high" | "medium" | "low";
  confidence_score: number;
  needs_more_photos: boolean;
  missing_info: string[];
}

const SYSTEM_PROMPT = `You are an expert at identifying household items from photographs for a decluttering app called "Keep or Go."

Analyze the provided image(s) and identify the item with maximum accuracy.

For each item, determine:
1. **object_name**: A clear, specific name (e.g. "Trek Mountain Bike", "KitchenAid Stand Mixer", "Box of Hardcover Books")
2. **brand**: The manufacturer brand if visible or identifiable (null if unknown)
3. **model**: The specific model name/number if visible (null if unknown)
4. **category**: One of these categories: Electronics, Tools, Sports & Fitness, Kitchen Appliances, Home & Furniture, Books & Media, Musical Instruments, Clothing, Toys & Games, Collectibles, Appliances, Packaging, Garden, Automotive, Other
5. **condition**: One of: excellent, good, fair, poor (based on visible wear, damage, age)
6. **accessories**: List of any visible included accessories (cables, cases, remotes, manuals, etc.)
7. **replacement_cost_cents**: Estimated cost to buy this item new today, in cents (e.g. 45000 = $450). Use 0 if the item has no replacement value (e.g. trash, cardboard boxes). Use null if completely unknown.
8. **confidence_level**: Your confidence in this identification
   - "high": You can clearly identify the object, brand, and model
   - "medium": You can identify the object type but some details are uncertain
   - "low": The image is unclear, the object is partially visible, or you cannot identify key details
9. **confidence_score**: A numeric confidence score 0-100
10. **needs_more_photos**: Set to true if the image is too unclear to identify confidently, or if critical details (brand, model, condition, size) cannot be determined
11. **missing_info**: List of what's missing that another photo could help with. Options: "brand", "model", "size", "condition", "accessories", "label", "serial_number"

IMPORTANT RULES:
- Do NOT estimate resale value. Only estimate replacement cost.
- Do NOT guess. If you cannot see a brand or model, set it to null.
- If the photo is blurry, dark, or the item is partially obscured, set needs_more_photos to true.
- Be conservative with confidence. It's better to ask for another photo than to guess wrong.
- For groups of items, identify the most prominent object and note if multiple items are present.
- replacement_cost_cents should reflect what it would cost to buy the equivalent item NEW today.`;

const RESPONSE_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "item_identification",
    schema: {
      type: "object",
      properties: {
        object_name: { type: "string" },
        brand: { type: ["string", "null"] },
        model: { type: ["string", "null"] },
        category: { type: ["string", "null"] },
        condition: { type: ["string", "null"] },
        accessories: {
          type: "array",
          items: { type: "string" },
        },
        replacement_cost_cents: { type: ["integer", "null"] },
        confidence_level: {
          type: "string",
          enum: ["high", "medium", "low"],
        },
        confidence_score: { type: "integer", minimum: 0, maximum: 100 },
        needs_more_photos: { type: "boolean" },
        missing_info: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: [
        "object_name",
        "brand",
        "model",
        "category",
        "condition",
        "accessories",
        "replacement_cost_cents",
        "confidence_level",
        "confidence_score",
        "needs_more_photos",
        "missing_info",
      ],
      additionalProperties: false,
    },
    strict: true,
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── Parse request ─────────────────────────────────────────────
    const body = await req.json();
    const { images, project_id, item_id } = body as {
      images: string[];
      project_id?: string;
      item_id?: string;
    };

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (images.length > 4) {
      return new Response(
        JSON.stringify({ error: "Maximum 4 images per request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Validate image format ─────────────────────────────────────
    for (const img of images) {
      if (!img.startsWith("data:image/") && !img.startsWith("http")) {
        return new Response(
          JSON.stringify({ error: "Images must be base64 data URLs or HTTP URLs" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Check for OpenAI API key ───────────────────────────────────
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: "OpenAI API key is not configured. Add OPENAI_API_KEY as an edge function secret.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Build OpenAI Responses API request ────────────────────────
    const inputContent: Array<Record<string, unknown>> = [
      { type: "input_text", text: SYSTEM_PROMPT },
    ];

    for (const image of images) {
      inputContent.push({
        type: "input_image",
        image_url: image,
      });
    }

    const openaiRequest = {
      model: "gpt-4o",
      input: [
        {
          role: "user",
          content: inputContent,
        },
      ],
      text: {
        format: RESPONSE_SCHEMA,
      },
      max_output_tokens: 1000,
      temperature: 0.2,
    };

    // ── Call OpenAI Responses API ─────────────────────────────────
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify(openaiRequest),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", openaiResponse.status, errorText);
      return new Response(
        JSON.stringify({
          error: `OpenAI analysis failed (${openaiResponse.status}). Check that your API key is valid and has access to gpt-4o.`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openaiData = await openaiResponse.json();

    // ── Extract structured output ─────────────────────────────────
    let parsed: IdentificationResult;
    try {
      // The Responses API returns output as an array of message items
      const outputText = openaiData.output
        ?.flatMap((o: Record<string, unknown>) =>
          o.type === "message" ? (o.content as Array<Record<string, unknown>>) : []
        )
        ?.find((c: Record<string, unknown>) => c.type === "output_text")
        ?.text;

      if (!outputText) {
        throw new Error("No output text in OpenAI response");
      }

      parsed = JSON.parse(outputText) as IdentificationResult;
    } catch (parseErr) {
      console.error("Failed to parse OpenAI response:", parseErr);
      console.error("Raw output:", JSON.stringify(openaiData.output));
      return new Response(
        JSON.stringify({ error: "Failed to parse identification result" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Validate parsed result ────────────────────────────────────
    if (!parsed.object_name || typeof parsed.object_name !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid identification: missing object name" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sanitize arrays
    if (!Array.isArray(parsed.accessories)) parsed.accessories = [];
    if (!Array.isArray(parsed.missing_info)) parsed.missing_info = [];

    // ── Store in Supabase ─────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      const insertData = {
        item_id: item_id ?? null,
        project_id: project_id ?? null,
        photo_urls: images,
        object_name: parsed.object_name,
        brand: parsed.brand ?? null,
        model: parsed.model ?? null,
        category: parsed.category ?? null,
        condition: parsed.condition ?? null,
        accessories: parsed.accessories,
        replacement_cost_cents: parsed.replacement_cost_cents ?? null,
        confidence_level: parsed.confidence_level,
        confidence_score: parsed.confidence_score,
        needs_more_photos: parsed.needs_more_photos,
        missing_info: parsed.missing_info,
        raw_response: openaiData,
      };

      const { data: inserted, error: insertError } = await supabase
        .from("item_identifications")
        .insert(insertData)
        .select()
        .maybeSingle();

      if (insertError) {
        console.error("Failed to store identification:", insertError);
      }

      // Return the identification with its DB id
      if (inserted) {
        return new Response(
          JSON.stringify({
            identification_id: inserted.id,
            ...parsed,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Return result (even if DB storage failed) ─────────────────
    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
