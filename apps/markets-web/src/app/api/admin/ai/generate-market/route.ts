import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";
import OpenAI from "openai";

const requestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  sourceUrl: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Initialize OpenAI client lazily (not at module level to avoid build errors)
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const body = await request.json();
    const data = requestSchema.parse(body);

    // Fetch existing events and markets for context
    const existingEvents = await prisma.event.findMany({
      where: { isPublished: true },
      select: {
        title: true,
        description: true,
        category: true,
        eventType: true,
        startTime: true,
        endTime: true,
        markets: {
          select: {
            question: true,
            outcomes: true,
            closesAt: true,
            status: true,
          },
          take: 3,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Format existing markets context
    const existingMarketsContext = existingEvents
      .map((event) => {
        const marketInfo = event.markets
          .map((m) => `  - Q: "${m.question}" | Outcomes: ${m.outcomes}`)
          .join("\n");
        return `Event: "${event.title}" (${event.category}, ${event.eventType})
  Start: ${event.startTime?.toISOString() || "TBD"}
  Markets:
${marketInfo}`;
      })
      .join("\n\n");

    const currentDate = new Date().toISOString();

    // Build the comprehensive prompt
    const userPrompt = `CURRENT DATE: ${currentDate}

USER REQUEST:
Title: "${data.title}"
${data.description ? `Description: ${data.description}` : ""}
${data.sourceUrl ? `Reference URL: ${data.sourceUrl}` : ""}

EXISTING MARKETS FOR CONTEXT (to match style and structure):
${existingMarketsContext || "No existing markets yet."}

TASK: Generate a complete prediction market event based on the user request.

Research the topic to find:
- When is this event scheduled to happen?
- Who/what are the main participants or outcomes?
- Any recent news or updates
- Official sources for resolution

Then generate the market structure.

REQUIREMENTS:
1. Create an event with a clear, engaging title
2. Generate a URL-friendly slug (lowercase, hyphens, no special chars)
3. Write a compelling description (2-3 sentences)
4. Assign the correct category from: NFL, NBA, NHL, MLB, SOCCER, UFC, TENNIS, GOLF, ESPORTS, POLITICS, CRYPTO, FINANCE, ENTERTAINMENT, OTHER
5. Assign event type from: MATCHUP (head-to-head), PROP (proposition/multiple outcomes), TOURNAMENT, FUTURES (long-term)
6. Set appropriate dates:
   - startTime: When the event begins (if known, otherwise null)
   - endTime: When the event ends (if known, otherwise null)
7. Create 1-3 markets (prediction questions) for this event:
   - Each market needs a clear question
   - Two outcomes (binary choice) - make them specific and unambiguous
   - opensAt: When betting should open (typically now or soon)
   - closesAt: When betting should close (before event outcome is known)
   - detailsMarkdown: Additional context/rules for resolution
   - resolutionSourceUrl: Official source for determining outcome

DATE GUIDELINES:
- If the event is in the future, set closesAt to before the event start
- If the event is ongoing, set closesAt to before the outcome is determined
- opensAt should be the current date/time or shortly after
- Use ISO 8601 format for all dates

RESPOND WITH VALID JSON ONLY (no markdown code blocks, no explanation before or after):
{
  "event": {
    "title": "string",
    "slug": "string",
    "description": "string",
    "category": "NFL|NBA|NHL|MLB|SOCCER|UFC|TENNIS|GOLF|ESPORTS|POLITICS|CRYPTO|FINANCE|ENTERTAINMENT|OTHER",
    "eventType": "MATCHUP|PROP|TOURNAMENT|FUTURES",
    "startTime": "ISO date string or null",
    "endTime": "ISO date string or null",
    "bannerUrl": null,
    "logoUrl": null
  },
  "markets": [
    {
      "question": "string",
      "outcome0Label": "string",
      "outcome1Label": "string",
      "detailsMarkdown": "string",
      "resolutionSourceUrl": "string or null",
      "opensAt": "ISO date string",
      "closesAt": "ISO date string",
      "feeBps": 100,
      "seed0": 1000,
      "seed1": 1000
    }
  ],
  "reasoning": "Brief explanation of choices made and sources used"
}`;

    const systemPrompt = `You are an expert prediction market creator for Vault Markets, a platform where users bet on real-world event outcomes using virtual currency.

Your task is to create well-structured prediction markets based on user requests. You should:
- Research the topic to understand timing, participants, and potential outcomes
- Create clear, unambiguous market questions
- Set appropriate dates based on when events occur
- Provide resolution sources for determining outcomes

Always respond with valid JSON only. No markdown formatting, no code blocks, no explanations outside the JSON.`;

    // Call OpenAI API using the SDK
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // gpt-4o is the latest model with good reasoning
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 4096,
      temperature: 0.7,
      response_format: { type: "json_object" }, // Ensure JSON response
    });

    const generatedText = completion.choices[0]?.message?.content || "";

    // Parse the JSON response
    let parsed;
    try {
      parsed = JSON.parse(generatedText);
    } catch (parseError) {
      // Try to extract JSON from the response (handle potential wrapping)
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("Failed to parse AI response:", generatedText);
        return NextResponse.json(
          {
            error: "Failed to parse AI response",
            rawResponse: generatedText,
          },
          { status: 500 }
        );
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    // Validate the response structure
    if (!parsed.event || !parsed.markets || !Array.isArray(parsed.markets)) {
      return NextResponse.json(
        {
          error: "Invalid AI response structure",
          rawResponse: parsed,
        },
        { status: 500 }
      );
    }

    // Return the generated content
    return NextResponse.json({
      success: true,
      generated: parsed,
      model: completion.model,
      usage: completion.usage,
    });
  } catch (error: unknown) {
    console.error("AI generation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Handle OpenAI API errors
    if (error instanceof OpenAI.APIError) {
      console.error("OpenAI API Error:", {
        status: error.status,
        message: error.message,
        code: error.code,
      });
      return NextResponse.json(
        {
          error: "AI service error",
          message: error.message,
          code: error.code,
        },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to generate market",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
