import jwt from "jsonwebtoken";
import { pool } from "../db/client";
import { env } from "../config/env";

function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const hasPlusPrefix = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D+/g, "");
  return hasPlusPrefix ? `+${digitsOnly}` : digitsOnly;
}

export async function signInWithPhone(
  phoneRaw: string
): Promise<{ token: string; user: { id: string; phone: string; name: string | null } }> {
  const phone = normalizePhone(phoneRaw);

  const result = await pool.query<{ id: string; phone: string; name: string | null }>(
    `
      INSERT INTO users (phone)
      VALUES ($1)
      ON CONFLICT (phone) DO UPDATE
      SET updated_at = NOW()
      RETURNING id, phone, name
    `,
    [phone]
  );

  const user = result.rows[0];
  const token = jwt.sign({ userId: user.id }, env.jwtSecret, { expiresIn: "60d" });
  return { token, user };
}
