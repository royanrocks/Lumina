import { Router } from "express";
import { query } from "../db/client";
import { requireAuth } from "../middleware/auth";

export const supportRouter = Router();

supportRouter.get("/recommendation", requireAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user.userId;
  const trendResult = await query<{ fulfillment_score: number; sentiment_summary: string; created_at: Date }>(
    `SELECT fulfillment_score, sentiment_summary, created_at
     FROM pulse_entries
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 7`,
    [userId]
  );

  if (trendResult.rows.length === 0) {
    return res.json({
      recommendation: {
        quote: "Small steps still count. Show up for your future self today.",
        source: "Lumina Daily",
        action: "Write one sentence about a bright moment, however small.",
        professionalBridge: false
      }
    });
  }

  const avg =
    trendResult.rows.reduce((acc: number, row) => acc + Number(row.fulfillment_score), 0) /
    trendResult.rows.length;
  const highRiskDays = trendResult.rows.filter((row) => Number(row.fulfillment_score) < 35).length;
  const professionalBridge = highRiskDays >= 4;

  if (avg < 35) {
    return res.json({
      recommendation: {
        quote: "You don't have to carry everything alone.",
        source: "The Body Keeps the Score",
        action: "Try a 2-minute grounding breath and consider speaking to a professional.",
        professionalBridge
      }
    });
  }

  if (avg < 65) {
    return res.json({
      recommendation: {
        quote: "Growth is quiet before it becomes visible.",
        source: "Atomic Habits",
        action: "Pick one tiny win for tomorrow and send one supportive nudge.",
        professionalBridge
      }
    });
  }

  return res.json({
    recommendation: {
      quote: "Joy compounds when you notice it.",
      source: "Lumina Daily",
      action: "Capture one meaningful win and help one friend feel seen today.",
      professionalBridge
    }
  });
});
