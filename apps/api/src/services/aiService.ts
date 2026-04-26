import OpenAI from "openai";
import { env } from "../config/env";

export type PulseAnalysis = {
  fulfillmentScore: number;
  riskBand: "low" | "medium" | "high";
  summary: string;
  moodColor: string;
  quote: string;
};

const fallbackKeywords = {
  positive: ["grateful", "happy", "joy", "excited", "love", "calm", "progress"],
  negative: ["empty", "anxious", "sad", "alone", "stuck", "panic", "hopeless", "tired"],
};

const fallbackQuoteByRisk: Record<PulseAnalysis["riskBand"], string> = {
  low: "Joy is not in things; it is in us. - Richard Wagner",
  medium: "You do not have to see the whole staircase, just take the first step. - Martin Luther King Jr.",
  high: "In the middle of difficulty lies opportunity. - Albert Einstein",
};

const moodColorByRisk: Record<PulseAnalysis["riskBand"], string> = {
  low: "#FFD700",
  medium: "#F4A261",
  high: "#5DA9E9",
};

const openai = env.openAiApiKey
  ? new OpenAI({
      apiKey: env.openAiApiKey,
    })
  : null;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreFromTextFallback(text: string, lovedToday: boolean): PulseAnalysis {
  const lowered = text.toLowerCase();
  let score = lovedToday ? 60 : 45;
  for (const positive of fallbackKeywords.positive) {
    if (lowered.includes(positive)) score += 6;
  }
  for (const negative of fallbackKeywords.negative) {
    if (lowered.includes(negative)) score -= 8;
  }
  const fulfillmentScore = clampScore(score);
  const riskBand = fulfillmentScore >= 70 ? "low" : fulfillmentScore >= 45 ? "medium" : "high";
  const summary =
    riskBand === "low"
      ? "You seem grounded with moments of appreciation and forward movement."
      : riskBand === "medium"
        ? "Today shows mixed emotions. You may benefit from one intentional restorative action."
        : "Your entry suggests sustained emotional strain. Consider support from trusted people or a professional.";
  return {
    fulfillmentScore,
    riskBand,
    summary,
    moodColor: moodColorByRisk[riskBand],
    quote: fallbackQuoteByRisk[riskBand],
  };
}

function parseJsonFromText(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function analyzePulse(entryText: string, lovedToday: boolean): Promise<PulseAnalysis> {
  if (!openai) {
    return scoreFromTextFallback(entryText, lovedToday);
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You analyze journaling for emotional fulfillment. Return strict JSON with keys: fulfillmentScore (0-100 integer), riskBand (low|medium|high), summary (max 250 chars), quote (short inspirational quote).",
        },
        {
          role: "user",
          content: `Loved day: ${lovedToday ? "yes" : "no"}\nJournal:\n${entryText}`,
        },
      ],
    });

    const text = response.output_text ?? "";
    const parsed = parseJsonFromText(text) as
      | {
          fulfillmentScore?: number;
          riskBand?: "low" | "medium" | "high";
          summary?: string;
          quote?: string;
        }
      | null;

    if (!parsed) {
      return scoreFromTextFallback(entryText, lovedToday);
    }

    const fulfillmentScore = clampScore(Number(parsed.fulfillmentScore ?? 50));
    const riskBand =
      parsed.riskBand === "low" || parsed.riskBand === "medium" || parsed.riskBand === "high"
        ? parsed.riskBand
        : fulfillmentScore >= 70
          ? "low"
          : fulfillmentScore >= 45
            ? "medium"
            : "high";
    const summary = (parsed.summary ?? "").trim() || "Daily check-in processed.";
    const quote = (parsed.quote ?? "").trim() || fallbackQuoteByRisk[riskBand];

    return {
      fulfillmentScore,
      riskBand,
      summary,
      moodColor: moodColorByRisk[riskBand],
      quote,
    };
  } catch {
    return scoreFromTextFallback(entryText, lovedToday);
  }
}
