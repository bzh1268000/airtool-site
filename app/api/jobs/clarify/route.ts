import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set in environment variables");
}
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const FALLBACK = {
  summary: "home job",
  question1: {
    text: "How urgent is this?",
    options: ["Can wait a few days", "This week", "Urgent — today"],
  },
  question2: {
    text: "Have you tried fixing it before?",
    options: ["No, first time", "Yes, no luck"],
  },
};

export async function POST(req: NextRequest) {
  try {
    const { category, raw_input } = await req.json();

    if (!raw_input?.trim()) {
      return NextResponse.json(FALLBACK);
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: `You are a helpful NZ home improvement assistant. The user has described a home job or problem. Quickly confirm what the problem is and ask maximum 2 clarifying questions to help determine the right solution. Always respond in valid JSON only with exactly this structure — no markdown, no explanation, just JSON:
{
  "summary": "brief job description e.g. leaking kitchen tap",
  "question1": { "text": "short question", "options": ["option1", "option2", "option3"] },
  "question2": { "text": "short question", "options": ["option1", "option2"] }
}
Keep questions short. Options 2-4 short phrases. Friendly and quick. Respond in the same language the user used.`,
      messages: [
        {
          role: "user",
          content: `Category: ${category || "general"}. Problem description: ${raw_input}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    console.log("clarify — raw Claude response:", text);

    try {
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    } catch (parseErr) {
      console.error("clarify — JSON parse failed:", parseErr, "raw text was:", text);
      return NextResponse.json(FALLBACK);
    }
  } catch (err) {
    console.error("clarify — API call failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(FALLBACK);
  }
}
