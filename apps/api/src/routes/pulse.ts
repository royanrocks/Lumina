import { Router } from "express";
import { query } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { analyzePulse, extractTextFromImage } from "../services/aiService";

export const pulseRouter = Router();

pulseRouter.post("/ocr", requireAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { imageBase64 } = req.body ?? {};
  if (typeof imageBase64 !== "string" || imageBase64.trim().length === 0) {
    return res.status(400).json({ error: "imageBase64 is required" });
  }

  const text = await extractTextFromImage(imageBase64);
  return res.json({ text });
});

pulseRouter.post("/checkin", requireAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { journalText, imageText, lovedDay } = req.body ?? {};

  if (typeof lovedDay !== "boolean") {
    return res.status(400).json({ error: "lovedDay boolean is required" });
  }

  const textInput = [journalText, imageText].filter(Boolean).join("\n\n").trim();
  if (!textInput) {
    return res.status(400).json({ error: "Provide journalText or imageText" });
  }

  const analysis = await analyzePulse(textInput, lovedDay);

  const insert = await query<{
    id: string;
    fulfillment_score: number;
    risk_band: string;
    sentiment_summary: string;
    love_today: boolean;
    mood_color: string;
    created_at: string;
  }>(
    `
      INSERT INTO pulse_entries (
        user_id,
        journal_text,
        ocr_text,
        fulfillment_score,
        risk_band,
        sentiment_summary,
        love_today,
        mood_color
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, fulfillment_score, risk_band, sentiment_summary, love_today, mood_color, created_at
    `,
    [req.user.userId, journalText ?? null, imageText ?? null, analysis.fulfillmentScore, analysis.riskBand, analysis.summary, lovedDay, analysis.moodColor]
  );

  return res.status(201).json({
    checkin: {
      ...insert.rows[0],
      quote: analysis.quote
    }
  });
});

pulseRouter.get("/trends", requireAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const weekly = await query<{ avg_score: string; love_ratio: string }>(
    `
      SELECT
        COALESCE(AVG(fulfillment_score), 0)::numeric(10,2)::text as avg_score,
        COALESCE(AVG(CASE WHEN love_today THEN 1 ELSE 0 END), 0)::numeric(10,2)::text as love_ratio
      FROM pulse_entries
      WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '7 day'
    `,
    [req.user.userId]
  );

  const monthly = await query<{ avg_score: string; love_ratio: string }>(
    `
      SELECT
        COALESCE(AVG(fulfillment_score), 0)::numeric(10,2)::text as avg_score,
        COALESCE(AVG(CASE WHEN love_today THEN 1 ELSE 0 END), 0)::numeric(10,2)::text as love_ratio
      FROM pulse_entries
      WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '30 day'
    `,
    [req.user.userId]
  );

  return res.json({
    weekly: {
      avgScore: Number(weekly.rows[0]?.avg_score ?? 0),
      loveRatio: Number(weekly.rows[0]?.love_ratio ?? 0)
    },
    monthly: {
      avgScore: Number(monthly.rows[0]?.avg_score ?? 0),
      loveRatio: Number(monthly.rows[0]?.love_ratio ?? 0)
    }
  });
});
