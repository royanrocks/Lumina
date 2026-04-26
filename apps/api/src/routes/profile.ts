import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth } from "../middleware/auth";

export const profileRouter = Router();

profileRouter.get("/me", requireAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { rows } = await pool.query(
    `SELECT id, phone, name, birthday, EXTRACT(YEAR FROM age(CURRENT_DATE, birthday))::int AS age, location, education, gender, personality_type
     FROM users
     WHERE id = $1`,
    [req.user.userId]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: "User not found." });
  }

  res.json({ profile: rows[0] });
});

profileRouter.put("/me", requireAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { name, birthday, location, education, gender, personalityType } = req.body ?? {};

  const { rows } = await pool.query(
    `UPDATE users
     SET name = COALESCE($1, name),
      birthday = COALESCE($2::date, birthday),
         location = COALESCE($3, location),
         education = COALESCE($4, education),
         gender = COALESCE($5, gender),
         personality_type = COALESCE($6, personality_type),
         updated_at = NOW()
     WHERE id = $7
     RETURNING id, phone, name, birthday, EXTRACT(YEAR FROM age(CURRENT_DATE, birthday))::int AS age, location, education, gender, personality_type`,
    [
      name ?? null,
      birthday ?? null,
      location ?? null,
      education ?? null,
      gender ?? null,
      personalityType ?? null,
      req.user.userId
    ]
  );

  res.json({ profile: rows[0] });
});
