import jwt from "jsonwebtoken";
import { pool } from "../db/client";
import { env } from "../config/env";

function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digitsOnly = trimmed.replace(/\D+/g, "");
  if (!digitsOnly) {
    return "";
  }
  if (trimmed.startsWith("+")) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.startsWith("00")) {
    return `+${digitsOnly.slice(2)}`;
  }
  return `+${digitsOnly}`;
}

function phoneKeyFromDigits(digitsOnly: string): string {
  return digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
}

export async function signInWithPhone(
  phoneRaw: string
): Promise<{ token: string; user: { id: string; phone: string; name: string | null } }> {
  const phone = normalizePhone(phoneRaw);
  const digitsOnly = phone.replace(/\D+/g, "");
  const phoneKey = phoneKeyFromDigits(digitsOnly);

  if (!digitsOnly) {
    throw new Error("Phone number is required.");
  }

  const existing = await pool.query<{ id: string; phone: string; name: string | null }>(
    `
      SELECT id, phone, name
      FROM users
      WHERE (
        CASE
          WHEN LENGTH(REGEXP_REPLACE(phone, '\\D', '', 'g')) > 10
            THEN RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10)
          ELSE REGEXP_REPLACE(phone, '\\D', '', 'g')
        END
      ) = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [phoneKey]
  );

  if ((existing.rowCount ?? 0) > 0) {
    const existingUser = existing.rows[0];
    // Keep one canonical phone format so repeat logins land on the same account.
    if (existingUser.phone !== phone) {
      await pool.query(`UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2`, [phone, existingUser.id]);
    } else {
      await pool.query(`UPDATE users SET updated_at = NOW() WHERE id = $1`, [existingUser.id]);
    }
    const token = jwt.sign({ userId: existingUser.id }, env.jwtSecret, { expiresIn: "60d" });
    return { token, user: { ...existingUser, phone } };
  }

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
