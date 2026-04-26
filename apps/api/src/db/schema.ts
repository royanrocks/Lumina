import { pool } from "./client";

const createTables = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(120),
  birthday DATE,
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
  nickname VARCHAR(120),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  kind VARCHAR(50),
  message TEXT DEFAULT '',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE friend_links ADD COLUMN IF NOT EXISTS nickname VARCHAR(120);
ALTER TABLE nudges ADD COLUMN IF NOT EXISTS nudge_day DATE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS kind VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT DEFAULT '';

UPDATE nudges
SET nudge_day = COALESCE(nudge_day, DATE(created_at), CURRENT_DATE)
WHERE nudge_day IS NULL;

UPDATE notifications
SET receiver_id = COALESCE(receiver_id, user_id)
WHERE receiver_id IS NULL;

UPDATE notifications
SET sender_id = COALESCE(sender_id, actor_id)
WHERE sender_id IS NULL;

UPDATE notifications
SET type = COALESCE(type, kind, 'friend')
WHERE type IS NULL;

ALTER TABLE nudges ALTER COLUMN nudge_day SET DEFAULT CURRENT_DATE;
ALTER TABLE nudges ALTER COLUMN nudge_day SET NOT NULL;

CREATE INDEX IF NOT EXISTS nudges_daily_lookup
ON nudges (sender_id, receiver_id, nudge_day);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
ON notifications (COALESCE(receiver_id, user_id), created_at DESC);
`;

export async function initializeSchema() {
  await pool.query(createTables);
}
