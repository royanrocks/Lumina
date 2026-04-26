import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { pool } from "../db/client";
import { env } from "../config/env";

const OTP_TTL_MS = 5 * 60 * 1000;

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").trim();
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function requestOtp(phoneRaw: string): Promise<{ otp: string }> {
  const phone = normalizePhone(phoneRaw);
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await pool.query(
    `
      INSERT INTO users (phone, otp_hash, otp_expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (phone) DO UPDATE
      SET otp_hash = EXCLUDED.otp_hash,
          otp_expires_at = EXCLUDED.otp_expires_at,
          updated_at = NOW()
    `,
    [phone, otpHash, expiresAt]
  );

  return { otp };
}

export async function verifyOtp(phoneRaw: string, otpRaw: string): Promise<{ token: string; userId: string }> {
  const phone = normalizePhone(phoneRaw);
  const otpHash = hashOtp(otpRaw.trim());

  const result = await pool.query(
    `SELECT id, otp_hash, otp_expires_at FROM users WHERE phone = $1`,
    [phone]
  );

  if (!result.rowCount) {
    throw new Error("User not found. Request OTP first.");
  }

  const user = result.rows[0] as {
    id: string;
    otp_hash: string | null;
    otp_expires_at: Date | null;
  };

  if (!user.otp_hash || !user.otp_expires_at) {
    throw new Error("No active OTP found.");
  }

  if (user.otp_expires_at.getTime() < Date.now()) {
    throw new Error("OTP expired.");
  }

  if (user.otp_hash !== otpHash) {
    throw new Error("Invalid OTP.");
  }

  await pool.query(`UPDATE users SET otp_hash = NULL, otp_expires_at = NULL, updated_at = NOW() WHERE id = $1`, [
    user.id
  ]);

  const token = jwt.sign({ userId: user.id }, env.jwtSecret, { expiresIn: "30d" });

  return { token, userId: user.id };
}
