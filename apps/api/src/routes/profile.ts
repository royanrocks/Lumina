import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth } from "../middleware/auth";

export const profileRouter = Router();

profileRouter.get("/me", requireAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { rows } = await pool.query(
    `SELECT id, phone, name, birth_date, age, location, education, gender, personality_type
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
  const { name, birthDate, age, location, education, gender, personalityType } = req.body ?? {};

  const { rows } = await pool.query(
    `UPDATE users
     SET name = COALESCE($1, name),
         birth_date = COALESCE($2, birth_date),
         age = COALESCE($3, age),
         location = COALESCE($4, location),
         education = COALESCE($5, education),
         gender = COALESCE($6, gender),
         personality_type = COALESCE($7, personality_type),
         updated_at = NOW()
     WHERE id = $8
     RETURNING id, phone, name, birth_date, age, location, education, gender, personality_type`,
    [
      name ?? null,
      birthDate ?? null,
      age ?? null,
      location ?? null,
      education ?? null,
      gender ?? null,
      personalityType ?? null,
      req.user.userId
    ]
  );

  res.json({ profile: rows[0] });
});
