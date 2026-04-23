import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { category, raw_input, clarifications, user_id, user_email, location_city } = await req.json();

    // Step 1 — find relevant tools in DB
    const { data: matchedTools } = await adminSupabase
      .from("tools")
      .select("id, name, price_per_day, city, suburb")
      .or(`name.ilike.%${category || "tool"}%,description.ilike.%${raw_input?.substring(0, 50) || ""}%`)
      .neq("status", "sold")
      .limit(5);

    // Step 2 — AI quote
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: `You are an expert NZ tradesperson and home improvement advisor. Generate a structured quote with three options. Use realistic NZ 2025 pricing: tradespeople $80-150/hr callout, handymen $50-90/hr, materials at NZ retail prices. Respond in valid JSON only — no markdown:
{
  "ai_summary": "one sentence job description",
  "diy": {
    "cost_min": number,
    "cost_max": number,
    "time_estimate": "e.g. 30-60 mins",
    "tools_needed": ["tool1", "tool2"],
    "steps_summary": "brief what to do"
  },
  "assisted": {
    "cost_min": number,
    "cost_max": number,
    "description": "what assisted means for this job"
  },
  "professional": {
    "cost_min": number,
    "cost_max": number,
    "notes": "what type of tradesperson and why"
  }
}`,
      messages: [
        {
          role: "user",
          content: `Category: ${category}. Problem: ${raw_input}. Details: ${JSON.stringify(clarifications)}. Location: ${location_city || "New Zealand"}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    let quote: any = {};
    try {
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      quote = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    // Step 3 — save job to DB
    const { data: jobRow } = await adminSupabase
      .from("jobs")
      .insert({
        user_id: user_id || null,
        user_email: user_email || null,
        category,
        raw_input,
        clarifications,
        ai_summary: quote.ai_summary || null,
        location_city: location_city || null,
        tools_matched: matchedTools || [],
        estimated_cost_min: quote.diy?.cost_min || null,
        estimated_cost_max: quote.diy?.cost_max || null,
        status: "quoted",
      })
      .select("id")
      .single();

    return NextResponse.json({
      job_id: jobRow?.id,
      quote,
      matched_tools: matchedTools || [],
    });
  } catch (err) {
    console.error("analyse error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
