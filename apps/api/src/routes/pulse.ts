import { Router } from "express";
import { query } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { analyzePulse, extractTextFromImage } from "../services/aiService";
import { getMoodColorFromScore } from "../services/socialService";

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
  const { journalText, imageText, lovedDay, moodScore } = req.body ?? {};

  if (typeof lovedDay !== "boolean" && typeof moodScore !== "number") {
    return res.status(400).json({ error: "Provide lovedDay boolean or moodScore number (0-100)." });
  }

  const textInput = [journalText, imageText].filter(Boolean).join("\n\n").trim();
  if (!textInput) {
    return res.status(400).json({ error: "Provide journalText or imageText" });
  }

  const normalizedMoodScore =
    typeof moodScore === "number" ? Math.max(0, Math.min(100, Math.round(moodScore))) : null;
  const analysis = await analyzePulse(textInput, typeof lovedDay === "boolean" ? lovedDay : normalizedMoodScore! >= 55);
  const finalScore = normalizedMoodScore ?? analysis.fulfillmentScore;
  const finalRiskBand = finalScore >= 70 ? "low" : finalScore >= 45 ? "medium" : "high";
  const finalMoodColor = getMoodColorFromScore(finalScore);
  const finalLovedDay = typeof lovedDay === "boolean" ? lovedDay : finalScore >= 55;

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
    [req.user.userId, journalText ?? null, imageText ?? null, finalScore, finalRiskBand, analysis.summary, finalLovedDay, finalMoodColor]
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

pulseRouter.get("/history", requireAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user.userId;

  const day = await query<{ day: string; avg_score: string; mood_color: string }>(
    `
      SELECT
        TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day,
        ROUND(AVG(fulfillment_score))::text AS avg_score,
        CASE
          WHEN AVG(fulfillment_score) >= 70 THEN '#FFD700'
          WHEN AVG(fulfillment_score) >= 45 THEN '#F4A261'
          ELSE '#5DA9E9'
        END AS mood_color
      FROM pulse_entries
      WHERE user_id = $1
      GROUP BY DATE(created_at)
      ORDER BY day DESC
      LIMIT 31
    `,
    [userId]
  );

  const week = await query<{ label: string; avg_score: string; mood_color: string }>(
    `
      SELECT
        TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD') AS label,
        ROUND(AVG(fulfillment_score))::text AS avg_score,
        CASE
          WHEN AVG(fulfillment_score) >= 70 THEN '#FFD700'
          WHEN AVG(fulfillment_score) >= 45 THEN '#F4A261'
          ELSE '#5DA9E9'
        END AS mood_color
      FROM pulse_entries
      WHERE user_id = $1
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY label DESC
      LIMIT 12
    `,
    [userId]
  );

  const month = await query<{ label: string; avg_score: string; mood_color: string }>(
    `
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS label,
        ROUND(AVG(fulfillment_score))::text AS avg_score,
        CASE
          WHEN AVG(fulfillment_score) >= 70 THEN '#FFD700'
          WHEN AVG(fulfillment_score) >= 45 THEN '#F4A261'
          ELSE '#5DA9E9'
        END AS mood_color
      FROM pulse_entries
      WHERE user_id = $1
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY label DESC
      LIMIT 12
    `,
    [userId]
  );

  return res.json({
    day: day.rows.map((row) => ({
      date: row.day,
      score: Number(row.avg_score),
      color: row.mood_color
    })),
    week: week.rows.map((row) => ({
      label: row.label,
      score: Number(row.avg_score),
      color: row.mood_color
    })),
    month: month.rows.map((row) => ({
      label: row.label,
      score: Number(row.avg_score),
      color: row.mood_color
    }))
  });
});
