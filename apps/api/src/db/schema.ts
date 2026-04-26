import { pool } from "./client";

const createTables = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(120),
  age INT,
  location VARCHAR(120),
  education VARCHAR(120),
  gender VARCHAR(50),
  personality_type VARCHAR(80),
  otp_hash VARCHAR(128),
  otp_expires_at TIMESTAMPTZ,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pulse_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journal_text TEXT,
  image_url TEXT,
  ocr_text TEXT,
  fulfillment_score INT NOT NULL CHECK (fulfillment_score BETWEEN 0 AND 100),
  risk_band VARCHAR(20) NOT NULL,
  sentiment_summary TEXT,
  love_today BOOLEAN NOT NULL,
  mood_color VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friend_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

export async function initializeSchema() {
  await pool.query(createTables);
}
