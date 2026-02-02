import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";
import OpenAI from "openai";

const requestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  sourceUrl: z.string().optional().nullable(),
  referenceUrls: z.string().optional().nullable(),
  pastedText: z.string().optional().nullable(),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        type: z.string().optional().nullable(),
        size: z.number().optional().nullable(),
        content: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  examples: z.unknown().optional().nullable(),
  stream: z.boolean().optional().nullable(),
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
        tags: { select: { label: true, slug: true } },
        markets: {
          select: {
            question: true,
            outcomes: true,
            closesAt: true,
            status: true,
            feeBps: true,
            seed0: true,
            seed1: true,
          },
          take: 3,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const availableTags = await prisma.tag.findMany({
      select: { label: true, slug: true },
      orderBy: { label: "asc" },
    });

    const typicalFeeBps = 100;
    const typicalSeed0 = 100000;
    const typicalSeed1 = 100000;

    // Format existing markets context
    const existingMarketsContext = existingEvents
      .map((event) => {
        const marketInfo = event.markets
          .map(
            (m) =>
              `  - Q: "${m.question}" | Outcomes: ${m.outcomes} | FeeBps: ${m.feeBps} | Seed: ${Number(
                m.seed0
              )}/${Number(m.seed1)}`
          )
          .join("\n");
        const tagInfo = event.tags.map((t) => t.label).join(", ");
        return `Event: "${event.title}" (${event.category}, ${event.eventType})
  Tags: ${tagInfo || "None"}
  Start: ${event.startTime?.toISOString() || "TBD"}
  Markets:
${marketInfo}`;
      })
      .join("\n\n");

    const currentDate = new Date().toISOString();
    const MAX_ATTACHMENT_CHARS = 12000;

    const referenceUrlList = (data.referenceUrls || "")
      .split(/\s+|\n|,/)
      .map((url) => url.trim())
      .filter((url) => url.length > 0);
    const referenceUrlsBlock =
      referenceUrlList.length > 0 ? referenceUrlList.join("\n") : "None";

    const attachmentsBlock =
      data.attachments && data.attachments.length > 0
        ? data.attachments
            .map((att) => {
              const content = att.content || "";
              const truncated =
                content.length > MAX_ATTACHMENT_CHARS
                  ? `${content.slice(0, MAX_ATTACHMENT_CHARS)}\n... [truncated]`
                  : content;
              return `- ${att.name} (${att.type || "unknown"}, ${att.size || 0} bytes)\n${truncated}`;
            })
            .join("\n\n")
        : "None";

    // Build the comprehensive prompt
    const userPrompt = `CURRENT DATE: ${currentDate}

USER REQUEST:
Title: "${data.title}"
${data.description ? `Description: ${data.description}` : ""}
${data.sourceUrl ? `Reference URL: ${data.sourceUrl}` : ""}
${data.referenceUrls || data.pastedText || data.attachments ? `Additional References:\n${referenceUrlsBlock}` : ""}
${data.pastedText ? `\nPasted Notes:\n${data.pastedText}` : ""}
${data.attachments ? `\nUploaded Files:\n${attachmentsBlock}` : ""}
${data.examples ? `Curated Examples (JSON): ${JSON.stringify(data.examples)}` : ""}

AVAILABLE TAGS:
${availableTags.map((t) => `${t.label} (${t.slug})`).join(", ") || "None"}

TYPICAL MARKET DEFAULTS:
- feeBps: ${typicalFeeBps}
- seed0: ${typicalSeed0}
- seed1: ${typicalSeed1}

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
6. Set appropriate dates based on verified scheduling info:
   - startTime: When the event begins (if known, otherwise null)
   - endTime: When the event ends (if known, otherwise null)
7. Add 2-5 relevant tags for the event. Prefer existing tags; create new only if needed.
8. Create 1-3 markets (prediction questions) for this event:
   - Each market needs a clear question
   - Two outcomes (binary choice) - make them specific and unambiguous
   - opensAt: When betting should open (typically now or soon)
   - closesAt: When betting should close (before event outcome is known)
   - detailsMarkdown: Additional context/rules for resolution
   - resolutionSourceUrl: Official source for determining outcome
   - feeBps, seed0, seed1: Use the typical defaults unless the topic suggests a different liquidity profile
9. Provide an end-user summary that explains how this resolves in plain English
10. Provide a short list of sources used (URLs or source names)

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
    "logoUrl": null,
    "tags": ["string"]
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
      "seed0": 100000,
      "seed1": 100000
    }
  ],
  "summary": "End-user friendly resolution summary",
  "sources": ["string"],
  "reasoning": "Brief explanation of choices made and sources used"
}`;

    const systemPrompt = `You are an expert prediction market creator for Vault Markets, a platform where users bet on real-world event outcomes using virtual currency.

Your task is to create well-structured prediction markets based on user requests. You should:
- Research the topic to understand timing, participants, and potential outcomes
- Create clear, unambiguous market questions
- Set appropriate dates based on when events occur
- Provide resolution sources for determining outcomes

Always respond with valid JSON only. No markdown formatting, no code blocks, no explanations outside the JSON.`;

    const normalizeTags = (tags: unknown): string[] => {
      if (!Array.isArray(tags)) return [];
      const seen = new Set<string>();
      return tags
        .filter((t) => typeof t === "string")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .filter((t) => {
          const key = t.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 8);
    };

    const normalizeSources = (sources: unknown): string[] => {
      if (!Array.isArray(sources)) return [];
      const seen = new Set<string>();
      return sources
        .filter((s) => typeof s === "string")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .filter((s) => {
          const key = s.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 10);
    };

    const normalizeSeed = (value: unknown, fallback: number) => {
      const num = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(num)) return fallback;
      return num < fallback ? fallback : Math.round(num);
    };

    const parseAiResponse = (generatedText: string) => {
      let parsed;
      try {
        parsed = JSON.parse(generatedText);
      } catch {
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("Failed to parse AI response");
        }
        parsed = JSON.parse(jsonMatch[0]);
      }

      if (!parsed.event || !parsed.markets || !Array.isArray(parsed.markets)) {
        throw new Error("Invalid AI response structure");
      }

      parsed.event.tags = normalizeTags(parsed.event.tags);
      parsed.summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
      parsed.sources = normalizeSources(parsed.sources);
      parsed.markets = parsed.markets.map((market: Record<string, unknown>) => ({
        ...market,
        feeBps:
          typeof market.feeBps === "number" && Number.isFinite(market.feeBps)
            ? market.feeBps
            : typicalFeeBps,
        seed0: normalizeSeed(market.seed0, typicalSeed0),
        seed1: normalizeSeed(market.seed1, typicalSeed1),
      }));

      return parsed;
    };

    const model = "gpt-5.2";
    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ];

    // Chat Completions API for GPT-5.2:
    // - reasoning_effort: top-level param (none|low|medium|high|xhigh)
    // - verbosity: top-level param (low|medium|high)
    // - max_completion_tokens: token limit for output
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completionRequest: any = {
      model,
      messages,
      max_completion_tokens: 16000,
      reasoning_effort: "medium",
    };

    if (data.stream) {
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: string, payload: unknown) => {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
            );
          };

          try {
            sendEvent("status", "starting");
            const streamCompletion = (await openai.chat.completions.create({
              ...completionRequest,
              stream: true,
            })) as unknown as AsyncIterable<{
              choices?: { delta?: { content?: string } }[];
            }>;

            let generatedText = "";
            for await (const chunk of streamCompletion) {
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) {
                generatedText += delta;
                sendEvent("token", delta);
              }
            }

            sendEvent("status", "parsing");
            const parsed = parseAiResponse(generatedText);
            sendEvent("result", parsed);
            sendEvent("done", true);
          } catch (streamError) {
            sendEvent(
              "error",
              streamError instanceof Error ? streamError.message : "AI generation failed"
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const completion = await openai.chat.completions.create(completionRequest);
    const generatedText = completion.choices[0]?.message?.content || "";
    const parsed = parseAiResponse(generatedText);

    return NextResponse.json({ success: true, generated: parsed });
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
